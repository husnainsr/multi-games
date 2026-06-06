'use client';
import { useEffect, useRef } from 'react';
import PusherClient from 'pusher-js';
import type { Channel } from 'pusher-js';

let pusherInstance: PusherClient | null = null;
let currentRoomCode: string | null = null;
let currentPlayerId: string | null = null;

function getPusher(playerId: string, roomCode: string): PusherClient {
  if (!pusherInstance || currentRoomCode !== roomCode || currentPlayerId !== playerId) {
    if (pusherInstance) {
      pusherInstance.disconnect();
    }
    currentRoomCode = roomCode;
    currentPlayerId = playerId;
    pusherInstance = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      channelAuthorization: {
        endpoint: '/api/pusher/auth',
        transport: 'ajax',
        headers: {
          'x-player-id': playerId,
          'x-room-code': roomCode,
        },
      },
    });

    pusherInstance.connection.bind('state_change', (states: { previous: string; current: string }) => {
      console.log('[Pusher] Connection state changed:', states.previous, '->', states.current);
    });

    pusherInstance.connection.bind('error', (err: unknown) => {
      console.error('[Pusher] Connection error:', err);
    });
  }
  return pusherInstance;
}

export function usePusherChannel(
  channelName: string | null,
  handlers: Record<string, (data: unknown) => void>,
  deps: unknown[],
  playerId: string,
  roomCode: string
) {
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!channelName || !playerId || !roomCode) return;

    const pusher = getPusher(playerId, roomCode);
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    Object.entries(handlers).forEach(([event, handler]) => {
      channel.bind(event, handler);
    });

    return () => {
      Object.keys(handlers).forEach(event => channel.unbind(event));
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, playerId, roomCode, ...deps]);

  return channelRef;
}

export function disconnectPusher() {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
  }
}
