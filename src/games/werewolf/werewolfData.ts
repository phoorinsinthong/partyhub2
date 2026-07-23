// @ts-nocheck
export const VOICE_SCRIPTS: Record<string, string> = {
  werewolf: "หมาป่า ลืมตาขึ้นมา... เลือกเหยื่อของคุณ",
  seer: "เทพพยากรณ์ ลืมตาขึ้นมา... เลือกตรวจสอบผู้เล่น 1 คน",
  bodyguard: "บอดี้การ์ด ลืมตาขึ้นมา... เลือกผู้เล่นที่คุณต้องการปกป้อง",
  cupid: "กามเทพ ลืมตาขึ้นมา... เลือกผู้เล่น 2 คนให้เป็นคู่รักกัน (เฉพาะคืนแรก)",
  witch: "แม่มด ลืมตาขึ้นมา... คุณต้องการใช้ยาชุบชีวิตหรือยาพิษหรือไม่?",
  spellcaster: "ผู้ร่ายเวทย์ ลืมตาขึ้นมา... เลือกผู้เล่น 1 คนที่คุณต้องการปิดปาก",
  old_hag: "หญิงชรา ลืมตาขึ้นมา... เลือกผู้เล่น 1 คนที่คุณต้องการแบนจากการโหวต",
  serial_killer: "ฆาตกรต่อเนื่อง ลืมตาขึ้นมา... เลือกเหยื่อที่คุณต้องการสังหาร",
};

