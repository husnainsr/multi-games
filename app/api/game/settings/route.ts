import { NextRequest, NextResponse } from 'next/server';
import { getRoom, setRoom } from '@/lib/store';
import { pusherServer, roomChannel, PUSHER_EVENTS } from '@/lib/pusher';
import type { GameSettings } from '@/lib/types';

export async function PATCH(req: NextRequest) {
  const { roomCode, playerId, settings } = await req.json();

  const room = await getRoom(roomCode);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.hostId !== playerId) return NextResponse.json({ error: 'Not host' }, { status: 403 });
  if (room.phase !== 'lobby') return NextResponse.json({ error: 'Game already started' }, { status: 409 });

  const updated: GameSettings = {
    ...room.settings,
    ...settings,
    mafiaCount: Math.max(1, Math.min(4, settings.mafiaCount ?? room.settings.mafiaCount)),
    maxPlayers: Math.max(5, Math.min(15, settings.maxPlayers ?? room.settings.maxPlayers)),
  };

  room.settings = updated;
  await setRoom(room);

  try {
    await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.SETTINGS_UPDATED, { settings: updated });
  } catch (e) {
    console.error('[Pusher] settings trigger failed:', (e as Error).message);
  }

  return NextResponse.json({ ok: true, settings: updated });
}
