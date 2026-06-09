'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ParticleBackground } from '@/components/landing/ParticleBackground';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Shield, Search, Users } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const openCreate = () => { setName(''); setError(''); setCreateOpen(true); };
  const openJoin = () => { setName(''); setCode(''); setError(''); setJoinOpen(true); };

  async function handleCreate() {
    if (!name.trim()) return setError('Enter your name');
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem(`player:${data.roomCode}`, data.playerId);
      router.push(`/lobby/${data.roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!name.trim()) return setError('Enter your name');
    if (!code.trim()) return setError('Enter room code');
    setLoading(true); setError('');
    try {
      const roomKey = code.trim().toUpperCase();
      const existingPlayerId = localStorage.getItem(`player:${roomKey}`) ?? undefined;
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: roomKey, playerName: name.trim(), existingPlayerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem(`player:${data.roomCode}`, data.playerId);
      router.push(`/lobby/${data.roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0f]">
      <ParticleBackground />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-red-900/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-2xl w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/60 border border-red-900/40 text-red-400 text-xs font-medium"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          Social Deduction Game
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-7xl font-black tracking-tight mb-2"
          style={{ textShadow: '0 0 40px rgba(239,68,68,0.4)' }}
        >
          <span className="text-white">MAFIA</span>
          <br />
          <span className="shimmer-text">NIGHT</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-gray-400 text-lg mb-12 max-w-md"
        >
          Lies. Deception. Betrayal. Play with friends — trust no one.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
        >
          <Button
            size="lg"
            onClick={openCreate}
            className="w-full sm:w-auto text-base font-bold px-10 shadow-xl shadow-red-900/30 hover:shadow-red-600/30"
          >
            <Shield className="w-5 h-5" />
            Create Room
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={openJoin}
            className="w-full sm:w-auto text-base font-bold px-10"
          >
            <Users className="w-5 h-5" />
            Join Room
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-14 grid grid-cols-3 gap-4 text-center max-w-sm w-full"
        >
          {[
            { icon: '🔪', label: 'Mafia', desc: 'Hunt by night', color: '#ef4444' },
            { icon: '💉', label: 'Doctor', desc: 'Save a life', color: '#22c55e' },
            { icon: '🔍', label: 'Detective', desc: 'Find the truth', color: '#3b82f6' },
          ].map(r => (
            <div key={r.label} className="flex flex-col items-center gap-1.5">
              <span className="text-2xl">{r.icon}</span>
              <span className="text-xs font-semibold" style={{ color: r.color }}>{r.label}</span>
              <span className="text-xs text-gray-600">{r.desc}</span>
            </div>
          ))}
        </motion.div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a Room">
        <div className="flex flex-col gap-4">
          <Input
            label="Your Name"
            placeholder="Enter your name..."
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            maxLength={20}
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button onClick={handleCreate} loading={loading} size="lg" className="mt-1">
            <Shield className="w-4 h-4" />
            Create Room
          </Button>
        </div>
      </Modal>

      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="Join a Room">
        <div className="flex flex-col gap-4">
          <Input
            label="Your Name"
            placeholder="Enter your name..."
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            maxLength={20}
            autoFocus
          />
          <Input
            label="Room Code"
            placeholder="e.g. ABC123"
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={6}
            className="uppercase tracking-widest"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button onClick={handleJoin} loading={loading} size="lg" className="mt-1">
            <Search className="w-4 h-4" />
            Join Game
          </Button>
        </div>
      </Modal>
    </main>
  );
}
