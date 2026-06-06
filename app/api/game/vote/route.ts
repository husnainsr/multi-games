import { NextRequest, NextResponse } from 'next/server';
import { getRoom, setRoom } from '@/lib/store';
import { pusherServer, roomChannel, PUSHER_EVENTS } from '@/lib/pusher';
import { allVotesSubmitted, processVotes, checkWinCondition, EMPTY_NIGHT_ACTIONS } from '@/lib/game-engine';

export async function POST(req: NextRequest) {
  const { roomCode, playerId, targetId } = await req.json();

  const room = await getRoom(roomCode);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.phase !== 'voting') return NextResponse.json({ error: 'Not voting phase' }, { status: 409 });

  const player = room.players[playerId];
  if (!player?.isAlive) return NextResponse.json({ error: 'Invalid player' }, { status: 403 });

  room.votes[playerId] = targetId ?? null;

  // Broadcast vote update (anonymized - just counts)
  await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.VOTE_UPDATE, {
    votes: room.votes,
  });

  if (allVotesSubmitted(room)) {
    const voteResult = processVotes(room);

    if (voteResult.eliminatedPlayerId) {
      room.players[voteResult.eliminatedPlayerId].isAlive = false;
    }

    room.lastVoteResult = voteResult;
    room.phase = 'vote-result';

    const winner = checkWinCondition(room.players);
    if (winner) {
      room.winner = winner;
      room.phase = 'game-over';
    }

    await setRoom(room);

    if (room.phase === 'game-over') {
      await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
        phase: 'game-over',
        round: room.round,
        winner,
        players: Object.fromEntries(Object.entries(room.players).map(([id, p]) => [id, p])),
      });
    } else {
      await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
        phase: 'vote-result',
        round: room.round,
        voteResult,
      });
    }
  } else {
    await setRoom(room);
  }

  return NextResponse.json({ ok: true });
}
