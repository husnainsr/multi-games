import { NextRequest, NextResponse } from 'next/server';
import { getRoom, setRoom } from '@/lib/store';
import { safeTrigger, roomChannel, playerChannel, PUSHER_EVENTS } from '@/lib/pusher';
import {
  allNightActionsSubmitted,
  processNightActions,
  checkWinCondition,
  EMPTY_NIGHT_ACTIONS,
} from '@/lib/game-engine';
import type { Role } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { roomCode, playerId, targetId } = await req.json();

  const room = await getRoom(roomCode);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.phase !== 'night') return NextResponse.json({ error: 'Not night phase' }, { status: 409 });

  const player = room.players[playerId];
  if (!player?.isAlive) return NextResponse.json({ error: 'Invalid player' }, { status: 403 });

  const role: Role = player.role!;

  if (role === 'mafia') {
    room.nightActions.mafiaVotes[playerId] = targetId ?? null;
  } else if (role === 'doctor') {
    if (targetId && targetId === room.doctorLastTarget) {
      return NextResponse.json({ error: 'You cannot protect the same person two rounds in a row' }, { status: 400 });
    }
    room.nightActions.doctorTarget = targetId ?? null;
    room.nightActions.doctorSubmitted = true;
  } else if (role === 'investigator') {
    room.nightActions.investigatorTarget = targetId ?? null;
    room.nightActions.investigatorSubmitted = true;
  } else {
    return NextResponse.json({ error: 'No night action for villager' }, { status: 400 });
  }

  if (allNightActionsSubmitted(room)) {
    const dayResult = processNightActions(room);
    if (dayResult.eliminatedPlayerId) room.players[dayResult.eliminatedPlayerId].isAlive = false;

    const savedInvestigatorTarget = room.nightActions.investigatorTarget;
    const savedDoctorTarget = room.nightActions.doctorTarget;
    room.lastDayResult = dayResult;
    room.phase = 'day';
    room.nightActions = { ...EMPTY_NIGHT_ACTIONS };
    room.doctorLastTarget = savedDoctorTarget;
    room.votes = {};

    const winner = checkWinCondition(room.players);
    if (winner) { room.winner = winner; room.phase = 'game-over'; }

    await setRoom(room);

    if (room.phase === 'game-over') {
      await safeTrigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, {
        phase: 'game-over', round: room.round, winner,
        players: Object.fromEntries(Object.entries(room.players).map(([id, p]) => [id, p])),
      });
    } else {
      await safeTrigger(roomChannel(roomCode), PUSHER_EVENTS.PHASE_CHANGED, { phase: 'day', round: room.round, dayResult });

      if (savedInvestigatorTarget) {
        const investigator = Object.values(room.players).find(p => p.role === 'investigator' && p.isAlive);
        const target = room.players[savedInvestigatorTarget];
        if (investigator && target) {
          await safeTrigger(playerChannel(investigator.id), PUSHER_EVENTS.INVESTIGATOR_RESULT, {
            round: room.round, targetId: target.id, targetName: target.name, isMafia: target.role === 'mafia',
          });
        }
      }
    }
  } else {
    await setRoom(room);
  }

  return NextResponse.json({ ok: true });
}
