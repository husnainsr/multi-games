import type { GameRoom, Player, PublicPlayer, Role, GameSettings, DayResult, VoteResult, Team } from './types';

export const DEFAULT_SETTINGS: GameSettings = {
  mafiaCount: 2,
  hasDoctor: true,
  hasInvestigator: true,
  nightDuration: 60,
  dayDuration: 120,
  voteDuration: 60,
  revealRoleOnDeath: true,
  maxPlayers: 12,
};

export const EMPTY_NIGHT_ACTIONS = {
  mafiaVotes: {} as Record<string, string | null>,
  doctorTarget: null,
  doctorSubmitted: false,
  investigatorTarget: null,
  investigatorSubmitted: false,
};

export function getMinPlayers(settings: GameSettings): number {
  let min = settings.mafiaCount + 2;
  if (settings.hasDoctor) min++;
  if (settings.hasInvestigator) min++;
  return Math.max(min, 4);
}

export function assignRoles(playerIds: string[], settings: GameSettings): Record<string, Role> {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const roles: Record<string, Role> = {};
  let i = 0;

  for (let m = 0; m < settings.mafiaCount && i < shuffled.length; m++) {
    roles[shuffled[i++]] = 'mafia';
  }
  if (settings.hasDoctor && i < shuffled.length) roles[shuffled[i++]] = 'doctor';
  if (settings.hasInvestigator && i < shuffled.length) roles[shuffled[i++]] = 'investigator';
  while (i < shuffled.length) roles[shuffled[i++]] = 'villager';

  return roles;
}

export function checkWinCondition(players: Record<string, Player>): Team | null {
  const alive = Object.values(players).filter(p => p.isAlive);
  const mafiaCount = alive.filter(p => p.role === 'mafia').length;
  const villageCount = alive.filter(p => p.role !== 'mafia').length;
  if (mafiaCount === 0) return 'village';
  if (mafiaCount >= villageCount) return 'mafia';
  return null;
}

export function processNightActions(room: GameRoom): DayResult {
  const { players, nightActions, settings } = room;

  const voteCounts: Record<string, number> = {};
  Object.values(nightActions.mafiaVotes).forEach(targetId => {
    if (targetId) voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  });

  const mafiaTarget = Object.entries(voteCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  if (!mafiaTarget) {
    return { eliminatedPlayerId: null, eliminatedPlayerName: null, eliminatedPlayerRole: null, wasProtected: false };
  }

  const wasProtected = nightActions.doctorTarget === mafiaTarget;
  if (wasProtected) {
    return { eliminatedPlayerId: null, eliminatedPlayerName: null, eliminatedPlayerRole: null, wasProtected: true };
  }

  const eliminated = players[mafiaTarget];
  return {
    eliminatedPlayerId: mafiaTarget,
    eliminatedPlayerName: eliminated?.name ?? null,
    eliminatedPlayerRole: settings.revealRoleOnDeath ? (eliminated?.role ?? null) : null,
    wasProtected: false,
  };
}

export function processVotes(room: GameRoom): VoteResult {
  const { players, votes } = room;
  const voteCounts: Record<string, number> = {};

  Object.entries(votes).forEach(([voterId, targetId]) => {
    if (players[voterId]?.isAlive && targetId) {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }
  });

  if (Object.keys(voteCounts).length === 0) {
    return { eliminatedPlayerId: null, eliminatedPlayerName: null, eliminatedPlayerRole: null, voteCounts, wasTie: false };
  }

  const maxVotes = Math.max(...Object.values(voteCounts));
  const topCandidates = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
  const wasTie = topCandidates.length > 1;

  if (wasTie) {
    return { eliminatedPlayerId: null, eliminatedPlayerName: null, eliminatedPlayerRole: null, voteCounts, wasTie };
  }

  const eliminatedId = topCandidates[0];
  const eliminated = players[eliminatedId];
  return {
    eliminatedPlayerId: eliminatedId,
    eliminatedPlayerName: eliminated?.name ?? null,
    eliminatedPlayerRole: room.settings.revealRoleOnDeath ? (eliminated?.role ?? null) : null,
    voteCounts,
    wasTie: false,
  };
}

export function allNightActionsSubmitted(room: GameRoom): boolean {
  const { players, nightActions, settings } = room;
  const alivePlayers = Object.values(players).filter(p => p.isAlive);

  const aliveMafia = alivePlayers.filter(p => p.role === 'mafia');
  if (aliveMafia.length > 0) {
    const anyMafiaVoted = aliveMafia.some(p => p.id in nightActions.mafiaVotes);
    if (!anyMafiaVoted) return false;
  }

  const aliveDoctor = alivePlayers.find(p => p.role === 'doctor');
  if (aliveDoctor && settings.hasDoctor && !nightActions.doctorSubmitted) return false;

  const aliveInvestigator = alivePlayers.find(p => p.role === 'investigator');
  if (aliveInvestigator && settings.hasInvestigator && !nightActions.investigatorSubmitted) return false;

  return true;
}

export function allVotesSubmitted(room: GameRoom): boolean {
  const alivePlayers = Object.values(room.players).filter(p => p.isAlive);
  return alivePlayers.every(p => p.id in room.votes);
}

export function toPublicPlayer(player: Player, revealRole = false): PublicPlayer {
  const pub: PublicPlayer = {
    id: player.id,
    name: player.name,
    avatarIndex: player.avatarIndex,
    isAlive: player.isAlive,
    isHost: player.isHost,
    joinedAt: player.joinedAt,
  };
  if (revealRole && player.role) pub.role = player.role;
  return pub;
}
