import { NextRequest, NextResponse } from 'next/server';
import { getRoom, setRoom } from '@/lib/store';
import { pusherServer, roomChannel, playerChannel, PUSHER_EVENTS } from '@/lib/pusher';
import {
  allNightActionsSubmitted,
  processNightActions,
  checkWinCondition,
  EMPTY_NIGHT_ACTIONS,
} from '@/lib/game-engine';
import type { Role } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { roomCode, playerId, targetId } = await req.json();
  // targetId: string | null (null = skip)

  const room = await getRoom(roomCode);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.phase !== 'night') return NextResponse.json({ error: 'Not night phase' }, { status: 409 });

  const player = room.players[playerId];
  if (!player?.isAlive) return NextResponse.json({ error: 'Invalid player' }, { status: 403 });

  const role: Role = player.role!;

  if (role === 'mafia') {
    room.nightActions.mafiaVotes[playerId] = targetId ?? null;
  } else if (role === 'doctor') {
    room.nightActions.doctorTarget = targetId ?? null;
    room.nightActions.doctorSubmitted = true;
  } else if (role === 'investigator') {
    room.nightActions.investigatorTarget = targetId ?? null;
    room.nightActions.investigatorSubmitted = true;
  } else {
    return NextResponse.json({ error: 'No night action for villager' }, { status: 400 });
  }

  // Check if all actions done → auto-advance to day
  if (allNightActionsSubmitted(room)) {
    const dayResult = processNightActions(room);

    // Eliminate player if needed
    if (dayResult.eliminatedPlayerId) {
      room.players[dayResult.eliminatedPlayerId].isAlive = false;
    }

    room.lastDayResult = dayResult;
    room.phase = 'day';
    room.nightActions = { ...EMPTY_NIGHT_ACTIONS };
    room.votes = {};

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
        players: Object.fromEntries(
          Object.entries(room.players).map(([id, p]) => [id, p])
        ),
      });
    } else {
      await pusherServer.trigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
        phase: 'day',
        round: room.round,
        dayResult,
      });

      // Send investigator their result
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
  } else {
    await setRoom(room);
  }

  return NextResponse.json({ ok: true });
}
