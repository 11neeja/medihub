"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  getAvatarFallbackForUser,
  getAvatarImageForUser,
} from "@/components/avatars/avatarData"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
  userId: string
  name?: string
  size?: number
  className?: string
}

export function UserAvatar({
  userId,
  name,
  size = 40,
  className,
}: UserAvatarProps) {
  const imageUrl = getAvatarImageForUser(userId, name)
  const fallback = getAvatarFallbackForUser(userId, name)

  return (
    <Avatar
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <AvatarImage
        src={imageUrl}
        alt={name ? `${name} avatar` : "User avatar"}
      />
      <AvatarFallback className="text-xs bg-[var(--color-accent-soft)] text-[var(--color-blue-primary)] font-semibold">
        {fallback}
      </AvatarFallback>
    </Avatar>
  )
}
