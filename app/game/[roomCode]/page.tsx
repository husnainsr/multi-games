'use client';
import { useEffect, useState, useCallback, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { usePusherChannel } from '@/hooks/usePusher';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { PUSHER_EVENTS, roomChannel, playerChannel } from '@/lib/pusher';
import { ROLE_CONFIG, AVATAR_COLORS } from '@/lib/utils';
import type {
  GameRoom, GamePhase, Role, DayResult, VoteResult,
  PusherPhaseChanged, PusherRoleAssigned, PusherInvestigatorResult, PublicPlayer
} from '@/lib/types';

function useTimer(duration: number, onExpire: () => void, active: boolean) {
  const [remaining, setRemaining] = useState(duration);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    if (!active || duration === 0) return;
    setRemaining(duration);
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { clearInterval(interval); expireRef.current(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [duration, active]);

  return remaining;
}

function TimerBar({ initial, onExpire }: { initial: number; onExpire?: () => void }) {
  const [remaining, setRemaining] = useState(initial);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setRemaining(initial);
  }, [initial]);

  useEffect(() => {
    if (initial === 0) return;
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(id);
          onExpireRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [initial]);

  if (initial === 0) return null;
  const pct = (remaining / initial) * 100;
  const color = pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-mono font-bold" style={{ color }}>{remaining}s</span>
    </div>
  );
}

function PlayerPill({
  player, selected, onClick, disabled, badge
}: {
  player: { id: string; name: string; avatarIndex: number; isAlive: boolean; isHost: boolean }; selected?: boolean; onClick?: () => void; disabled?: boolean; badge?: string
}) {
  const color = AVATAR_COLORS[player.avatarIndex % AVATAR_COLORS.length];
  const dead = !player.isAlive;

  return (
    <button
      onClick={!dead && !disabled ? onClick : undefined}
      disabled={dead || disabled}
      className={[
        'relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200',
        dead ? 'opacity-40 cursor-not-allowed border-gray-800' :
          disabled ? 'opacity-60 cursor-not-allowed border-gray-800' :
          'cursor-pointer',
      ].join(' ')}
      style={{
        borderColor: dead || disabled ? undefined : selected ? color : `${color}50`,
        background: dead || disabled ? 'rgba(17,17,17,0.4)' : selected ? `${color}28` : `${color}12`,
        boxShadow: selected ? `0 0 18px ${color}35` : undefined,
      }}
    >
      <Avatar name={player.name} avatarIndex={player.avatarIndex} size="md" isAlive={player.isAlive} isHost={player.isHost} />
      <span className="text-sm font-semibold text-white truncate max-w-full">{player.name}</span>
      {badge && (
        <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 flex items-center justify-center text-xs bg-red-600 text-white px-1.5 rounded-full font-bold">
          {badge}
        </span>
      )}
      {selected && (
        <span className="absolute inset-0 rounded-xl border-2 animate-pulse" style={{ borderColor: `${color}90` }} />
      )}
    </button>
  );
}

