import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = await getRoom(code.toUpperCase());

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  // Strip private role info before sending
  const publicRoom = {
    ...room,
    players: Object.fromEntries(
      Object.entries(room.players).map(([id, p]) => {
        const pub = { ...p };
        if (room.phase !== 'game-over') delete (pub as Record<string, unknown>).role;
        return [id, pub];
      })
    ),
  };

  return NextResponse.json(publicRoom);
}
