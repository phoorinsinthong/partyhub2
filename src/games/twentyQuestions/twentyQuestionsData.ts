// @ts-nocheck
// 20 Questions (20 คำถาม) - Thai Party Game Data
// Players ask yes/no questions to guess the secret word within 20 questions

const words = [
  // === สัตว์ (Animals) ===
  { word: 'ช้าง', category: 'สัตว์', hint: 'สัตว์ประจำชาติ' },
  { word: 'แมวส้ม', category: 'สัตว์', hint: 'ขี้เกียจ' },
  { word: 'ปลาฉลาม', category: 'สัตว์', hint: 'ครีบหลัง' },
  { word: 'นกยูง', category: 'สัตว์', hint: 'หางสวย' },
  { word: 'กิ้งก่า', category: 'สัตว์', hint: 'เปลี่ยนสี' },
  { word: 'หมีแพนด้า', category: 'สัตว์', hint: 'ขาวดำ' },
  { word: 'ปลาหมึกยักษ์', category: 'สัตว์', hint: 'หลายหนวด' },
  { word: 'ค้างคาว', category: 'สัตว์', hint: 'บินกลางคืน' },
  { word: 'เต่า', category: 'สัตว์', hint: 'กระดอง' },
  { word: 'นกฮูก', category: 'สัตว์', hint: 'ตาโต' },
  { word: 'แมงกะพรุน', category: 'สัตว์', hint: 'โปร่งใส' },
  { word: 'คางคก', category: 'สัตว์', hint: 'ผิวขรุขระ' },

  // === อาหาร (Food) ===
  { word: 'ส้มตำ', category: 'อาหาร', hint: 'อีสาน' },
  { word: 'ข้าวมันไก่', category: 'อาหาร', hint: 'ประตูผี' },
  { word: 'ต้มยำกุ้ง', category: 'อาหาร', hint: 'เผ็ดเปรี้ยว' },
  { word: 'ซูชิ', category: 'อาหาร', hint: 'ญี่ปุ่น' },
  { word: 'พิซซ่า', category: 'อาหาร', hint: 'อิตาลี' },
  { word: 'ชาไข่มุก', category: 'อาหาร', hint: 'ดูดเม็ด' },
  { word: 'ผัดกะเพรา', category: 'อาหาร', hint: 'ไข่ดาว' },
  { word: 'ข้าวเหนียวมะม่วง', category: 'อาหาร', hint: 'ของหวาน' },
  { word: 'หมูกระทะ', category: 'อาหาร', hint: 'ปิ้งย่าง' },
  { word: 'ราเมน', category: 'อาหาร', hint: 'เส้นญี่ปุ่น' },
  { word: 'ไก่ทอด', category: 'อาหาร', hint: 'KFC' },
  { word: 'มาม่า', category: 'อาหาร', hint: 'บะหมี่กึ่งสำเร็จรูป' },

  // === สถานที่ (Places) ===
  { word: 'วัดพระแก้ว', category: 'สถานที่', hint: 'พระมรกต' },
  { word: 'เขาสาร', category: 'สถานที่', hint: 'กระบี่' },
  { word: 'สยามพารากอน', category: 'สถานที่', hint: 'ห้างหรู' },
  { word: 'เกาะพีพี', category: 'สถานที่', hint: 'ทะเลใต้' },
  { word: 'หอไอเฟล', category: 'สถานที่', hint: 'ปารีส' },
  { word: 'เยาวราช', category: 'สถานที่', hint: 'ไชน่าทาวน์' },
  { word: 'ดอยอินทนนท์', category: 'สถานที่', hint: 'สูงสุด' },
  { word: 'ตลาดนัดจตุจักร', category: 'สถานที่', hint: 'วันเสาร์อาทิตย์' },
  { word: 'สนามหลวง', category: 'สถานที่', hint: 'ว่าว' },
  { word: 'พระธาตุดอยสุเทพ', category: 'สถานที่', hint: 'เชียงใหม่' },
  { word: 'ถนนข้าวสาร', category: 'สถานที่', hint: 'ฝรั่ง' },
  { word: 'ดิสนีย์แลนด์', category: 'สถานที่', hint: 'สวนสนุก' },

  // === บุคคลที่มีชื่อเสียง (Famous People) ===
  { word: 'ลิซ่า BLACKPINK', category: 'บุคคลที่มีชื่อเสียง', hint: 'บุรีรัมย์' },
  { word: 'อีลอน มัสก์', category: 'บุคคลที่มีชื่อเสียง', hint: 'จรวด' },
  { word: 'พี่ตูน บอดี้สแลม', category: 'บุคคลที่มีชื่อเสียง', hint: 'วิ่ง' },
  { word: 'เทย์เลอร์ สวิฟต์', category: 'บุคคลที่มีชื่อเสียง', hint: 'Era' },
  { word: 'ณเดชน์', category: 'บุคคลที่มีชื่อเสียง', hint: 'พระเอก' },
  { word: 'โดราเอมอน', category: 'บุคคลที่มีชื่อเสียง', hint: 'กระเป๋าวิเศษ' },
  { word: 'บังจุน (BamBam)', category: 'บุคคลที่มีชื่อเสียง', hint: 'GOT7' },
  { word: 'สตีฟ จ็อบส์', category: 'บุคคลที่มีชื่อเสียง', hint: 'แอปเปิ้ล' },
  { word: 'แจ็กกี้ ชาน', category: 'บุคคลที่มีชื่อเสียง', hint: 'กังฟู' },
  { word: 'มาริโอ้ เมาเร่อ', category: 'บุคคลที่มีชื่อเสียง', hint: 'ลูกครึ่ง' },
  { word: 'ชนาธิป', category: 'บุคคลที่มีชื่อเสียง', hint: 'เมสซี่เจ' },
  { word: 'แฮร์รี่ พอตเตอร์', category: 'บุคคลที่มีชื่อเสียง', hint: 'พ่อมด' },

  // === สิ่งของ (Objects) ===
  { word: 'ร่ม', category: 'สิ่งของ', hint: 'ฝนตก' },
  { word: 'ไอโฟน', category: 'สิ่งของ', hint: 'แอปเปิ้ล' },
  { word: 'กระจก', category: 'สิ่งของ', hint: 'สะท้อน' },
  { word: 'หมอนข้าง', category: 'สิ่งของ', hint: 'กอดนอน' },
  { word: 'กล้องถ่ายรูป', category: 'สิ่งของ', hint: 'ชัตเตอร์' },
  { word: 'รองเท้าผ้าใบ', category: 'สิ่งของ', hint: 'วิ่ง' },
  { word: 'แว่นกันแดด', category: 'สิ่งของ', hint: 'หน้าร้อน' },
  { word: 'พัดลม', category: 'สิ่งของ', hint: 'ลมเย็น' },
  { word: 'กุญแจ', category: 'สิ่งของ', hint: 'ล็อค' },
  { word: 'ไฟแช็ก', category: 'สิ่งของ', hint: 'จุดไฟ' },
  { word: 'กระเป๋าเป้', category: 'สิ่งของ', hint: 'สะพายหลัง' },
  { word: 'หูฟัง', category: 'สิ่งของ', hint: 'เพลง' },
  { word: 'เทียน', category: 'สิ่งของ', hint: 'เป่าวันเกิด' },
  { word: 'ลูกโป่ง', category: 'สิ่งของ', hint: 'แตกง่าย' },
  { word: 'นาฬิกาข้อมือ', category: 'สิ่งของ', hint: 'เวลา' },
  { word: 'ไม้เซลฟี่', category: 'สิ่งของ', hint: 'ถ่ายรูป' },

  // === กีฬา/กิจกรรม (Sports/Activities) ===
  { word: 'มวยไทย', category: 'กีฬา/กิจกรรม', hint: 'ศอก เข่า' },
  { word: 'ตะกร้อ', category: 'กีฬา/กิจกรรม', hint: 'ลูกหวาย' },
  { word: 'เซิร์ฟบอร์ด', category: 'กีฬา/กิจกรรม', hint: 'คลื่น' },
  { word: 'โยคะ', category: 'กีฬา/กิจกรรม', hint: 'ยืดเส้น' },
  { word: 'สเก็ตบอร์ด', category: 'กีฬา/กิจกรรม', hint: 'สี่ล้อ' },
  { word: 'แบดมินตัน', category: 'กีฬา/กิจกรรม', hint: 'ลูกขนไก่' },
  { word: 'ดำน้ำ', category: 'กีฬา/กิจกรรม', hint: 'ปะการัง' },
  { word: 'ปีนผา', category: 'กีฬา/กิจกรรม', hint: 'เชือก' },
  { word: 'วิ่งมาราธอน', category: 'กีฬา/กิจกรรม', hint: '42 กม.' },
  { word: 'บิลเลียด', category: 'กีฬา/กิจกรรม', hint: 'โต๊ะเขียว' },
  { word: 'โบว์ลิ่ง', category: 'กีฬา/กิจกรรม', hint: 'พินล้ม' },

  // === ภาพยนตร์/ซีรีส์ (Movies/Series) ===
  { word: 'พี่มาก..พระโขนง', category: 'ภาพยนตร์/ซีรีส์', hint: 'ผีนางนาก' },
  { word: 'Squid Game', category: 'ภาพยนตร์/ซีรีส์', hint: 'เกาหลี 456' },
  { word: 'ฮาวทูทิ้ง', category: 'ภาพยนตร์/ซีรีส์', hint: 'เทไม่ลง' },
  { word: 'Avengers', category: 'ภาพยนตร์/ซีรีส์', hint: 'ซูเปอร์ฮีโร่' },
  { word: 'ฉลาดเกมส์โกง', category: 'ภาพยนตร์/ซีรีส์', hint: 'สอบโกง' },
  { word: 'Harry Potter', category: 'ภาพยนตร์/ซีรีส์', hint: 'ฮอกวอตส์' },
  { word: 'One Piece', category: 'ภาพยนตร์/ซีรีส์', hint: 'โจรสลัด' },
  { word: 'แฟรนไชส์', category: 'ภาพยนตร์/ซีรีส์', hint: 'ร้านสะดวกซื้อ' },
  { word: 'Frozen', category: 'ภาพยนตร์/ซีรีส์', hint: 'Let it go' },
  { word: 'เกมนรก', category: 'ภาพยนตร์/ซีรีส์', hint: 'Alice' },
  { word: 'F4 Thailand', category: 'ภาพยนตร์/ซีรีส์', hint: 'รักร้อน' },
  { word: 'Spider-Man', category: 'ภาพยนตร์/ซีรีส์', hint: 'ใยแมงมุม' },

  // === ปั่นๆ ฮาๆ (Funny/Absurd/Troll) ===
  { word: 'คนนอนดึก', category: 'ปั่นๆ ฮาๆ', hint: 'ตีสามก็ยังไม่นอน' },
  { word: 'คนกินจุ', category: 'ปั่นๆ ฮาๆ', hint: 'บุฟเฟ่ต์คุ้ม' },
  { word: 'ตื่นสาย', category: 'ปั่นๆ ฮาๆ', hint: 'นาฬิกาปลุก 10 เครื่อง' },
  { word: 'คนเมารถ', category: 'ปั่นๆ ฮาๆ', hint: 'อ้วก' },
  { word: 'WiFi สาธารณะ', category: 'ปั่นๆ ฮาๆ', hint: 'ช้าจนหัวร้อน' },
  { word: 'ลืมรหัสผ่าน', category: 'ปั่นๆ ฮาๆ', hint: 'เปลี่ยนรอบที่ 99' },
  { word: 'เบาะรถเมล์', category: 'ปั่นๆ ฮาๆ', hint: 'ร้อนก้น' },
  { word: 'คนถ่ายรูปอาหาร', category: 'ปั่นๆ ฮาๆ', hint: 'กินได้ยัง?' },
  { word: 'แอร์ห้องประชุม', category: 'ปั่นๆ ฮาๆ', hint: 'หนาวจนตัวสั่น' },
  { word: 'ลิฟต์เต็ม', category: 'ปั่นๆ ฮาๆ', hint: 'รอรอบหน้า' },
  { word: 'คนแชทช้า', category: 'ปั่นๆ ฮาๆ', hint: 'พิมพ์อยู่...' },
  { word: 'คนส่งสติกเกอร์ท่วม', category: 'ปั่นๆ ฮาๆ', hint: 'ไลน์ระเบิด' },
  { word: 'เพื่อนยืมเงิน', category: 'ปั่นๆ ฮาๆ', hint: 'หายไปเลย' },
  { word: 'คนชอบเลื่อนนาฬิกาปลุก', category: 'ปั่นๆ ฮาๆ', hint: 'อีก 5 นาที' },
  { word: 'คิวหมอ', category: 'ปั่นๆ ฮาๆ', hint: 'รอ 3 ชั่วโมง' },
  { word: 'คนลืมชื่อ', category: 'ปั่นๆ ฮาๆ', hint: 'เอ่อ...คุณ...' },
  { word: 'รถติด', category: 'ปั่นๆ ฮาๆ', hint: 'บางนา 5 โมงเย็น' },
  { word: 'ฝนตกไม่พกร่ม', category: 'ปั่นๆ ฮาๆ', hint: 'เปียกทั้งตัว' },
  { word: 'คนอ่าน seen ไม่ตอบ', category: 'ปั่นๆ ฮาๆ', hint: 'เห็นแล้วเงียบ' },
  { word: 'เสียงปลุกคนอื่น', category: 'ปั่นๆ ฮาๆ', hint: 'ห้องข้างๆ' },
  { word: 'คนแย่งปลั๊กชาร์จ', category: 'ปั่นๆ ฮาๆ', hint: 'แบตจะหมด!' },
  { word: 'คนชอบบอกว่าใกล้ถึงแล้ว', category: 'ปั่นๆ ฮาๆ', hint: 'อีก 5 นาที (30 นาที)' },
  { word: 'คนตัดคิว', category: 'ปั่นๆ ฮาๆ', hint: 'หน้าด้าน' },
  { word: 'คนเปิดลำโพงในรถไฟฟ้า', category: 'ปั่นๆ ฮาๆ', hint: 'TikTok ดังลั่น' },
  { word: 'โปรเน็ตหมด', category: 'ปั่นๆ ฮาๆ', hint: '64 kbps' },
  { word: 'คนไม่กดลิฟต์ให้', category: 'ปั่นๆ ฮาๆ', hint: 'กดปิดใส่หน้า' },
  { word: 'ห้องน้ำสาธารณะ', category: 'ปั่นๆ ฮาๆ', hint: 'ไม่มีกระดาษ' },
  { word: 'คนพูดสปอยล์หนัง', category: 'ปั่นๆ ฮาๆ', hint: 'ตอนจบคือ...' },
  { word: 'แก้วน้ำคนอื่น', category: 'ปั่นๆ ฮาๆ', hint: 'ดื่มผิดแก้ว' },
  { word: 'คนจามไม่ปิดปาก', category: 'ปั่นๆ ฮาๆ', hint: 'ฝอยกระจาย' },
  { word: 'ส่งข้อความผิดกลุ่ม', category: 'ปั่นๆ ฮาๆ', hint: 'นินทาเจ้าตัว' },
  { word: 'เก้าอี้หัก', category: 'ปั่นๆ ฮาๆ', hint: 'ล้มกลางห้อง' },
  { word: 'คนขอดูการบ้าน', category: 'ปั่นๆ ฮาๆ', hint: 'ขอก๊อปแปป' },
  { word: 'โทรศัพท์ตกส้วม', category: 'ปั่นๆ ฮาๆ', hint: 'จุ่มน้ำ' },
  { word: 'คนนั่งผิดที่', category: 'ปั่นๆ ฮาๆ', hint: 'ตั๋วหนัง' },
  { word: 'ถุงเท้าไม่เข้าคู่', category: 'ปั่นๆ ฮาๆ', hint: 'ข้างละสี' },
  { word: 'คนกดลิฟต์ทุกชั้น', category: 'ปั่นๆ ฮาๆ', hint: 'จอดทุกชั้น' },
  { word: 'อาจารย์ลืมสอน', category: 'ปั่นๆ ฮาๆ', hint: 'รอฟรี 2 คาบ' },
  { word: 'คนชอบถามว่าผอมลงมั้ย', category: 'ปั่นๆ ฮาๆ', hint: 'ไม่ได้ลดเลย' },
  { word: 'เดทแรก', category: 'ปั่นๆ ฮาๆ', hint: 'มือสั่น ลืมคำพูด' },
  { word: 'คนส่งวอยซ์ 5 นาที', category: 'ปั่นๆ ฮาๆ', hint: 'พอดแคสต์มั้ย' },
  { word: 'แอปหาคู่', category: 'ปั่นๆ ฮาๆ', hint: 'ปัดขวา' },
  { word: 'คนโพสต์ฟิตเนส', category: 'ปั่นๆ ฮาๆ', hint: 'ไป 1 วันถ่าย 10 รูป' },
  { word: 'ประชุมที่ควรเป็นอีเมล', category: 'ปั่นๆ ฮาๆ', hint: '2 ชั่วโมงสรุปไม่ได้' },
  { word: 'คนตื่นสายวันจันทร์', category: 'ปั่นๆ ฮาๆ', hint: 'วิ่งไล่รถเมล์' },
  { word: 'เมนูหมด', category: 'ปั่นๆ ฮาๆ', hint: 'มีแต่น้ำเปล่า' },
];

