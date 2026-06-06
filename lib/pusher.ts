import Pusher from 'pusher';

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export const PUSHER_EVENTS = {
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  SETTINGS_UPDATED: 'settings-updated',
  PHASE_CHANGED: 'phase-changed',
  VOTE_UPDATE: 'vote-update',
  ROLE_ASSIGNED: 'role-assigned',
  INVESTIGATOR_RESULT: 'investigator-result',
  PLAYER_KICKED: 'player-kicked',
} as const;

export const roomChannel = (code: string) => `room-${code}`;
export const playerChannel = (playerId: string) => `private-player-${playerId}`;
