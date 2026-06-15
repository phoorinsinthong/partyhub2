export const WORD_BOMB_CATEGORIES = [
  // อาหาร
  { category: "อาหารไทย", examples: "ต้มยำ, ผัดไทย, ส้มตำ..." },
  { category: "อาหารญี่ปุ่น", examples: "ซูชิ, ราเม็ง, ทาโกยากิ..." },
  { category: "อาหารจานเดียว", examples: "ข้าวผัด, ข้าวมันไก่, ก๋วยเตี๋ยว..." },
  { category: "ของทอด", examples: "ไก่ทอด, ปาท่องโก๋, กล้วยทอด..." },
  { category: "ของหวาน", examples: "ไอศกรีม, เค้ก, บัวลอย..." },
  { category: "ผลไม้", examples: "แอปเปิ้ล, มะม่วง, กล้วย..." },
  { category: "ผัก", examples: "แครอท, ผักบุ้ง, ถั่วงอก..." },
  { category: "เครื่องดื่ม", examples: "น้ำส้ม, ชานม, กาแฟ..." },
  { category: "เส้น", examples: "วุ้นเส้น, มาม่า, สปาเก็ตตี้..." },
  { category: "อาหารทะเล", examples: "กุ้ง, ปลา, ปลาหมึก..." },

  // สัตว์
  { category: "สัตว์เลี้ยงลูกด้วยนม", examples: "สุนัข, แมว, ช้าง..." },
  { category: "สัตว์ทะเล", examples: "ปลา, วาฬ, ฉลาม..." },
  { category: "นก", examples: "นกแก้ว, นกอินทรี, นกฮูก..." },
  { category: "แมลง", examples: "ผีเสื้อ, มด, ยุง..." },
  { category: "สัตว์ในป่า", examples: "เสือ, หมี, กวาง..." },
  { category: "สัตว์ที่มีเกล็ด", examples: "งู, จระเข้, ปลา..." },
  { category: "สัตว์ที่บินได้", examples: "นกเหยี่ยว, ค้างคาว, ผีเสื้อ..." },

  // สถานที่
  { category: "สถานที่ในกรุงเทพ", examples: "สยาม, อโศก, เซนทรัล..." },
  { category: "ประเทศในเอเชีย", examples: "ญี่ปุ่น, จีน, เกาหลี..." },
  { category: "จังหวัดในไทย", examples: "เชียงใหม่, ภูเก็ต, ขอนแก่น..." },
  { category: "แหล่งท่องเที่ยวในไทย", examples: "พัทยา, เกาะสมุย, อยุธยา..." },
  { category: "ห้างสรรพสินค้า", examples: "เซนทรัล, สยามพารากอน, ไอคอนสยาม..." },
  { category: "ร้านสะดวกซื้อในไทย", examples: "7-Eleven, Lotus's, FamilyMart..." },

  // ความบันเทิง
  { category: "ตัวละครการ์ตูน", examples: "โดราเอมอน, นารูโตะ, ลูฟี่..." },
  { category: "นักร้องไทย", examples: "เบิร์ด, อั้ม, แสตมป์..." },
  { category: "นักร้อง K-POP", examples: "BTS, BLACKPINK, EXO..." },
  { category: "ชื่อหนัง Marvel", examples: "Iron Man, Thor, Spider-Man..." },
  { category: "เกมในมือถือ", examples: "ROV, Free Fire, PUBG..." },
  { category: "แอป Social Media", examples: "TikTok, Instagram, Twitter..." },
  { category: "ซีรีส์เกาหลี", examples: "Squid Game, Crash Landing, Reply..." },
  { category: "แมนกะ/อนิเมะ", examples: "Naruto, One Piece, Dragon Ball..." },

  // ของใช้ / สิ่งของ
  { category: "ของในห้องนอน", examples: "หมอน, ผ้าห่ม, ตู้เสื้อผ้า..." },
  { category: "ของในครัว", examples: "หม้อ, กระทะ, ตู้เย็น..." },
  { category: "เสื้อผ้า", examples: "เสื้อยืด, กางเกงยีนส์, ชุดนอน..." },
  { category: "อุปกรณ์อิเล็กทรอนิกส์", examples: "โทรศัพท์, แล็ปท็อป, หูฟัง..." },
  { category: "ของที่อยู่ในกระเป๋า", examples: "กระเป๋าสตางค์, กุญแจ, ลิปสติก..." },
  { category: "ยานพาหนะ", examples: "รถยนต์, รถจักรยานยนต์, เรือ..." },
  { category: "เครื่องดนตรี", examples: "กีตาร์, เปียโน, กลอง..." },

  // อาชีพ / คน
  { category: "อาชีพในโรงพยาบาล", examples: "หมอ, พยาบาล, เภสัชกร..." },
  { category: "อาชีพที่ต้องใส่ยูนิฟอร์ม", examples: "ตำรวจ, ทหาร, พยาบาล..." },
  { category: "อาชีพด้านศิลปะ", examples: "จิตรกร, นักดนตรี, นักออกแบบ..." },
  { category: "กีฬาที่เล่นเป็นทีม", examples: "ฟุตบอล, บาสเกตบอล, วอลเลย์บอล..." },
  { category: "กีฬาที่เล่นคนเดียว", examples: "ว่ายน้ำ, วิ่ง, เทนนิส..." },
  { category: "วิชาในโรงเรียน", examples: "คณิต, ภาษาไทย, วิทยาศาสตร์..." },
  { category: "สิ่งที่พบในชายหาด", examples: "ทราย, กุ้ง, เปลือกหอย..." },

  // ธรรมชาติ / วิทยาศาสตร์
  { category: "ดอกไม้", examples: "กุหลาบ, ทานตะวัน, ดอกมะลิ..." },
  { category: "ต้นไม้", examples: "ต้นโอ๊ก, ต้นมะพร้าว, ต้นสัก..." },
  { category: "ปรากฏการณ์ธรรมชาติ", examples: "รายุ, แผ่นดินไหว, สึนามิ..." },
  { category: "สีในรุ้งกินน้ำ", examples: "แดง, ส้ม, เหลือง..." },
  { category: "ดาวเคราะห์", examples: "โลก, ดาวอังคาร, ดาวพฤหัส..." },
  { category: "แร่ธาตุหรืออัญมณี", examples: "เพชร, ทับทิม, มรกต..." },
];

export function getRandomCategories(count = 1, exclude = []) {
  const available = WORD_BOMB_CATEGORIES.filter(c => !exclude.includes(c.category));
  const pool = available.length >= count ? available : WORD_BOMB_CATEGORIES;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default WORD_BOMB_CATEGORIES;
