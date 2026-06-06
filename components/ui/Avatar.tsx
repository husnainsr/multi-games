'use client';
import { AVATAR_COLORS } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AvatarProps {
  name: string;
  avatarIndex: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isAlive?: boolean;
  isHost?: boolean;
  className?: string;
}

export function Avatar({ name, avatarIndex, size = 'md', isAlive = true, isHost = false, className }: AvatarProps) {
  const color = AVATAR_COLORS[avatarIndex % AVATAR_COLORS.length];
  const initial = name.charAt(0).toUpperCase();

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl',
  };

  return (
    <div className={cn('relative inline-flex flex-shrink-0', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-bold transition-all duration-200',
          sizes[size],
          !isAlive && 'grayscale opacity-50'
        )}
        style={{ backgroundColor: color + '33', border: `2px solid ${color}66`, color }}
      >
        {isAlive ? initial : '💀'}
      </div>
      {isHost && isAlive && (
        <span className="absolute -top-1 -right-1 text-xs">👑</span>
      )}
    </div>
  );
}
