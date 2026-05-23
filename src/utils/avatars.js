/**
 * Avatar System for Party Hub
 * Cute emoji-based avatars with color backgrounds
 */

// 40 cute avatar options organized by category
export const AVATARS = [
  // Animals
  '🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🐸', '🐧', '🦄', '🐻',
  '🐹', '🐯', '🦁', '🐮', '🐷', '🐵', '🐲', '🦋', '🐳', '🐙',
  // Food & Nature
  '🍓', '🍑', '🌸', '🌻', '🍄', '🌈', '⭐', '🌙', '🔥', '💎',
  // Fun & Party
  '🎸', '🎨', '🎭', '🎪', '🎯', '🎲', '🃏', '👑', '🦸', '🧙',
];

// Soft pastel background colors for avatars
export const AVATAR_COLORS = [
  '#f0a8a8', // soft red
  '#f0c4a8', // soft peach
  '#f0dda8', // soft yellow
  '#c8e6a8', // soft green
  '#a8d8c8', // soft teal
  '#a8c8e6', // soft blue
  '#b8a8e6', // soft purple
  '#daa8e6', // soft pink
  '#e6a8c8', // soft rose
  '#a8c8b8', // soft mint
  '#c8b8a8', // soft tan
  '#e6c8a8', // soft sand
];

/**
 * Get a deterministic color for a given name (fallback when no avatar color selected)
 */
export const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

/**
 * Get a random avatar that isn't already taken
 */
export const getRandomAvatar = (takenAvatars = []) => {
  const available = AVATARS.filter(a => !takenAvatars.includes(a));
  if (available.length === 0) return AVATARS[Math.floor(Math.random() * AVATARS.length)];
  return available[Math.floor(Math.random() * available.length)];
};

/**
 * Get a random color
 */
export const getRandomColor = () => {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
};

/**
 * Save avatar to localStorage
 */
export const saveAvatar = (emoji, color) => {
  localStorage.setItem('avatar', emoji);
  localStorage.setItem('avatarColor', color);
};

/**
 * Load avatar from localStorage
 */
export const loadAvatar = () => {
  return {
    emoji: localStorage.getItem('avatar') || null,
    color: localStorage.getItem('avatarColor') || null,
  };
};
