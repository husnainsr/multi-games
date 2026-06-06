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

function TimerBar({ remaining, total }: { remaining: number; total: number }) {
  if (total === 0) return null;
  const pct = (remaining / total) * 100;
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
        dead ? 'opacity-40 cursor-not-allowed border-gray-800 bg-gray-900/20' :
          selected ? 'border-red-500 bg-red-950/30 shadow-lg shadow-red-900/20' :
            'border-gray-700 bg-gray-900/40 hover:border-gray-600 hover:bg-gray-800/40',
        !dead && !disabled && !selected ? 'cursor-pointer' : ''
      ].join(' ')}
    >
      <Avatar name={player.name} avatarIndex={player.avatarIndex} size="md" isAlive={player.isAlive} isHost={player.isHost} />
      <span className="text-xs font-medium text-gray-300 truncate max-w-full">{player.name}</span>
      {badge && (
        <span className="absolute -top-1.5 -right-1.5 text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
      {selected && (
        <span className="absolute inset-0 rounded-xl border-2 border-red-500/50 animate-pulse" />
      )}
    </button>
  );
}

function RoleReveal({
  role, teammates, onReady
}: { role: Role; teammates: PublicPlayer[]; onReady: () => void }) {
  const cfg = ROLE_CONFIG[role];
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${cfg.bg}44 0%, transparent 60%)` }} />

      <motion.div
        initial={{ scale: 0.8, opacity: 0, rotateY: -90 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="relative z-10 flex flex-col items-center text-center max-w-sm w-full"
      >
        <p className="text-sm text-gray-500 uppercase tracking-widest mb-6">Your Role</p>

        <div
          className="w-48 h-64 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 mb-8"
          style={{ borderColor: cfg.color + '60', background: cfg.bg + 'aa', boxShadow: `0 0 40px ${cfg.color}30` }}
        >
          <span className="text-6xl">
            {role === 'mafia' ? '🔪' : role === 'doctor' ? '💉' : role === 'investigator' ? '🔍' : '🧑'}
          </span>
          <span className="text-2xl font-black uppercase tracking-wide" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>

        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 w-full"
            >
              <p className="text-gray-400 text-sm leading-relaxed">{cfg.description}</p>

              {role === 'mafia' && teammates.length > 0 && (
                <div className="glass rounded-xl p-4 w-full mt-2">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 text-center">Your team</p>
                  <div className="flex justify-center gap-3">
                    {teammates.map(t => (
                      <div key={t.id} className="flex flex-col items-center gap-1">
                        <Avatar name={t.name} avatarIndex={t.avatarIndex} size="sm" />
                        <span className="text-xs text-gray-400">{t.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={onReady} size="lg" className="mt-4 w-full">
                I&apos;m Ready
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function NightPhase({
  room, playerId, onAction
}: { room: GameRoom; playerId: string; onAction: (targetId: string | null) => void }) {
  const me = room.players[playerId];
  const role = me?.role;
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
            remaining={room.settings.nightDuration}
            total={room.settings.nightDuration}
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
          <div className="flex flex-wrap gap-2">
            {Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt).map(player => (
              <div
                key={player.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/50"
                style={{ opacity: player.isAlive ? 1 : 0.4 }}
              >
                <Avatar name={player.name} avatarIndex={player.avatarIndex} size="sm" isAlive={player.isAlive} />
                <span className="text-xs text-gray-400">{player.name}</span>
                {player.id === playerId && <span className="text-xs text-gray-600">(you)</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayPhase({
  room, playerId, dayResult, onAdvance, investigatorResult
}: {
  room: GameRoom; playerId: string; dayResult: DayResult | null;
  onAdvance: () => void; investigatorResult: PusherInvestigatorResult | null;
}) {
  const isHost = room.hostId === playerId;
  const me = room.players[playerId];
  const isInvestigator = me?.role === 'investigator';

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
              <div
                key={player.id}
                className="glass rounded-xl p-3 flex flex-col items-center gap-2 text-center"
                style={{ opacity: player.isAlive ? 1 : 0.5 }}
              >
                <Avatar name={player.name} avatarIndex={player.avatarIndex} size="md" isAlive={player.isAlive} isHost={player.isHost} />
                <span className="text-xs font-medium text-gray-300 truncate w-full">{player.name}</span>
                {!player.isAlive && player.role && (
                  <span className="text-xs" style={{ color: ROLE_CONFIG[player.role].color }}>
                    {ROLE_CONFIG[player.role].label}
                  </span>
                )}
              </div>
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
  room, playerId, votes, onVote
}: { room: GameRoom; playerId: string; votes: Record<string, string | null>; onVote: (targetId: string | null) => void }) {
  const me = room.players[playerId];
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
          <TimerBar remaining={room.settings.voteDuration} total={room.settings.voteDuration} />
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
      })
      .catch(() => router.replace('/'));
  }, [roomCode, router]);

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

      if (payload.dayResult) { setCurrentDayResult(payload.dayResult); setCurrentVoteResult(null); }
      if (payload.voteResult) { setCurrentVoteResult(payload.voteResult); setCurrentDayResult(null); }
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
          <NightPhase room={room} playerId={playerId} onAction={sendAction} />
        )}

        {phase === 'day' && (
          <DayPhase
            room={room}
            playerId={playerId}
            dayResult={currentDayResult}
            onAdvance={() => advance('day')}
            investigatorResult={investigatorResult}
          />
        )}

        {phase === 'voting' && (
          <VotingPhase
            room={room}
            playerId={playerId}
            votes={votes}
            onVote={sendVote}
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
