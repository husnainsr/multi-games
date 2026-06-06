import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';
import { getRoom } from '@/lib/store';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);

  const socketId = params.get('socket_id');
  const channelName = params.get('channel_name');
  const playerId = req.headers.get('x-player-id');
  const roomCode = req.headers.get('x-room-code');

  if (!socketId || !channelName || !playerId || !roomCode) {
    return NextResponse.json({ error: 'Missing auth params' }, { status: 400 });
  }

  const room = await getRoom(roomCode.toUpperCase());
  if (!room || !room.players[playerId]) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
