import { NextRequest, NextResponse } from 'next/server';
import { getRoom, setRoom } from '@/lib/store';
import { safeTrigger, roomChannel, PUSHER_EVENTS } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  const { roomCode, playerId, targetId } = await req.json();

  const room = await getRoom(roomCode);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.hostId !== playerId) return NextResponse.json({ error: 'Not host' }, { status: 403 });
  if (room.phase !== 'lobby') return NextResponse.json({ error: 'Can only kick in lobby' }, { status: 409 });
  if (targetId === playerId) return NextResponse.json({ error: 'Cannot kick yourself' }, { status: 400 });
  if (!room.players[targetId]) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  delete room.players[targetId];
  await setRoom(room);

  await safeTrigger(roomChannel(roomCode), PUSHER_EVENTS.PLAYER_KICKED, { playerId: targetId });

  return NextResponse.json({ ok: true });
}