// Spectator card used in player status grids — shows role image when dead and revealed
function PlayerCard({
  player, revealedRole, isMe,
}: {
  player: { id: string; name: string; avatarIndex: number; isAlive: boolean; isHost: boolean };
  revealedRole?: Role;
  isMe?: boolean;
}) {
  const color = AVATAR_COLORS[player.avatarIndex % AVATAR_COLORS.length];
  const isDead = !player.isAlive;
  const roleCfg = revealedRole ? ROLE_CONFIG[revealedRole] : null;

  return (
    <div
      className={`rounded-xl overflow-hidden border transition-all ${isDead ? 'border-gray-800/50' : 'border-gray-700/40'}`}
      style={{
        background: isDead ? 'rgba(12,12,18,0.9)' : `linear-gradient(145deg, ${color}1a 0%, rgba(12,12,18,0.95) 100%)`,
        borderColor: isDead ? undefined : `${color}35`,
      }}
    >
      {isDead && revealedRole ? (
        <div className="relative" style={{ aspectRatio: '3/4' }}>
          <img src={ROLE_CARD_IMAGES[revealedRole]} alt={roleCfg!.label} className="w-full h-full object-cover opacity-75" />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-0 left-0 right-0 py-1 text-center text-xs font-bold" style={{ color: roleCfg!.color, background: 'rgba(0,0,0,0.65)' }}>
            {roleCfg!.label}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center pt-3 pb-1 gap-1" style={{ filter: isDead ? 'grayscale(70%)' : undefined }}>
          <Avatar name={player.name} avatarIndex={player.avatarIndex} size="md" isAlive={player.isAlive} isHost={player.isHost} />
          {isDead && <span className="text-xs text-red-500 mt-0.5">💀</span>}
        </div>
      )}
      <div className="px-2 pb-2 pt-1 text-center">
        <p className={`text-sm font-semibold truncate ${isDead ? 'text-gray-500' : 'text-white'}`}>
          {player.name}
          {isMe && <span className="text-gray-500 text-xs ml-1">(you)</span>}
        </p>
      </div>
    </div>
  );
}

const ROLE_CARD_IMAGES: Record<Role, string> = {
  mafia: '/Mafia_Cards.png',
  doctor: '/Doctor_Cards.png',
  investigator: '/Detective_Cards.png',
  villager: '/Civilian.png',
};

