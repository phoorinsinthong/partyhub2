/**
 * Avatar System for Party Hub
 * Categorized emoji avatars with color/gradient backgrounds and custom border frames
 */

export const AVATAR_CATEGORIES = {
  animals: {
    label: 'สัตว์เลี้ยง',
    icon: '🐱',
    emojis: [
      '🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🐸', '🐧', '🦄', '🐻',
      '🐹', '🐯', '🦁', '🐮', '🐷', '🐵', '🐲', '🦋', '🐳', '🐙'
    ]
  },
  party: {
    label: 'ปาร์ตี้ & เกม',
    icon: '🎮',
    emojis: [
      '🎸', '🎨', '🎭', '🎪', '🎯', '🎲', '🃏', '👑', '🦸', '🧙',
      '🎮', '👾', '🚀', '🔮', '🏆', '💎', '🔥', '⚡', '🎉', '🍿'
    ]
  },
  food: {
    label: 'อาหาร & ขนม',
    icon: '🍓',
    emojis: [
      '🍓', '🍑', '🍉', '🍍', '🥑', '🍔', '🍕', '🍩', '🍦', '🧋',
      '🍜', '🍱', '🥐', '🍰', '🍡', '🍭', '🌮', '🥨', '🍻', '🍵'
    ]
  },
  fantasy: {
    label: 'แฟนตาซี & ธรรมชาติ',
    icon: '✨',
    emojis: [
      '🌸', '🌻', '🍄', '🌈', '⭐', '🌙', '🌌', '⚡', '🌊', '❄️',
      '🪐', '☄️', '🔮', '🧸', '🎈', '🎀', '💖', '🍀', '🕊️', '🐾'
    ]
  }
};

export const AVATARS = [
  ...AVATAR_CATEGORIES.animals.emojis,
  ...AVATAR_CATEGORIES.party.emojis,
  ...AVATAR_CATEGORIES.food.emojis,
  ...AVATAR_CATEGORIES.fantasy.emojis,
];

// Soft pastel & vibrant gradient background presets
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

export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', // Sunset Pink
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', // Ocean Blue
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)', // Fresh Mint
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)', // Magic Purple
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)', // Lavender Sky
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Neon Rose
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Cyber Cyan
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Warm Peach
];

export const AVATAR_FRAMES = [
  { id: 'none', label: 'ปกติ', icon: '⚪' },
  { id: 'crown', label: 'มงกุฎ', icon: '👑' },
  { id: 'neon', label: 'นีออน', icon: '✨' },
  { id: 'pixel', label: 'พิกเซล', icon: '👾' },
  { id: 'star', label: 'ดาวเด่น', icon: '🌟' }
];

export const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const getRandomAvatar = (takenAvatars = []) => {
  const available = AVATARS.filter(a => !takenAvatars.includes(a));
  if (available.length === 0) return AVATARS[Math.floor(Math.random() * AVATARS.length)];
  return available[Math.floor(Math.random() * available.length)];
};

export const getRandomColor = () => {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
};

export const saveAvatar = (emoji, color, frame = 'none', gradient = '') => {
  localStorage.setItem('avatar', emoji);
  localStorage.setItem('avatarColor', color);
  localStorage.setItem('avatarFrame', frame);
  localStorage.setItem('avatarGradient', gradient);
};

export const loadAvatar = () => {
  return {
    emoji: localStorage.getItem('avatar') || null,
    color: localStorage.getItem('avatarColor') || null,
    frame: localStorage.getItem('avatarFrame') || 'none',
    gradient: localStorage.getItem('avatarGradient') || '',
  };
};
