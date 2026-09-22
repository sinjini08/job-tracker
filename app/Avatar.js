'use client';

import { AVATARS, avatarColor, initial } from '@/lib/avatars';

// A member's face on the board: their chosen emoji, or the first letter of
// their name on a colour picked from that name.
export default function Avatar({ name, avatar, size = 40, ring }) {
  const glyph = AVATARS.includes(avatar) ? avatar : null;
  return (
    <span
      className={`avatar ${ring ? `ring-${ring}` : ''}`}
      style={{
        width: size,
        height: size,
        background: avatarColor(name),
        fontSize: glyph ? size * 0.52 : size * 0.4,
      }}
      aria-hidden
    >
      {glyph ?? initial(name)}
    </span>
  );
}