export const ROLES: Record<string, {
  name: string;
  icon: string;
  team: string;
  color: string;
  actionPhase: string;
  actionType?: string;
  description: string;
}> = {
  // VILLAGER TEAM
  villager: { name: "ชาวบ้าน", icon: "🏘️", team: "villager", color: "#f59e0b", actionPhase: "none", description: "ไม่มีพลังพิเศษ โหวตไล่หมาป่าในตอนกลางวัน" },
  seer: { name: "เทพพยากรณ์", icon: "🔮", team: "villager", color: "#a78bfa", actionPhase: "nightly", actionType: "target", description: "ในแต่ละคืน เลือกตรวจผู้เล่น 1 คนว่าเป็นหมาป่าหรือไม่" },
  apprentice_seer: { name: "หมอดูฝึกหัด", icon: "👓", team: "villager", color: "#8b5cf6", actionPhase: "nightly", actionType: "target", description: "เป็นชาวบ้านจนกว่าหมอดูจริงจะตาย จึงจะได้รับพลังหมอดูมาแทน" },
  aura_seer: { name: "ผู้หยั่งรู้ออร่า", icon: "✨", team: "villager", color: "#c4b5fd", actionPhase: "nightly", actionType: "target", description: "ตื่นตอนกลางคืนเพื่อตรวจสอบว่าผู้เล่น 1 คนมีบทบาทพิเศษหรือไม่" },
  beholder: { name: "ผู้สังเกตการณ์", icon: "👁️", team: "villager", color: "#7c3aed", actionPhase: "none", description: "ลืมตาในคืนแรกเพื่อดูว่าใครคือหมอดู" },
  bodyguard: { name: "บอดี้การ์ด", icon: "🛡️", team: "villager", color: "#10b981", actionPhase: "nightly", actionType: "target", description: "ปกป้องผู้เล่น 1 คนต่อคืน (ห้ามป้องกันคนเดิมซ้ำติดกัน 2 คืน)" },
  cupid: { name: "กามเทพ", icon: "💘", team: "villager", color: "#f43f5e", actionPhase: "firstNight", actionType: "target2", description: "คืนแรกเลือก 2 คนให้เป็นคู่รัก หากตาย 1 คน อีกคนจะตายตาม" },
  diseased: { name: "ผู้ป่วย", icon: "🤒", team: "villager", color: "#84cc16", actionPhase: "none", description: "หากถูกหมาป่ากัด หมาป่าจะติดเชื้อและล่าใครไม่ได้ในคืนถัดไป" },
  drunk: { name: "คนเมา", icon: "🍺", team: "villager", color: "#fde047", actionPhase: "none", description: "ไม่รู้บทบาทที่แท้จริงจนกว่าจะถึงคืนที่ 3" },
  ghost: { name: "ผี", icon: "👻", team: "villager", color: "#d1d5db", actionPhase: "none", description: "จะถูกฆ่าตายในคืนแรก แต่สามารถส่งข้อความใบ้ 1 ตัวอักษร/วันได้" },
  hunter: { name: "พรานป่า", icon: "🔫", team: "villager", color: "#ea580c", actionPhase: "none", description: "เมื่อตายสามารถลากผู้เล่นคนอื่นให้ตายตามไปด้วย 1 คน" },
  idiot: { name: "คนโง่", icon: "🤪", team: "villager", color: "#fb923c", actionPhase: "none", description: "รู้ว่าใครเป็นหมาป่าในคืนแรก แต่ห้ามออกเสียงโหวตเด็ดขาด" },
  insomniac: { name: "คนนอนไม่หลับ", icon: "🦉", team: "villager", color: "#6b7280", actionPhase: "nightly", actionType: "none", description: "ตื่นกลางคืนเพื่อดูว่าใครลุกจากเตียงบ้าง (ทำ Activity กลางคืน)" },
  lycan: { name: "ลูกครึ่งหมาป่า", icon: "🐺", team: "villager", color: "#991b1b", actionPhase: "none", description: "เป็นชาวบ้าน แต่ถ้าหมอดูส่องจะเห็นเป็นหมาป่า" },
  magician: { name: "นักมายากล", icon: "🎩", team: "villager", color: "#d946ef", actionPhase: "nightly", actionType: "target", description: "สลับการ์ดของผู้เล่นอื่น 1 ครั้งต่อเกม" },
  martyr: { name: "ผู้พลีชีพ", icon: "🙏", team: "villager", color: "#b91c1c", actionPhase: "none", description: "รับผลโหวตประหารและตายแทนคนอื่นในตอนเช้าได้" },
  mason: { name: "ช่างก่อสร้าง", icon: "🧱", team: "villager", color: "#9ca3af", actionPhase: "none", description: "ลืมตาคืนแรกเพื่อมองหาเพื่อน Mason ด้วยกัน" },
  mayor: { name: "นายกเทศมนตรี", icon: "🏵️", team: "villager", color: "#fcd34d", actionPhase: "none", description: "เสียงโหวตแขวนคอของคุณนับเป็น 2 เสียง" },
  old_hag: { name: "หญิงชรา", icon: "👵", team: "villager", color: "#4b5563", actionPhase: "nightly", actionType: "target", description: "แบนไม่ให้ผู้เล่น 1 คนมีสิทธิ์โหวตในวันถัดไป" },
  old_man: { name: "ชายชรา", icon: "👴", team: "villager", color: "#6b7280", actionPhase: "none", description: "ตายโดยธรรมชาติในคืนที่ จำนวนหมาป่า + 1" },
  pacifist: { name: "ผู้รักสงบ", icon: "🕊️", team: "villager", color: "#34d399", actionPhase: "none", description: "ต้องโหวต 'ให้รอด' เสมอ ห้ามโหวตแขวนคอเด็ดขาด" },
  pi: { name: "นักสืบเอกชน", icon: "🕵️", team: "villager", color: "#6366f1", actionPhase: "nightly", actionType: "target", description: "ใช้ 1 ครั้งต่อเกม ตรวจสอบเป้าหมายและคนข้างเคียงว่ามีหมาป่าหรือไม่" },
  priest: { name: "นักบวช", icon: "📿", team: "villager", color: "#fcd34d", actionPhase: "nightly", actionType: "target", description: "ใช้ 1 ครั้งต่อเกม สาดน้ำมนต์ ใครเป็นหมาป่าโดนเข้าไปจะตายทันที" },
  prince: { name: "เจ้าชาย", icon: "👑", team: "villager", color: "#fbbf24", actionPhase: "none", description: "หากถูกโหวตตาย จะรอดชีวิตจากการถูกแขวนคอ 1 ครั้ง" },
  spellcaster: { name: "ผู้ร่ายเวทย์", icon: "🤐", team: "villager", color: "#8b5cf6", actionPhase: "nightly", actionType: "target", description: "ปิดปากผู้เล่น 1 คนกลางคืน ทำให้ตอนเช้าห้ามพูดและห้ามออกเสียง" },
  tough_guy: { name: "จอมอึด", icon: "💪", team: "villager", color: "#b45309", actionPhase: "none", description: "ทนทานการกัดของหมาป่าได้ 1 วัน ค่อยไปขาดใจตายเอาในคืนถัดไป" },
  troublemaker: { name: "ตัวป่วน", icon: "🤪", team: "villager", color: "#f43f5e", actionPhase: "firstNight", actionType: "target2", description: "สลับบทบาทของผู้เล่น 2 คนในคืนแรก" },
  witch: { name: "แม่มด", icon: "🧹", team: "villager", color: "#d946ef", actionPhase: "nightly", actionType: "extra", description: "มียาชุบชีวิต 1 ขวด และยาพิษ 1 ขวด (ใช้อย่างละ 1 ครั้ง)" },

  // WEREWOLF TEAM
  werewolf: { name: "มนุษย์หมาป่า", icon: "🐺", team: "werewolf", color: "#ef4444", actionPhase: "nightly", actionType: "target", description: "ร่วมมือกับหมาป่าตัวอื่นโหวตล่าเหยื่อตอนกลางคืน" },
  alpha_wolf: { name: "จ่าฝูงหมาป่า", icon: "👑🐺", team: "werewolf", color: "#b91c1c", actionPhase: "nightly", actionType: "target", description: "ถ้าตาย ฝูงหมาป่าจะเสียขวัญไม่ออกล่าเหยื่อ 1 คืน" },
  dire_wolf: { name: "หมาป่าโลกันต์", icon: "🔥🐺", team: "werewolf", color: "#dc2626", actionPhase: "firstNight", actionType: "target", description: "คืนแรกสาบานตนคู่กับสหาย 1 คน หากสหายตาย คุณตายด้วย" },
  lone_wolf: { name: "หมาป่าเดียวดาย", icon: "👤🐺", team: "werewolf", color: "#7f1d1d", actionPhase: "nightly", actionType: "target", description: "ชนะก็ต่อเมื่อเป็นหมาป่าตัวสุดท้ายที่รอดชีวิต" },
  minion: { name: "สมุนหมาป่า", icon: "🦹", team: "werewolf", color: "#9f1239", actionPhase: "none", description: "รู้ว่าหมาป่าคือใคร ป่วนโหวต และทดสอบเป็นชาวบ้านให้หมอดูเห็น" },
  mystic_wolf: { name: "หมาป่าผู้หยั่งรู้", icon: "👁️🐺", team: "werewolf", color: "#4f46e5", actionPhase: "nightly", actionType: "target", description: "สามารถออกส่องบทบาทที่แท้จริงของผู้เล่น 1 คนได้เหมือนหมอดู" },
  sorceress: { name: "แม่มดแห่งความมืด", icon: "🔮🐺", team: "werewolf", color: "#6366f1", actionPhase: "nightly", actionType: "target", description: "ตื่นมาทายหาหมอดู (ส่องดูเพื่อหาว่าใครคือหมอดู)" },
  wolf_cub: { name: "ลูกหมาป่า", icon: "🐾🐺", team: "werewolf", color: "#f87171", actionPhase: "nightly", actionType: "target", description: "หากตาย คืนถัดไปหมาป่าจะโกรธแค้นและล่าเหยื่อได้ถึง 2 คน" },
  wolf_man: { name: "หมาป่ามนุษย์", icon: "🤵🐺", team: "werewolf", color: "#b91c1c", actionPhase: "nightly", actionType: "target", description: "ถ้าหมอดูส่อง จะเห็นคุณเป็นชาวบ้านธรรมดา" },

  // INDEPENDENT TEAM
  cursed: { name: "ผู้ต้องสาป", icon: "🧟", team: "independent", color: "#6b7280", actionPhase: "none", description: "เมื่อโดนหมาป่ากัดจะไม่ตาย แต่กลับกลายเป็น 1 ในฝูงหมาป่าแทน" },
  doppelganger: { name: "ดอปเปลแกงเกอร์", icon: "👥", team: "independent", color: "#10b981", actionPhase: "firstNight", actionType: "target", description: "คืนแรกลึงตาเลือกเป้าหมาย เมื่อเป้าหมายตาย คุณจะสวมบทบาทแทน" },
  chupacabra: { name: "ชูปาคาบรา", icon: "🦇", team: "independent", color: "#065f46", actionPhase: "nightly", actionType: "target", description: "ฆ่าคืนละคน ถ้าฆ่าโดนหมาป่า หมาป่าจะตาย (ฆ่าคนธรรมดาไม่ตาย)" },
  cult_leader: { name: "เจ้าลัทธิ", icon: "🛐", team: "independent", color: "#8b5cf6", actionPhase: "nightly", actionType: "target", description: "ดึงคนเข้าลัทธิคืนละ 1 คน ชนะทันทีเมื่อมีเพื่อนร่วมลัทธิทุกคน" },
  hoodlum: { name: "นักเลง", icon: "🚬", team: "independent", color: "#475569", actionPhase: "firstNight", actionType: "target2", description: "เลือก 2 คนในคืนแรก ชนะถ้า 2 คนนั้นตายก่อนกติกาจบ" },
  serial_killer: { name: "ฆาตกรต่อเนื่อง", icon: "🔪", team: "independent", color: "#dc2626", actionPhase: "nightly", actionType: "target", description: "ในแต่ละคืนตื่นมาลอบฆ่าใครก็ได้ ชนะเมื่อรอดเป็นคนสุดท้าย" },
  tanner: { name: "ยาจก", icon: "😤", team: "independent", color: "#ca8a04", actionPhase: "none", description: "ชนะเพียงคนเดียวเมื่อยุยงให้ทุกคนโหวตประหารตัวเองเอาไว้ได้" },
  vampire: { name: "แวมไพร์", icon: "🧛", team: "independent", color: "#9f1239", actionPhase: "nightly", actionType: "target", description: "กัดคืนละคน เหยื่อจะเป็นแวมไพร์ ชนะเมื่อมีจำนวนแวมไพร์เยอะที่สุด" },

  // Game Master
  gm: { name: "ผู้ดำเนินเกม", icon: "🎭", team: "none", color: "#8b5cf6", actionPhase: "none", description: "คุณคือผู้ดำเนินเกม ควบคุมทุกเฟส" },
};

export const ROLE_CATEGORIES: Record<string, { name: string; color: string }> = {
  villager: { name: "ฝ่ายชาวบ้าน", color: "#f59e0b" },
  werewolf: { name: "ฝ่ายหมาป่า", color: "#ef4444" },
  independent: { name: "อิสระ/อื่นๆ", color: "#8b5cf6" },
};
