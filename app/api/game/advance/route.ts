import { NextRequest, NextResponse } from 'next/server';
import { getRoom, setRoom } from '@/lib/store';
import { pusherServer, roomChannel, playerChannel, PUSHER_EVENTS } from '@/lib/pusher';
import {
  processNightActions,
  processVotes,
  checkWinCondition,
  EMPTY_NIGHT_ACTIONS,
} from '@/lib/game-engine';

export async function POST(req: NextRequest) {
  const { roomCode, playerId, fromPhase } = await req.json();

  const room = await getRoom(roomCode);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  // Idempotency: only advance if still in the expected phase
  if (room.phase !== fromPhase) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const player = room.players[playerId];
  if (!player) return NextResponse.json({ error: 'Invalid player' }, { status: 403 });

  switch (room.phase) {
    case 'starting': {
      room.phase = 'night';
      room.nightActions = { ...EMPTY_NIGHT_ACTIONS };
      await setRoom(room);
      await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
        phase: 'night',
        round: room.round,
      });
      break;
    }

    case 'night': {
      const dayResult = processNightActions(room);
      if (dayResult.eliminatedPlayerId) {
        room.players[dayResult.eliminatedPlayerId].isAlive = false;
      }
      room.lastDayResult = dayResult;
      room.phase = 'day';
      room.nightActions = { ...EMPTY_NIGHT_ACTIONS };

      const nightWinner = checkWinCondition(room.players);
      if (nightWinner) {
        room.winner = nightWinner;
        room.phase = 'game-over';
      }

      await setRoom(room);

      if (room.phase === 'game-over') {
        await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
          phase: 'game-over',
          round: room.round,
          winner: nightWinner,
          players: Object.fromEntries(Object.entries(room.players).map(([id, p]) => [id, p])),
        });
      } else {
        await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
          phase: 'day',
          round: room.round,
          dayResult,
        });

        // Send investigator result
        if (room.nightActions.investigatorTarget) {
          const investigator = Object.values(room.players).find(p => p.role === 'investigator' && p.isAlive);
          const target = room.players[room.nightActions.investigatorTarget];
          if (investigator && target) {
            await pusherServer.trigger(playerChannel(investigator.id), PUSHER_EVENTS.INVESTIGATOR_RESULT, {
              round: room.round,
              targetId: target.id,
              targetName: target.name,
              isMafia: target.role === 'mafia',
            });
          }
        }
      }
      break;
    }

    case 'day': {
      room.phase = 'voting';
      room.votes = {};
      await setRoom(room);
      await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
        phase: 'voting',
        round: room.round,
      });
      break;
    }

    case 'voting': {
      const voteResult = processVotes(room);
      if (voteResult.eliminatedPlayerId) {
        room.players[voteResult.eliminatedPlayerId].isAlive = false;
      }
      room.lastVoteResult = voteResult;
      room.phase = 'vote-result';

      const voteWinner = checkWinCondition(room.players);
      if (voteWinner) {
        room.winner = voteWinner;
        room.phase = 'game-over';
      }

      await setRoom(room);

      if (room.phase === 'game-over') {
        await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
          phase: 'game-over',
          round: room.round,
          winner: voteWinner,
          players: Object.fromEntries(Object.entries(room.players).map(([id, p]) => [id, p])),
        });
      } else {
        await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
          phase: 'vote-result',
          round: room.round,
          voteResult,
        });
      }
      break;
    }

    case 'vote-result': {
      // Next round
      room.round += 1;
      room.phase = 'night';
      room.nightActions = { ...EMPTY_NIGHT_ACTIONS };
      room.votes = {};
      room.lastVoteResult = null;
      await setRoom(room);
      await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
        phase: 'night',
        round: room.round,
      });
      break;
    }

    case 'game-over': {
      // Reset game back to lobby (play again)
      room.phase = 'lobby';
      room.round = 0;
      room.winner = null;
      room.nightActions = { ...EMPTY_NIGHT_ACTIONS };
      room.votes = {};
      room.lastDayResult = null;
      room.lastVoteResult = null;
      Object.values(room.players).forEach(p => {
        p.role = null;
        p.isAlive = true;
      });
      await setRoom(room);
      await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
        phase: 'lobby',
        round: 0,
      });
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
