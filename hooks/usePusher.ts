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
  playerId: string,
  roomCode: string
) {
  // Keep a ref to handlers so Pusher callbacks always call the latest version
  // without needing to re-subscribe when state changes.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!channelName || !playerId || !roomCode) return;

    const pusher = getPusher(playerId, roomCode);
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    // Stable wrapper functions — bound once, always dispatch to latest handler
    const wrappers: Record<string, (data: unknown) => void> = {};
    Object.keys(handlers).forEach(event => {
      wrappers[event] = (data: unknown) => handlersRef.current[event]?.(data);
      channel.bind(event, wrappers[event]);
    });

    return () => {
      Object.entries(wrappers).forEach(([event, fn]) => channel.unbind(event, fn));
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  // handlers is intentionally excluded — we use handlersRef for always-fresh access.
  // Only re-subscribe when the channel identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, playerId, roomCode]);

  return channelRef;
}

export function disconnectPusher() {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
  }
}