function RoleReveal({
  role, teammates, onReady
}: { role: Role; teammates: PublicPlayer[]; onReady: () => void }) {
  const cfg = ROLE_CONFIG[role];
  const [isFlipped, setIsFlipped] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [countdown, setCountdown] = useState(20);
  const [readyClicked, setReadyClicked] = useState(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const t1 = setTimeout(() => setIsFlipped(true), 1200);
    const t2 = setTimeout(() => setShowInfo(true), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Auto-advance countdown starts once info is visible
  useEffect(() => {
    if (!showInfo) return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onReadyRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showInfo]);

  function handleReady() {
    if (readyClicked) return;
    setReadyClicked(true);
    onReadyRef.current();
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-6 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${cfg.bg}55 0%, transparent 65%)` }}
      />

      <motion.p
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative z-10 text-sm text-gray-500 uppercase tracking-widest mb-8"
      >
        Your Role Has Been Assigned
      </motion.p>

      {/* 3D Card flip */}
      <div className="relative z-10 mb-8" style={{ perspective: '1200px' }}>
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
          style={{ transformStyle: 'preserve-3d', width: 220, height: 320 }}
        >
          {/* Back face */}
          <div
            className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            <img
              src="/backside_card.png"
              alt="Card back"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Front face */}
          <div
            className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              boxShadow: `0 0 40px ${cfg.color}50`,
            }}
          >
            <img
              src={ROLE_CARD_IMAGES[role]}
              alt={cfg.label}
              className="w-full h-full object-cover"
            />
          </div>
        </motion.div>
      </div>

      {/* Info revealed after flip */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 flex flex-col items-center gap-4 w-full max-w-sm text-center"
          >
            <div>
              <h2 className="text-3xl font-black uppercase tracking-widest mb-1" style={{ color: cfg.color }}>
                {cfg.label}
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">{cfg.description}</p>
            </div>

            {role === 'mafia' && teammates.length > 0 && (
              <div className="glass rounded-xl p-4 w-full glow-red">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 text-center">Your team</p>
                <div className="flex justify-center gap-4">
                  {teammates.map(t => (
                    <div key={t.id} className="flex flex-col items-center gap-1.5">
                      <Avatar name={t.name} avatarIndex={t.avatarIndex} size="md" />
                      <span className="text-xs text-gray-300 font-medium">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!readyClicked ? (
              <div className="w-full flex flex-col items-center gap-2 mt-2">
                <Button onClick={handleReady} size="lg" className="w-full">
                  I&apos;m Ready — Let&apos;s Play
                </Button>
                <p className="text-xs text-gray-600">
                  Auto-starting in <span className="text-gray-400 font-mono">{countdown}s</span>
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-400 mt-2">
                <span>✓</span>
                <span className="text-sm font-medium">Ready! Waiting for game to start...</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NightPhase({
  room, playerId, myRole, revealedRoles, onAction, onAdvance
}: { room: GameRoom; playerId: string; myRole: Role | null; revealedRoles: Record<string, Role>; onAction: (targetId: string | null) => void; onAdvance: () => void }) {
  const me = room.players[playerId];
  const role = myRole;
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const alivePlayers = Object.values(room.players).filter(p => p.isAlive && p.id !== playerId);
  const allAlivePlayers = Object.values(room.players).filter(p => p.isAlive);

  const canAct = role && role !== 'villager' && !submitted;

  async function submit(targetId: string | null) {
    if (submitted) return;
    setSubmitted(true);
    await onAction(targetId);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col" style={{ background: 'radial-gradient(ellipse at top, #0f0a1e 0%, #0a0a0f 60%)' }}>
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-lg font-bold text-white">🌙 Night — Round {room.round}</span>
        </div>
        {room.settings.nightDuration > 0 && (
          <TimerBar
            initial={room.settings.nightDuration}
            onExpire={onAdvance}
          />
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {!me?.isAlive ? (
            <motion.div key="dead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <p className="text-4xl mb-4">💀</p>
              <p className="text-xl font-bold text-gray-400">You are dead</p>
              <p className="text-gray-600 mt-2">Watch the night unfold...</p>
            </motion.div>
          ) : !role ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading role...</p>
            </motion.div>
          ) : role === 'villager' ? (
            <motion.div key="villager" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <p className="text-4xl mb-4">😴</p>
              <p className="text-xl font-bold text-gray-300">The village sleeps...</p>
              <p className="text-gray-600 mt-2">Wait for morning to come</p>
            </motion.div>
          ) : (
            <motion.div
              key="action"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <div className="glass rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">
                    {role === 'mafia' ? '🔪' : role === 'doctor' ? '💉' : '🔍'}
                  </span>
                  <div>
                    <p className="font-bold text-white" style={{ color: role ? ROLE_CONFIG[role].color : undefined }}>
                      {role ? ROLE_CONFIG[role].label : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {role === 'mafia' ? 'Choose your target to eliminate' :
                        role === 'doctor' ? 'Choose someone to protect tonight' :
                          'Choose someone to investigate'}
                    </p>
                  </div>
                </div>

                {submitted ? (
                  <div className="flex items-center gap-2 text-green-400 justify-center py-2">
                    <span className="text-lg">✓</span>
                    <span className="font-medium">Action submitted</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
                    {(role === 'doctor' ? allAlivePlayers : alivePlayers).map(player => (
                      <PlayerPill
                        key={player.id}
                        player={player}
                        selected={selected === player.id}
                        onClick={() => setSelected(prev => prev === player.id ? null : player.id)}
                      />
                    ))}
                  </div>
                )}

                {!submitted && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={() => submit(selected)}
                      disabled={!selected && !!canAct}
                      className="flex-1"
                    >
                      {selected ? `Confirm ${role === 'mafia' ? 'Kill' : role === 'doctor' ? 'Protect' : 'Investigate'}` : 'Select a player'}
                    </Button>
                    <Button variant="ghost" onClick={() => submit(null)}>
                      Skip
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player status grid */}
        <div className="w-full mt-4">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Players</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt).map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                revealedRole={revealedRoles[player.id]}
                isMe={player.id === playerId}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayPhase({
  room, playerId, myRole, revealedRoles, dayResult, onAdvance, investigatorResult
}: {
  room: GameRoom; playerId: string; myRole: Role | null; revealedRoles: Record<string, Role>;
  dayResult: DayResult | null; onAdvance: () => void; investigatorResult: PusherInvestigatorResult | null;
}) {
  const isHost = room.hostId === playerId;
  const isInvestigator = myRole === 'investigator';

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col" style={{ background: 'radial-gradient(ellipse at top, #1a1008 0%, #0a0a0f 70%)' }}>
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-white">☀️ Day — Round {room.round}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center p-6 max-w-2xl mx-auto w-full gap-4">
        {/* Night result banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={[
            'w-full rounded-2xl p-5 text-center',
            dayResult?.eliminatedPlayerId
              ? 'bg-red-950/40 border border-red-900/50'
              : dayResult?.wasProtected
                ? 'bg-green-950/40 border border-green-900/50'
                : 'bg-gray-900/40 border border-gray-700/50'
          ].join(' ')}
        >
          {dayResult?.eliminatedPlayerId ? (
            <>
              <p className="text-3xl mb-2">💀</p>
              <p className="text-white font-bold text-lg">
                <span className="text-red-400">{dayResult.eliminatedPlayerName}</span> was found dead
              </p>
              {dayResult.eliminatedPlayerRole && (
                <p className="text-sm text-gray-400 mt-1">
                  They were the <span style={{ color: ROLE_CONFIG[dayResult.eliminatedPlayerRole].color }}>
                    {ROLE_CONFIG[dayResult.eliminatedPlayerRole].label}
                  </span>
                </p>
              )}
            </>
          ) : dayResult?.wasProtected ? (
            <>
              <p className="text-3xl mb-2">💚</p>
              <p className="text-white font-bold text-lg">Someone was saved by the Doctor!</p>
              <p className="text-sm text-gray-400 mt-1">The village survived the night</p>
            </>
          ) : (
            <>
              <p className="text-3xl mb-2">🌅</p>
              <p className="text-white font-bold text-lg">The night passed peacefully</p>
              <p className="text-sm text-gray-400 mt-1">No one was eliminated</p>
            </>
          )}
        </motion.div>

        {/* Investigator result (private) */}
        <AnimatePresence>
          {isInvestigator && investigatorResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full rounded-xl p-4 border"
              style={{
                background: investigatorResult.isMafia ? '#7f1d1d44' : '#14532d44',
                borderColor: investigatorResult.isMafia ? '#ef444440' : '#22c55e40',
              }}
            >
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Investigation Result</p>
              <p className="text-white font-semibold">
                <span style={{ color: investigatorResult.isMafia ? '#ef4444' : '#22c55e' }}>
                  {investigatorResult.targetName}
                </span>
                {' '}is{' '}
                <span style={{ color: investigatorResult.isMafia ? '#ef4444' : '#22c55e' }}>
                  {investigatorResult.isMafia ? '🔪 Mafia' : '✅ Not Mafia'}
                </span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Players */}
        <div className="w-full">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Players</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt).map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                revealedRole={revealedRoles[player.id]}
                isMe={player.id === playerId}
              />
            ))}
          </div>
        </div>

        <div className="mt-auto pt-4 w-full flex flex-col items-center gap-2">
          <p className="text-sm text-gray-500 text-center">Discuss with the group, then vote to eliminate</p>
          {isHost && (
            <Button size="lg" onClick={onAdvance} className="w-full max-w-xs">
              🗳️ Start Voting
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function VotingPhase({
  room, playerId, myRole, revealedRoles, votes, onVote, onAdvance
}: { room: GameRoom; playerId: string; myRole: Role | null; revealedRoles: Record<string, Role>; votes: Record<string, string | null>; onVote: (targetId: string | null) => void; onAdvance: () => void }) {
  const me = room.players[playerId];
  void myRole; // available for future role-specific voting UI
  const [myVote, setMyVote] = useState<string | null | undefined>(undefined);
  const hasVoted = playerId in votes;
  const alivePlayers = Object.values(room.players).filter(p => p.isAlive);

  // Count votes
  const voteCounts: Record<string, number> = {};
  Object.values(votes).forEach(t => { if (t) voteCounts[t] = (voteCounts[t] || 0) + 1; });
  const maxVotes = Math.max(0, ...Object.values(voteCounts));

  async function submitVote(targetId: string | null) {
    if (hasVoted) return;
    setMyVote(targetId);
    await onVote(targetId);
  }

  const skipCount = Object.values(votes).filter(v => v === null).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-lg font-bold text-white">🗳️ Vote — Round {room.round}</span>
          <span className="text-sm text-gray-500">{Object.keys(votes).length}/{alivePlayers.length} voted</span>
        </div>
        {room.settings.voteDuration > 0 && (
          <TimerBar initial={room.settings.voteDuration} onExpire={onAdvance} />
        )}
      </div>

      <div className="flex-1 flex flex-col items-center p-6 max-w-2xl mx-auto w-full gap-4">
        {!me?.isAlive ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">👁️</p>
            <p className="text-gray-400">You are eliminated — watching the vote</p>
          </div>
        ) : hasVoted ? (
          <div className="glass rounded-xl p-4 text-center w-full">
            <p className="text-green-400 font-semibold">
              ✓ Vote cast for{' '}
              {myVote ? room.players[myVote]?.name : 'Skip'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Waiting for others...</p>
          </div>
        ) : (
          <div className="glass rounded-xl p-4 w-full text-center">
            <p className="text-sm text-gray-400">Vote to eliminate a player</p>
          </div>
        )}

        <div className="w-full grid grid-cols-3 sm:grid-cols-4 gap-3">
          {alivePlayers.map(player => {
            const count = voteCounts[player.id] || 0;
            const isLeading = count === maxVotes && count > 0;
            const mySelection = myVote === player.id;

            return (
              <div key={player.id} className="relative">
                <PlayerPill
                  player={player}
                  selected={mySelection}
                  disabled={hasVoted || !me?.isAlive}
                  onClick={() => submitVote(player.id)}
                  badge={count > 0 ? String(count) : undefined}
                />
                {isLeading && count > 0 && (
                  <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-red-500 rounded-full" />
                )}
              </div>
            );
          })}
        </div>

        {me?.isAlive && !hasVoted && (
          <Button variant="ghost" onClick={() => submitVote(null)} className="text-gray-500 hover:text-gray-300">
            Skip Vote ({skipCount} skipped)
          </Button>
        )}

        {/* Dead players — greyed out with role revealed */}
        {Object.values(room.players).some(p => !p.isAlive) && (
          <div className="w-full pt-2 border-t border-gray-800/50">
            <p className="text-xs text-gray-700 uppercase tracking-widest mb-2">Eliminated</p>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {Object.values(room.players).filter(p => !p.isAlive).sort((a, b) => a.joinedAt - b.joinedAt).map(player => (
                <PlayerCard key={player.id} player={player} revealedRole={revealedRoles[player.id]} isMe={player.id === playerId} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VoteResultScreen({
  room, voteResult, onNext
}: { room: GameRoom; voteResult: VoteResult | null; onNext: () => void }) {
  const isHost = true; // everyone sees the "next" since it's just a timer

  useEffect(() => {
    const t = setTimeout(onNext, 6000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        {voteResult?.eliminatedPlayerId ? (
          <>
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="text-5xl mb-4"
            >⚰️</motion.p>
            <h2 className="text-2xl font-bold text-white mb-2">
              <span className="text-red-400">{voteResult.eliminatedPlayerName}</span> was eliminated!
            </h2>
            {voteResult.eliminatedPlayerRole && (
              <p className="text-lg" style={{ color: ROLE_CONFIG[voteResult.eliminatedPlayerRole].color }}>
                They were the {ROLE_CONFIG[voteResult.eliminatedPlayerRole].label}
              </p>
            )}
          </>
        ) : voteResult?.wasTie ? (
          <>
            <p className="text-5xl mb-4">🤝</p>
            <h2 className="text-2xl font-bold text-white mb-2">It&apos;s a tie!</h2>
            <p className="text-gray-400">No one was eliminated</p>
          </>
        ) : (
          <>
            <p className="text-5xl mb-4">🤐</p>
            <h2 className="text-2xl font-bold text-white mb-2">No votes cast</h2>
            <p className="text-gray-400">The village couldn&apos;t agree</p>
          </>
        )}

        {/* Vote breakdown */}
        {voteResult && Object.keys(voteResult.voteCounts).length > 0 && (
          <div className="mt-6 glass rounded-xl p-4 text-left">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Vote Breakdown</p>
            {Object.entries(voteResult.voteCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([playerId, count]) => (
                <div key={playerId} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-300">{room.players[playerId]?.name}</span>
                  <span className="text-sm font-bold text-red-400">{count} vote{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
          </div>
        )}

        <p className="text-xs text-gray-600 mt-6">Next round starting in 6 seconds...</p>
      </motion.div>
    </div>
  );
}

function GameOverScreen({
  room, winner, onPlayAgain
}: { room: GameRoom; winner: 'mafia' | 'village'; onPlayAgain: () => void }) {
  const isVillageWin = winner === 'village';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: isVillageWin
          ? 'radial-gradient(ellipse at center, #14532d44 0%, #0a0a0f 60%)'
          : 'radial-gradient(ellipse at center, #7f1d1d44 0%, #0a0a0f 60%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        className="max-w-lg w-full text-center"
      >
        <motion.p
          animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-6xl mb-4"
        >
          {isVillageWin ? '🏆' : '💀'}
        </motion.p>

        <h1 className="text-4xl font-black mb-2" style={{ color: isVillageWin ? '#22c55e' : '#ef4444' }}>
          {isVillageWin ? 'Village Wins!' : 'Mafia Wins!'}
        </h1>
        <p className="text-gray-400 mb-8">
          {isVillageWin ? 'The village successfully eliminated all Mafia members.' : 'The Mafia has taken control of the village.'}
        </p>

        {/* All roles revealed */}
        <div className="glass rounded-2xl p-5 mb-6 text-left">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 text-center">Final Roles</p>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(room.players)
              .sort((a, b) => a.joinedAt - b.joinedAt)
              .map(player => {
                const role = player.role;
                const cfg = role ? ROLE_CONFIG[role] : null;
                return (
                  <div key={player.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-900/40">
                    <Avatar name={player.name} avatarIndex={player.avatarIndex} size="sm" isAlive={player.isAlive} />
                    <div>
                      <p className="text-sm font-medium text-white truncate">{player.name}</p>
                      {cfg && (
                        <p className="text-xs" style={{ color: cfg.color }}>{cfg.label}</p>
                      )}
                    </div>
                    {!player.isAlive && <span className="ml-auto text-xs">💀</span>}
                  </div>
                );
              })}
          </div>
        </div>

        <Button size="lg" onClick={onPlayAgain} className="w-full">
          🔄 Play Again
        </Button>
      </motion.div>
    </div>
  );
}

export default function GamePage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = use(params);
  const router = useRouter();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [roleTeammates, setRoleTeammates] = useState<PublicPlayer[]>([]);
  const [roleRevealed, setRoleRevealed] = useState(false);
  const [currentDayResult, setCurrentDayResult] = useState<DayResult | null>(null);
  const [currentVoteResult, setCurrentVoteResult] = useState<VoteResult | null>(null);
  const [votes, setVotes] = useState<Record<string, string | null>>({});
  const [investigatorResult, setInvestigatorResult] = useState<PusherInvestigatorResult | null>(null);
  const [revealedRoles, setRevealedRoles] = useState<Record<string, Role>>({});
  // Only redirect to lobby after we've been in an active game phase — prevents
  // false fires when phase='lobby' is just the React initial state on fresh mount.
  const didEnterGameRef = useRef(false);

  useEffect(() => {
    const pid = localStorage.getItem(`player:${roomCode}`);
    if (!pid) { router.replace('/'); return; }
    setPlayerId(pid);

    fetch(`/api/rooms/${roomCode}`)
      .then(r => r.json())
      .then((data: GameRoom) => {
        if (!data || (data as unknown as { error: string }).error) { router.replace('/'); return; }
        setRoom(data);
        setPhase(data.phase);
        setVotes(data.votes || {});
        if (data.lastDayResult) setCurrentDayResult(data.lastDayResult);
        if (data.lastVoteResult) setCurrentVoteResult(data.lastVoteResult);
        // Seed revealed roles from the latest results available on load
        const seed: Record<string, Role> = {};
        if (data.lastDayResult?.eliminatedPlayerId && data.lastDayResult.eliminatedPlayerRole)
          seed[data.lastDayResult.eliminatedPlayerId] = data.lastDayResult.eliminatedPlayerRole;
        if (data.lastVoteResult?.eliminatedPlayerId && data.lastVoteResult.eliminatedPlayerRole)
          seed[data.lastVoteResult.eliminatedPlayerId] = data.lastVoteResult.eliminatedPlayerRole;
        if (Object.keys(seed).length) setRevealedRoles(seed);
      })
      .catch(() => router.replace('/'));
  }, [roomCode, router]);

  // Fix Pusher race condition: role-assigned events fire before clients subscribe
  // to private channels during lobby→game navigation. Poll the API instead.
  useEffect(() => {
    if (phase === 'lobby' || phase === 'game-over' || myRole || !playerId || !roomCode) return;
    fetch(`/api/game/role?roomCode=${roomCode}&playerId=${playerId}`)
      .then(r => r.json())
      .then(data => {
        if (data.role) {
          setMyRole(data.role);
          setRoleTeammates(data.teammates || []);
        }
      })
      .catch(console.error);
  }, [phase, myRole, playerId, roomCode]);

  // Mark that we've entered a real game phase (not just initial 'lobby' state).
  useEffect(() => {
    if (room && phase !== 'lobby') didEnterGameRef.current = true;
  }, [room, phase]);

  // When server resets the game (Play Again), phase returns to 'lobby' — navigate back.
  // Guard: only fire after we've actually been in a game, never on initial mount.
  useEffect(() => {
    if (phase !== 'lobby' || !room || !didEnterGameRef.current) return;
    setMyRole(null);
    setRoleTeammates([]);
    setRoleRevealed(false);
    setCurrentDayResult(null);
    setCurrentVoteResult(null);
    setVotes({});
    setInvestigatorResult(null);
    setRevealedRoles({});
    router.replace(`/lobby/${roomCode}`);
  }, [phase, room, roomCode, router]);

  // Polling fallback: if Pusher event is missed, sync phase from server every 5s
  useEffect(() => {
    if (!roomCode || !playerId) return;
    const id = setInterval(() => {
      fetch(`/api/rooms/${roomCode}`)
        .then(r => r.json())
        .then((data: GameRoom) => {
          if (!data || (data as unknown as { error: string }).error) return;
          setPhase(prev => {
            if (prev !== data.phase) {
              setRoom(data);
              setVotes(data.votes || {});
              if (data.lastDayResult) setCurrentDayResult(data.lastDayResult);
              if (data.lastVoteResult) setCurrentVoteResult(data.lastVoteResult);
            }
            return data.phase;
          });
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [roomCode, playerId]);

  const phaseHandlers = {
    [PUSHER_EVENTS.PHASE_CHANGED]: useCallback((data: unknown) => {
      const payload = data as PusherPhaseChanged;
      setPhase(payload.phase);

      setRoom(prev => {
        if (!prev) return prev;
        const updated = { ...prev, phase: payload.phase, round: payload.round };
        if (payload.players) {
          updated.players = payload.players as unknown as GameRoom['players'];
        }
        if (payload.winner) updated.winner = payload.winner;
        return updated;
      });

      if (payload.dayResult) {
        setCurrentDayResult(payload.dayResult);
        setCurrentVoteResult(null);
        if (payload.dayResult.eliminatedPlayerId && payload.dayResult.eliminatedPlayerRole)
          setRevealedRoles(prev => ({ ...prev, [payload.dayResult!.eliminatedPlayerId!]: payload.dayResult!.eliminatedPlayerRole! }));
      }
      if (payload.voteResult) {
        setCurrentVoteResult(payload.voteResult);
        setCurrentDayResult(null);
        if (payload.voteResult.eliminatedPlayerId && payload.voteResult.eliminatedPlayerRole)
          setRevealedRoles(prev => ({ ...prev, [payload.voteResult!.eliminatedPlayerId!]: payload.voteResult!.eliminatedPlayerRole! }));
      }
      if (payload.phase === 'night') setVotes({});
      if (payload.phase === 'voting') setVotes({});
    }, []),

    [PUSHER_EVENTS.VOTE_UPDATE]: useCallback((data: unknown) => {
      const { votes: v } = data as { votes: Record<string, string | null> };
      setVotes(v);
    }, []),

    [PUSHER_EVENTS.PLAYER_JOINED]: useCallback((data: unknown) => {
      const { player } = data as { player: PublicPlayer };
      setRoom(prev => prev ? { ...prev, players: { ...prev.players, [player.id]: player as unknown as GameRoom['players'][string] } } : prev);
    }, []),
  };

  const privateHandlers = {
    [PUSHER_EVENTS.ROLE_ASSIGNED]: useCallback((data: unknown) => {
      const payload = data as PusherRoleAssigned;
      setMyRole(payload.role);
      setRoleTeammates(payload.teammates || []);
    }, []),

    [PUSHER_EVENTS.INVESTIGATOR_RESULT]: useCallback((data: unknown) => {
      setInvestigatorResult(data as PusherInvestigatorResult);
    }, []),
  };

  usePusherChannel(
    room ? roomChannel(roomCode) : null,
    phaseHandlers,
    [phase],
    playerId ?? '',
    roomCode
  );

  usePusherChannel(
    room && playerId ? playerChannel(playerId) : null,
    privateHandlers,
    [],
    playerId ?? '',
    roomCode
  );

  async function sendAction(targetId: string | null) {
    if (!playerId || !room) return;
    await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, playerId, targetId }),
    });
  }

  async function sendVote(targetId: string | null) {
    if (!playerId || !room) return;
    await fetch('/api/game/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, playerId, targetId }),
    });
  }

  async function advance(fromPhase: GamePhase) {
    if (!playerId) return;
    await fetch('/api/game/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, playerId, fromPhase }),
    });
  }

  if (!room || !playerId) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {phase === 'starting' && myRole && !roleRevealed && (
          <RoleReveal
            role={myRole}
            teammates={roleTeammates}
            onReady={() => {
              setRoleRevealed(true);
              advance('starting');
            }}
          />
        )}

        {phase === 'starting' && (!myRole || roleRevealed) && (
          <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Waiting for others to be ready...</p>
            </div>
          </div>
        )}

        {phase === 'night' && (
          <NightPhase room={room} playerId={playerId} myRole={myRole} revealedRoles={revealedRoles} onAction={sendAction} onAdvance={() => advance('night')} />
        )}

        {phase === 'day' && (
          <DayPhase
            room={room}
            playerId={playerId}
            myRole={myRole}
            revealedRoles={revealedRoles}
            dayResult={currentDayResult}
            onAdvance={() => advance('day')}
            investigatorResult={investigatorResult}
          />
        )}

        {phase === 'voting' && (
          <VotingPhase
            room={room}
            playerId={playerId}
            myRole={myRole}
            revealedRoles={revealedRoles}
            votes={votes}
            onVote={sendVote}
            onAdvance={() => advance('voting')}
          />
        )}

        {phase === 'vote-result' && (
          <VoteResultScreen
            room={room}
            voteResult={currentVoteResult}
            onNext={() => advance('vote-result')}
          />
        )}

        {phase === 'game-over' && room.winner && (
          <GameOverScreen
            room={room}
            winner={room.winner}
            onPlayAgain={() => advance('game-over')}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
