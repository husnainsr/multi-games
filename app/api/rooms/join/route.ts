import { NextRequest, NextResponse } from 'next/server';
import { generatePlayerId, AVATAR_COLORS } from '@/lib/utils';
import { getRoom, setRoom } from '@/lib/store';
import { pusherServer, roomChannel, PUSHER_EVENTS } from '@/lib/pusher';
import type { Player } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { roomCode, playerName } = await req.json();

  if (!roomCode?.trim() || !playerName?.trim()) {
    return NextResponse.json({ error: 'Room code and name are required' }, { status: 400 });
  }

  const code = roomCode.trim().toUpperCase();
  const room = await getRoom(code);

  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.phase !== 'lobby') return NextResponse.json({ error: 'Game already in progress' }, { status: 409 });

  const playerCount = Object.keys(room.players).length;
  if (playerCount >= room.settings.maxPlayers) return NextResponse.json({ error: 'Room is full' }, { status: 409 });

  const playerId = generatePlayerId();
  const player: Player = {
    id: playerId,
    name: playerName.trim().slice(0, 20),
    avatarIndex: playerCount % AVATAR_COLORS.length,
    role: null,
    isAlive: true,
    isHost: false,
    joinedAt: Date.now(),
  };

  room.players[playerId] = player;
  await setRoom(room);

  const { role: _role, ...publicPlayer } = player;
  void _role;

  try {
    await pusherServer.trigger(roomChannel(code), PUSHER_EVENTS.PLAYER_JOINED, { player: publicPlayer });
  } catch (e) {
    console.error('[Pusher] trigger failed:', (e as Error).message);
  }

  return NextResponse.json({ roomCode: code, playerId });
}
