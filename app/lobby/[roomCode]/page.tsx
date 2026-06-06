'use client';
import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { usePusherChannel } from '@/hooks/usePusher';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { GameCard } from '@/components/ui/GameCard';
import { Toggle } from '@/components/ui/Toggle';
import { PUSHER_EVENTS, roomChannel } from '@/lib/pusher';
import { getMinPlayers } from '@/lib/game-engine';
import type { GameRoom, GameSettings } from '@/lib/types';
import { Copy, Check, Crown, Play, Settings, Users, X } from 'lucide-react';

export default function LobbyPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = use(params);
  const router = useRouter();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const pid = localStorage.getItem(`player:${roomCode}`);
    if (!pid) { router.replace('/'); return; }
    setPlayerId(pid);

    fetch(`/api/rooms/${roomCode}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          router.replace('/');
        } else {
          setRoom(data);
          if (data.phase !== 'lobby') {
            router.replace(`/game/${roomCode}`);
          }
        }
      })
      .catch(() => router.replace('/'));
  }, [roomCode, router]);

  const handlers = {
    [PUSHER_EVENTS.PLAYER_JOINED]: useCallback((data: unknown) => {
      const { player } = data as { player: GameRoom['players'][string] };
      setRoom(prev => prev ? { ...prev, players: { ...prev.players, [player.id]: player } } : prev);
    }, []),
    [PUSHER_EVENTS.PLAYER_LEFT]: useCallback((data: unknown) => {
      const { playerId: leftId } = data as { playerId: string };
      setRoom(prev => {
        if (!prev) return prev;
        const players = { ...prev.players };
        delete players[leftId];
        return { ...prev, players };
      });
    }, []),
    [PUSHER_EVENTS.SETTINGS_UPDATED]: useCallback((data: unknown) => {
      const { settings } = data as { settings: GameSettings };
      setRoom(prev => prev ? { ...prev, settings } : prev);
    }, []),
    [PUSHER_EVENTS.PHASE_CHANGED]: useCallback((data: unknown) => {
      const { phase } = data as { phase: string };
      if (phase === 'starting') router.push(`/game/${roomCode}`);
    }, [roomCode, router]),
    [PUSHER_EVENTS.PLAYER_KICKED]: useCallback((data: unknown) => {
      const { playerId: kickedId } = data as { playerId: string };
      setRoom(prev => {
        if (!prev) return prev;
        const players = { ...prev.players };
        delete players[kickedId];
        return { ...prev, players };
      });
      // If this client is the one kicked, send them home
      const myId = localStorage.getItem(`player:${roomCode}`);
      if (myId === kickedId) {
        localStorage.removeItem(`player:${roomCode}`);
        router.replace('/');
      }
    }, [roomCode, router]),
  };

  usePusherChannel(
    room ? roomChannel(roomCode) : null,
    handlers,
    playerId ?? '',
    roomCode
  );

  // Polling fallback: catch missed Pusher events every 3 seconds
  useEffect(() => {
    if (!roomCode || !playerId) return;
    const id = setInterval(() => {
      fetch(`/api/rooms/${roomCode}`, { cache: 'no-store' })
        .then(r => r.json())
        .then((data: GameRoom) => {
          if (!data || (data as unknown as { error: string }).error) return;
          if (data.phase !== 'lobby') {
            router.replace(`/game/${roomCode}`);
            return;
          }
          setRoom(data);
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [roomCode, playerId, router]);

  async function updateSetting(patch: Partial<GameSettings>) {
    if (!room || !playerId) return;
    // Optimistic update — UI reflects instantly
    const newSettings = { ...room.settings, ...patch };
    setRoom(prev => prev ? { ...prev, settings: newSettings } : prev);
    try {
      await fetch('/api/game/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, playerId, settings: newSettings }),
      });
    } catch {
      // Revert on failure
      setRoom(prev => prev ? { ...prev, settings: room.settings } : prev);
    }
  }

  async function startGame() {
    if (!playerId || !room) return;
    setStarting(true); setError('');
    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start');
      setStarting(false);
    }
  }

  async function kickPlayer(targetId: string) {
    if (!playerId) return;
    await fetch('/api/game/kick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, playerId, targetId }),
    });
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!room || !playerId) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isHost = room.hostId === playerId;
  const players = Object.values(room.players);
  const minPlayers = getMinPlayers(room.settings);
  const canStart = players.length >= minPlayers;
  const { settings } = room;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-white">MAFIA<span className="text-red-500"> NIGHT</span></span>
        </div>
        <button
          onClick={copyCode}
          className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm font-mono font-bold text-white hover:border-red-500/50 transition-all group"
        >
          <span className="tracking-widest text-red-400">{roomCode}</span>
          {copied
            ? <Check className="w-4 h-4 text-green-400" />
            : <Copy className="w-4 h-4 text-gray-500 group-hover:text-white" />}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Players column */}
        <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-400 font-medium">
              Players ({players.length}/{settings.maxPlayers})
            </span>
            {!canStart && (
              <span className="text-xs text-amber-500 ml-auto">
                Need {minPlayers - players.length} more
              </span>
            )}
          </div>

          <div className={getGridClass(players.length)}>
            <AnimatePresence>
              {players.sort((a, b) => a.joinedAt - b.joinedAt).map(player => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                >
                  <GameCard
                    player={player}
                    isMe={player.id === playerId}
                    isLobby={true}
                    showKickButton={isHost && player.id !== playerId}
                    onKick={() => kickPlayer(player.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Share hint */}
          <div className="mt-4 p-4 rounded-xl bg-gray-900/50 border border-gray-800 text-center">
            <p className="text-sm text-gray-500">
              Share code <span className="font-mono font-bold text-red-400">{roomCode}</span> with friends to join
            </p>
          </div>
        </div>

        {/* Settings panel (host only) */}
        {isHost && (
          <div className="w-72 border-l border-gray-800 p-6 flex flex-col gap-6 overflow-y-auto">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-300">Game Settings</span>
            </div>

            {/* Mafia count */}
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-400">Mafia Players</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateSetting({ mafiaCount: Math.max(1, settings.mafiaCount - 1) })}
                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-bold flex items-center justify-center transition-colors"
                >−</button>
                <span className="text-xl font-bold text-white w-8 text-center">{settings.mafiaCount}</span>
                <button
                  onClick={() => updateSetting({ mafiaCount: Math.min(4, settings.mafiaCount + 1) })}
                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-bold flex items-center justify-center transition-colors"
                >+</button>
              </div>
            </div>

            {/* Roles */}
            <div className="flex flex-col gap-3">
              <Toggle
                checked={settings.hasDoctor}
                onChange={v => updateSetting({ hasDoctor: v })}
                label="💉 Doctor Role"
                description="Saves a player each night"
              />
              <Toggle
                checked={settings.hasInvestigator}
                onChange={v => updateSetting({ hasInvestigator: v })}
                label="🔍 Investigator Role"
                description="Reveals Mafia identity"
              />
            </div>

            {/* Timers */}
            <div className="flex flex-col gap-3">
              <span className="text-sm text-gray-400 font-medium">Phase Timers</span>
              {[
                { key: 'nightDuration' as const, label: '🌙 Night', min: 0, max: 120, step: 15 },
                { key: 'dayDuration' as const, label: '☀️ Day', min: 0, max: 300, step: 30 },
                { key: 'voteDuration' as const, label: '🗳️ Vote', min: 0, max: 120, step: 15 },
              ].map(({ key, label, min, max, step }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-mono text-gray-300">
                      {settings[key] === 0 ? '∞' : `${settings[key]}s`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={settings[key]}
                    onChange={e => updateSetting({ [key]: parseInt(e.target.value) })}
                    className="w-full accent-red-500 h-1.5"
                  />
                </div>
              ))}
            </div>

            {/* Other options */}
            <Toggle
              checked={settings.revealRoleOnDeath}
              onChange={v => updateSetting({ revealRoleOnDeath: v })}
              label="Reveal role on death"
              description="Shows role when eliminated"
            />

            {/* Max players */}
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-400">Max Players</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateSetting({ maxPlayers: Math.max(minPlayers, settings.maxPlayers - 1) })}
                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-bold flex items-center justify-center transition-colors"
                >−</button>
                <span className="text-xl font-bold text-white w-8 text-center">{settings.maxPlayers}</span>
                <button
                  onClick={() => updateSetting({ maxPlayers: Math.min(15, settings.maxPlayers + 1) })}
                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-bold flex items-center justify-center transition-colors"
                >+</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800 px-6 py-4 flex items-center justify-between gap-4">
        <div className="text-sm text-gray-500">
          {isHost ? 'You are the host' : 'Waiting for host to start the game...'}
        </div>
        {isHost && (
          <div className="flex flex-col items-end gap-1">
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button
              onClick={startGame}
              loading={starting}
              disabled={!canStart}
              size="lg"
              className="min-w-36"
            >
              <Play className="w-4 h-4" />
              Start Game
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function getGridClass(count: number) {
  if (count <= 2) return "grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-md mx-auto w-full";
  if (count <= 4) return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-w-3xl mx-auto w-full";
  if (count <= 6) return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-5xl mx-auto w-full";
  return "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 w-full";
}