/**
 * Get a random word that hasn't been used yet
 * @param {string[]} usedWords - Array of already-used words to exclude
 * @returns {object|null} A word object { word, category, hint } or null if all words used
 */
export function getRandomWord(usedWords = []) {
  const available = words.filter((w) => !usedWords.includes(w.word));
  if (available.length === 0) return null;
  const index = Math.floor(Math.random() * available.length);
  return available[index];
}

/**
 * Get multiple random word choices from different categories for the host to pick from
 * @param {number} count - Number of choices to return
 * @param {string[]} usedWords - Array of already-used words to exclude
 * @returns {object[]} Array of word objects from different categories
 */
export function getWordChoices(count = 3, usedWords = []) {
  const available = words.filter((w) => !usedWords.includes(w.word));
  if (available.length === 0) return [];

  // Group by category
  const byCategory = {};
  available.forEach((w) => {
    if (!byCategory[w.category]) byCategory[w.category] = [];
    byCategory[w.category].push(w);
  });

  const categories = Object.keys(byCategory);
  const choices = [];
  const usedCategories = new Set();

  // Try to pick from different categories first
  while (choices.length < count && choices.length < available.length) {
    let pool;

    // Find an unused category
    const unusedCategories = categories.filter((c) => !usedCategories.has(c) && byCategory[c].length > 0);

    if (unusedCategories.length > 0) {
      const cat = unusedCategories[Math.floor(Math.random() * unusedCategories.length)];
      usedCategories.add(cat);
      pool = byCategory[cat];
    } else {
      // All categories used, pick from any remaining
      pool = available.filter((w) => !choices.includes(w));
    }

    if (pool.length === 0) break;

    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!choices.find((c) => c.word === pick.word)) {
      choices.push(pick);
    }
  }

  return choices;
}

export default words;
