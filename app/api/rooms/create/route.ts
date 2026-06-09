import { NextRequest, NextResponse } from 'next/server';
import { generateRoomCode, generatePlayerId } from '@/lib/utils';
import { setRoom } from '@/lib/store';
import { DEFAULT_SETTINGS, EMPTY_NIGHT_ACTIONS } from '@/lib/game-engine';
import type { GameRoom, Player } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { hostName } = await req.json();

  if (!hostName?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const code = generateRoomCode();
  const hostId = generatePlayerId();

  const host: Player = {
    id: hostId,
    name: hostName.trim().slice(0, 20),
    avatarIndex: 0,
    role: null,
    isAlive: true,
    isHost: true,
    joinedAt: Date.now(),
  };

  const room: GameRoom = {
    code,
    hostId,
    phase: 'lobby',
    round: 0,
    settings: DEFAULT_SETTINGS,
    players: { [hostId]: host },
    nightActions: { ...EMPTY_NIGHT_ACTIONS },
    votes: {},
    lastDayResult: null,
    lastVoteResult: null,
    winner: null,
    createdAt: Date.now(),
    doctorLastTarget: null,
  };

  await setRoom(room);

  return NextResponse.json({ roomCode: code, playerId: hostId });
}
