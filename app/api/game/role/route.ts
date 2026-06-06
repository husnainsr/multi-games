import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Called by the game page on load to get the player's role.
// This handles the Pusher race condition where role-assigned events
// are sent before clients subscribe to their private channels.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get('roomCode');
  const playerId = searchParams.get('playerId');

  if (!roomCode || !playerId) {
    return NextResponse.json(
      { error: 'Missing params' },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }

  const room = await getRoom(roomCode.toUpperCase());
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

  const player = room.players[playerId];
  if (!player) {
    return NextResponse.json(
      { error: 'Player not found' },
      {
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }
  if (!player.role) {
    return NextResponse.json(
      { error: 'Role not yet assigned' },
      {
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }

  const teammates =
    player.role === 'mafia'
      ? Object.values(room.players)
          .filter(p => p.role === 'mafia' && p.id !== playerId)
          .map(p => ({
            id: p.id,
            name: p.name,
            avatarIndex: p.avatarIndex,
            isAlive: p.isAlive,
            isHost: p.isHost,
            joinedAt: p.joinedAt,
          }))
      : [];

  return NextResponse.json(
    { role: player.role, teammates },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
}
