'use client';
import { motion } from 'framer-motion';
import { Crown, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { AVATAR_COLORS, ROLE_CONFIG } from '@/lib/utils';
import type { Role } from '@/lib/types';

interface GameCardProps {
  player: {
    id: string;
    name: string;
    avatarIndex: number;
    isAlive: boolean;
    isHost: boolean;
  };
  isMe?: boolean;
  revealedRole?: Role | null;
  isLobby?: boolean;
  isInteractive?: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  badge?: string | number;
  onClick?: () => void;
  onKick?: () => void;
  showKickButton?: boolean;
  voteCount?: number;
  isLeading?: boolean;
}

const ROLE_CARD_IMAGES: Record<Role, string> = {
  mafia: '/Mafia_Cards.png',
  doctor: '/Doctor_Cards.png',
  investigator: '/Detective_Cards.png',
  villager: '/Civilian.png',
};

export function GameCard({
  player,
  isMe = false,
  revealedRole = null,
  isLobby = false,
  isInteractive = false,
  isSelected = false,
  disabled = false,
  badge,
  onClick,
  onKick,
  showKickButton = false,
  voteCount = 0,
  isLeading = false,
}: GameCardProps) {
  const avatarColor = AVATAR_COLORS[player.avatarIndex % AVATAR_COLORS.length];
  const isDead = !player.isAlive;
  const isFlipped = !!revealedRole;

  // Role info if revealed
  const roleCfg = revealedRole ? ROLE_CONFIG[revealedRole] : null;

  return (
    <div
      className="relative w-full aspect-[2/3] select-none"
      style={{ perspective: '1200px' }}
    >
      <motion.div
        className="relative w-full h-full shadow-xl"
        style={{
          transformStyle: 'preserve-3d',
          cursor: isInteractive && !disabled && !isDead ? 'pointer' : 'default',
        }}
        animate={{
          rotateY: isFlipped ? 180 : 0,
          scale: isSelected ? 1.02 : 1,
        }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        whileHover={isInteractive && !disabled && !isDead ? { y: -8, scale: 1.02 } : {}}
        onClick={isInteractive && !disabled && !isDead ? onClick : undefined}
      >
        {/* Border glow on selection */}
        {isSelected && (
          <div
            className="absolute inset-0 rounded-2xl border-2 z-30 animate-pulse pointer-events-none"
            style={{
              borderColor: roleCfg?.color || avatarColor,
              boxShadow: `0 0 25px ${(roleCfg?.color || avatarColor)}bf, inset 0 0 15px ${(roleCfg?.color || avatarColor)}80`,
            }}
          />
        )}

        {/* Back Face (Standard card view when faced down) */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden bg-[#0c0c12] border border-gray-800/60"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
          }}
        >
          <img
            src="/backside_card.png"
            alt="Card back"
            className="w-full h-full object-cover opacity-90 transition-transform duration-500"
          />
          {/* Linear gradient at bottom to make name readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent z-10" />

          {/* Card Details */}
          <div className="absolute inset-0 flex flex-col justify-between p-3.5 z-10">
            {/* Top Row Badges */}
            <div className="flex items-start justify-between w-full">
              <div className="flex flex-col gap-1">
                {player.isHost && (
                  <span className="flex items-center gap-1 bg-amber-500/90 text-black border border-amber-400 text-[10px] tracking-wider font-extrabold uppercase px-2 py-0.5 rounded-md shadow-md">
                    <Crown className="w-3 h-3 text-black fill-black" />
                    Host
                  </span>
                )}
                {isMe && (
                  <span className="bg-red-600/90 text-white border border-red-500 text-[10px] tracking-wider font-extrabold uppercase px-2 py-0.5 rounded-md shadow-md w-fit">
                    You
                  </span>
                )}
              </div>

              {/* Kick button */}
              {showKickButton && onKick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onKick();
                  }}
                  className="p-1.5 rounded-lg bg-red-600/90 text-white hover:bg-red-500 border border-red-400 hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer pointer-events-auto"
                  title="Kick player"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Avatar & Player Info */}
            <div className="flex flex-col items-center gap-2 mb-2 w-full">
              <div
                className="relative rounded-full p-1"
                style={{
                  background: `radial-gradient(circle, ${avatarColor}40 0%, transparent 70%)`,
                }}
              >
                <Avatar
                  name={player.name}
                  avatarIndex={player.avatarIndex}
                  size="lg"
                  isAlive={player.isAlive}
                  isHost={false}
                />
              </div>
              <div className="text-center w-full">
                <p className="text-base font-black text-white uppercase tracking-wider truncate drop-shadow-md">
                  {player.name}
                </p>
                <p className="text-[10px] text-gray-400 tracking-widest font-semibold uppercase mt-0.5">
                  {isLobby ? 'Joined' : 'Alive'}
                </p>
              </div>
            </div>
          </div>

          {/* Grayscale overlay & Eliminated banner if dead */}
          {isDead && (
            <div className="absolute inset-0 z-20 bg-black/75 backdrop-grayscale-[80%] flex flex-col items-center justify-center p-3 text-center border border-red-950/40 rounded-2xl">
              <span className="text-3xl mb-1 filter drop-shadow-lg">💀</span>
              <p className="text-sm font-black text-red-500 uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-pulse">
                Eliminated
              </p>
              <div className="h-0.5 w-12 bg-red-600/50 my-1" />
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider truncate max-w-full">
                {player.name}
              </p>
            </div>
          )}
        </div>

        {/* Front Face (Assigned role view when card is flipped) */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden bg-[#0c0c12] border border-gray-800/60"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {roleCfg && (
            <>
              <img
                src={ROLE_CARD_IMAGES[revealedRole as Role]}
                alt={roleCfg.label}
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent z-10" />

              {/* Card Details */}
              <div className="absolute inset-0 flex flex-col justify-between p-3.5 z-10">
                {/* Top Row Badges */}
                <div className="flex items-start justify-between w-full">
                  <span
                    className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shadow-md border"
                    style={{
                      backgroundColor: `${roleCfg.color}d9`,
                      borderColor: roleCfg.color,
                      color: '#fff',
                      boxShadow: `0 0 10px ${roleCfg.color}60`,
                    }}
                  >
                    {roleCfg.label}
                  </span>

                  {isMe && (
                    <span className="bg-red-600/90 text-white border border-red-500 text-[10px] tracking-wider font-extrabold uppercase px-2 py-0.5 rounded-md shadow-md">
                      You
                    </span>
                  )}
                </div>

                {/* Player details overlayed on role */}
                <div className="text-center w-full mb-1">
                  <p className="text-base font-black text-white uppercase tracking-wider truncate drop-shadow-md">
                    {player.name}
                  </p>
                  <p
                    className="text-[10px] tracking-widest font-extrabold uppercase mt-0.5"
                    style={{ color: roleCfg.color }}
                  >
                    {roleCfg.label}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Grayscale overlay & Eliminated banner if dead */}
          {isDead && (
            <div className="absolute inset-0 z-20 bg-black/75 backdrop-grayscale-[80%] flex flex-col items-center justify-center p-3 text-center border border-red-950/40 rounded-2xl">
              <span className="text-3xl mb-1 filter drop-shadow-lg">💀</span>
              <p className="text-sm font-black text-red-500 uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-pulse">
                Eliminated
              </p>
              <div className="h-0.5 w-12 bg-red-600/50 my-1" />
              {roleCfg && (
                <p className="text-xs font-bold uppercase tracking-wider drop-shadow-md" style={{ color: roleCfg.color }}>
                  {roleCfg.label}
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Vote Count Overlay Badge (Renders on top of the card perspective, in 2D) */}
      {voteCount > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 z-40 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white border-2"
          style={{
            backgroundColor: isLeading ? '#ef4444' : '#f59e0b',
            borderColor: isLeading ? '#fca5a5' : '#fde047',
            boxShadow: isLeading
              ? '0 0 15px rgba(239, 68, 68, 0.8), 0 0 5px rgba(0, 0, 0, 0.5)'
              : '0 0 10px rgba(245, 158, 11, 0.6), 0 0 5px rgba(0, 0, 0, 0.5)',
          }}
        >
          {voteCount}
        </motion.div>
      )}

      {/* Action Selection Badge (e.g. Target select checkmark) */}
      {badge && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -left-2 z-40 bg-green-500 border-2 border-green-300 w-7 h-7 rounded-full flex items-center justify-center shadow-lg font-bold text-white text-xs"
        >
          {badge}
        </motion.div>
      )}
    </div>
  );
}
