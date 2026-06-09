export type Role = 'mafia' | 'doctor' | 'investigator' | 'villager';
export type GamePhase = 'lobby' | 'starting' | 'night' | 'day' | 'voting' | 'vote-result' | 'game-over';
export type Team = 'mafia' | 'village';

export interface Player {
  id: string;
  name: string;
  avatarIndex: number;
  role: Role | null;
  isAlive: boolean;
  isHost: boolean;
  joinedAt: number;
}

export type PublicPlayer = Omit<Player, 'role'> & { role?: Role };

export interface GameSettings {
  mafiaCount: number;
  hasDoctor: boolean;
  hasInvestigator: boolean;
  nightDuration: number; // seconds; 0 = unlimited
  dayDuration: number;
  voteDuration: number;
  revealRoleOnDeath: boolean;
  maxPlayers: number;
}

export interface NightActions {
  mafiaVotes: Record<string, string | null>; // mafiaPlayerId -> targetId | null (skip)
  doctorTarget: string | null;
  doctorSubmitted: boolean;
  investigatorTarget: string | null;
  investigatorSubmitted: boolean;
}

export interface DayResult {
  eliminatedPlayerId: string | null;
  eliminatedPlayerName: string | null;
  eliminatedPlayerRole: Role | null;
  wasProtected: boolean;
}

export interface VoteResult {
  eliminatedPlayerId: string | null;
  eliminatedPlayerName: string | null;
  eliminatedPlayerRole: Role | null;
  voteCounts: Record<string, number>;
  wasTie: boolean;
}

export interface GameRoom {
  code: string;
  hostId: string;
  phase: GamePhase;
  round: number;
  settings: GameSettings;
  players: Record<string, Player>;
  nightActions: NightActions;
  votes: Record<string, string | null>; // voterId -> targetId | null (skip)
  lastDayResult: DayResult | null;
  lastVoteResult: VoteResult | null;
  winner: Team | null;
  createdAt: number;
  doctorLastTarget: string | null; // doctor cannot protect same player two rounds in a row
}

// Pusher event payloads
export interface PusherPlayerJoined { player: PublicPlayer }
export interface PusherPlayerLeft { playerId: string }
export interface PusherSettingsUpdated { settings: GameSettings }
export interface PusherVoteUpdate { votes: Record<string, string | null> }
export interface PusherRoleAssigned { role: Role; teammates: PublicPlayer[] }
export interface PusherInvestigatorResult {
  round: number;
  targetId: string;
  targetName: string;
  isMafia: boolean;
  targetRole: Role;
}
export interface PusherPhaseChanged {
  phase: GamePhase;
  round: number;
  dayResult?: DayResult;
  voteResult?: VoteResult;
  players?: Record<string, PublicPlayer>;
  winner?: Team;
}
