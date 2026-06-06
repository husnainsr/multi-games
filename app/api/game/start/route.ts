import { NextRequest, NextResponse } from 'next/server';
import { getRoom, setRoom } from '@/lib/store';
import { pusherServer, roomChannel, playerChannel, PUSHER_EVENTS } from '@/lib/pusher';
import { assignRoles, getMinPlayers, EMPTY_NIGHT_ACTIONS } from '@/lib/game-engine';
import { AVATAR_COLORS } from '@/lib/utils';
import type { PublicPlayer } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { roomCode, playerId } = await req.json();

  const room = await getRoom(roomCode);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.hostId !== playerId) return NextResponse.json({ error: 'Not host' }, { status: 403 });
  if (room.phase !== 'lobby') return NextResponse.json({ error: 'Already started' }, { status: 409 });

  const playerIds = Object.keys(room.players);
  const minPlayers = getMinPlayers(room.settings);

  if (playerIds.length < minPlayers) {
    return NextResponse.json({ error: `Need at least ${minPlayers} players` }, { status: 400 });
  }

  // Assign avatars by join order
  const sortedPlayerIds = playerIds.sort(
    (a, b) => room.players[a].joinedAt - room.players[b].joinedAt
  );
  sortedPlayerIds.forEach((id, i) => {
    room.players[id].avatarIndex = i % AVATAR_COLORS.length;
  });

  // Assign roles
  const roles = assignRoles(playerIds, room.settings);
  Object.entries(roles).forEach(([id, role]) => {
    room.players[id].role = role;
  });

  room.phase = 'starting';
  room.round = 1;
  room.nightActions = { ...EMPTY_NIGHT_ACTIONS };
  room.votes = {};
  room.lastDayResult = null;
  room.lastVoteResult = null;
  room.winner = null;

  await setRoom(room);

  // Broadcast game started
  await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
    phase: 'starting',
    round: 1,
  });

  // Send each player their role privately
  const mafiaPlayers: PublicPlayer[] = Object.values(room.players)
    .filter(p => p.role === 'mafia')
    .map(p => ({
      id: p.id,
      name: p.name,
      avatarIndex: p.avatarIndex,
      isAlive: p.isAlive,
      isHost: p.isHost,
      joinedAt: p.joinedAt,
    }));

  const roleEvents = Object.values(room.players).map(player =>
    pusherServer.trigger(playerChannel(player.id), PUSHER_EVENTS.ROLE_ASSIGNED, {
      role: player.role,
      teammates: player.role === 'mafia' ? mafiaPlayers.filter(m => m.id !== player.id) : [],
    })
  );

  await Promise.all(roleEvents);

  return NextResponse.json({ ok: true });
}
