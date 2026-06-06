import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = await getRoom(code.toUpperCase());

  if (!room) {
    return NextResponse.json(
      { error: 'Room not found' },
      {
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }

  // Strip private role info before sending, but reveal roles for dead players if settings allow
  const publicRoom = {
    ...room,
    players: Object.fromEntries(
      Object.entries(room.players).map(([id, p]) => {
        const pub = { ...p };
        const shouldReveal = room.phase === 'game-over' || (room.settings.revealRoleOnDeath && !p.isAlive);
        if (!shouldReveal) {
          delete (pub as Record<string, unknown>).role;
        }
        return [id, pub];
      })
    ),
  };

  return NextResponse.json(publicRoom, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}
