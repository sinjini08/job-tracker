'use client';

import { avatarColor, avatarSrc, initial, isAvatar } from '@/lib/avatars';

// A member's face on the board: the portrait they picked, or, until they pick
// one, the first letter of their name on a colour taken from that name.
//
// A plain <img> rather than next/image: these are small circular PNGs served
// straight from public/, and skipping the optimiser keeps them crisp at the
// handful of sizes the league actually uses.

export default function Avatar({ name, avatar, size = 40, title }) {
  if (!isAvatar(avatar)) {
    return (
      <span className="avatar" title={title}
        style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.4 }}
        aria-hidden>
        {initial(name)}
      </span>
    );
  }
  return (
    <img className="avatar art" src={avatarSrc(avatar)} width={size} height={size}
      style={{ width: size, height: size }} alt={title ?? ''} aria-hidden={title ? undefined : true}
      draggable={false} loading="lazy" decoding="async" />
  );
}
