/**
 * Avatar System for Party Hub (Neon Pixel Edition)
 * Uses DiceBear Pixel Art for premium retro feel.
 */

// Generate a random seed for the pixel art
export const generateRandomSeed = () => {
  return Math.random().toString(36).substring(2, 8);
};

// Get the DiceBear SVG URL for a given seed
export const getAvatarUrl = (seed) => {
  if (!seed) return '';
  // You can also use other styles like 'bottts' or 'adventurer'
  return `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
};

// Neon Gradient background presets for avatars
export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #b829ea 0%, #ff1493 100%)', // Neon Purple -> Pink
  'linear-gradient(135deg, #00f0ff 0%, #b829ea 100%)', // Neon Blue -> Purple
  'linear-gradient(135deg, #39ff14 0%, #00f0ff 100%)', // Neon Green -> Blue
  'linear-gradient(135deg, #ff5e00 0%, #ff1493 100%)', // Neon Orange -> Pink
  'linear-gradient(135deg, #ccff00 0%, #39ff14 100%)', // Neon Yellow -> Green
  'linear-gradient(135deg, #ff1493 0%, #00f0ff 100%)', // Cyberpunk Pink/Blue
];

export const getRandomGradient = () => {
  return AVATAR_GRADIENTS[Math.floor(Math.random() * AVATAR_GRADIENTS.length)];
};

export const saveAvatar = (seed, gradient) => {
  localStorage.setItem('avatarSeed', seed);
  localStorage.setItem('avatarGradient', gradient);
  // Backwards compatibility with old system so it doesn't break everything instantly
  localStorage.setItem('avatar', seed); 
};

export const loadAvatar = () => {
  const seed = localStorage.getItem('avatarSeed') || localStorage.getItem('avatar');
  return {
    seed: seed || null,
    gradient: localStorage.getItem('avatarGradient') || '',
  };
};
