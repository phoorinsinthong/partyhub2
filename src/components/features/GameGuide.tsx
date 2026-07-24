import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, X } from 'lucide-react';

const guides = {
  drinking: {
    title: 'วงเหล้า',
    steps: [
      'ผู้เล่นผลัดกันจั่วไพ่ตามลำดับ',
      'แต่ละใบมีกฎพิเศษ — ทำตามกฎ!',
      'ไพ่หมด = จบเกม',
    ],
    rules: [
      { card: 'A', text: 'ดื่มคนเดียว' },
      { card: '2', text: 'เลือกเพื่อนดื่ม 1 คน' },
      { card: '3', text: 'เลือกเพื่อนดื่ม 2 คน' },
      { card: '4', text: 'คนทางซ้ายดื่ม' },
      { card: '5', text: 'ดื่มทุกคน!' },
      { card: '6', text: 'Thumb Master — เอานิ้วโป้งแตะโต๊ะ คนช้าสุดดื่ม' },
      { card: '7', text: 'Heaven — ชูมือขึ้น คนช้าสุดดื่ม' },
      { card: '8', text: 'Mate — เลือกคู่ดื่มจนจบเกม' },
      { card: '9', text: 'Rhyme — พูดคำ คนต่อไปคล้องจอง นึกไม่ออก=ดื่ม' },
      { card: '10', text: 'Categories — เลือกหมวด วนไป นึกไม่ออก=ดื่ม' },
      { card: 'J', text: 'Rule Maker — ตั้งกฎ ใครผิดกฎ=ดื่ม' },
      { card: 'Q', text: 'Question Master — ถาม ใครตอบ=ดื่ม' },
      { card: 'K', text: "King's Cup — เทเหล้าลงแก้วกลาง จั่ว K ใบที่ 4 ดื่มทั้งแก้ว!" },
    ],
  },
  spyfall: {
    title: 'สปายฟอล',
    steps: [
      'ผู้เล่นทุกคนได้รับสถานที่เดียวกัน ยกเว้น "สายลับ" ที่ไม่รู้',
      'ผลัดกันถามคำถามเพื่อหาว่าใครคือสายลับ',
      'สายลับต้องพยายามเดาสถานที่จากคำถามของคนอื่น',
      'เมื่อหมดเวลาหรือมีคนขอโหวต — โหวตหาสายลับ',
      'ถ้าโหวตถูก = ชาวบ้านชนะ / สายลับทายสถานที่ถูก = สายลับชนะ',
    ],
    tips: [
      'ถามคำถามที่กว้างพอจะไม่เผยสถานที่ให้สายลับ',
      'สายลับควรตอบกว้างๆ อย่าให้คนสงสัย',
      'ผู้สมรู้ร่วมคิด (ถ้าเปิด) จะรู้ว่าสายลับคือใคร และช่วยปกป้อง',
    ],
  },
  target: {
    title: 'เลขเป้า',
    steps: [
      'คนหนึ่งถูกสุ่มให้ตั้ง "ตัวเลขลับ" (1-100)',
      'ผู้เล่นอื่นจะเห็นช่วงใบ้ (±5 จากเป้า)',
      'ผลัดกันนับเลขเพิ่มขึ้น เลือกนับ +1, +2, หรือ +3',
      'ใครนับถึงตัวเลขลับ...คนนั้นแพ้!',
    ],
    tips: [
      'พยายามหลีกเลี่ยงช่วงตัวเลขใบ้',
      'คิดดีๆ ว่าจะนับกี่ตัว อย่าให้ตัวเองติดตัวเลขอันตราย',
      'ดูท่าทีคนตั้งเลข อาจมี hint!',
    ],
  },
  werewolf: {
    title: 'หมาป่า',
    steps: [
      'GM (Host) จะจัดการ์ดบทบาทให้ผู้เล่น',
      'กลางคืน — หมาป่าเลือกเหยื่อ, บทบาทพิเศษใช้พลัง',
      'กลางวัน — ทุกคนคุยกัน หาว่าใครเป็นหมาป่า',
      'โหวต — เลือกคนที่สงสัยว่าเป็นหมาป่าออกจากเกม',
      'ชาวบ้านชนะเมื่อจับหมาป่าได้ทั้งหมด',
      'หมาป่าชนะเมื่อจำนวนเท่าหรือมากกว่าชาวบ้าน',
    ],
    tips: [
      'หมอดู — ส่องคนคืนละ 1 คน ว่าเป็นหมาป่าไหม',
      'บอดี้การ์ด — ปกป้องคนคืนละ 1 คน',
      'พรานป่า — เมื่อตาย เลือกลากคนไปด้วย 1 คน',
      'GM ควบคุมทุกเฟส อ่านกฎของแต่ละบทบาทจากหน้าตั้งค่า',
    ],
  },
  truthordare: {
    title: 'จริงหรือกล้า',
    steps: [
      'ผู้เล่นผลัดกันเลือก "ความจริง" หรือ "ท้าทาย"',
      'เลือกความจริง = ตอบคำถามตามตรง',
      'เลือกท้าทาย = ทำตามคำท้า',
      'ทำเสร็จแล้วกด "คนถัดไป" เพื่อส่งต่อ',
    ],
    tips: [
      'เล่นสนุกๆ อย่ากดดันเพื่อนมากเกินไป',
      'ถ้าไม่กล้าทำ Dare ให้ดื่ม (ถ้าเล่นวงเหล้า)',
      'เปลี่ยนระหว่าง Truth/Dare ได้ตามใจ ไม่มีบังคับ',
    ],
  },
  neverhaveiever: {
    title: 'ไม่เคย...',
    steps: [
      'ระบบจะแสดงประโยค "ไม่เคย [X]" ทุกรอบ',
      'แต่ละคนกด "เคย" หรือ "ไม่เคย" ภายใน 20 วินาที',
      'คนที่กด "เคย" จะเสีย 1 ชีวิต (มีทั้งหมด 5 ชีวิต)',
      'เล่นครบ 15 รอบ ใครชีวิตเหลือมากสุดชนะ',
    ],
    tips: [
      'ยิ่งเคยทำมาก ยิ่งเสียชีวิตมาก!',
      'ถ้าเล่นวงเหล้า ใครกด "เคย" ดื่ม 1 ซิป',
      'ตอบตามความจริงเพื่อความสนุก',
    ],
  },
  wordbomb: {
    title: 'บอมบ์คำ',
    steps: [
      'ระบบจะให้หมวดคำ เช่น "อาหารไทย"',
      'ผู้เล่นผลัดกัน "พูด" คำที่อยู่ในหมวดนั้น (ไม่ต้องพิมพ์)',
      'หัวห้องเป็นกรรมการ กด "ถูกต้อง" หรือ "ผิด/ซ้ำ"',
      'ถ้าระเบิดหมดเวลา หรือตอบผิด = เสีย 1 ชีวิต',
      'หมดชีวิต 3 ครั้ง = ออกจากเกม คนสุดท้ายชนะ',
    ],
    tips: [
      'ห้ามพูดคำเดิมซ้ำ — กรรมการจะกด "ผิด/ซ้ำ"',
      'ยิ่งคิดเร็วยิ่งได้เปรียบ!',
      'เล่นวงเหล้า — ใครระเบิดดื่ม 1 ซิป',
    ],
  },
  taboo: {
    title: 'ใบ้คำ',
    steps: [
      'คนอธิบาย (Describer) เห็นคำลับ + คำต้องห้าม',
      'อธิบายให้คนอื่นทายโดยไม่พูดคำต้องห้าม',
      'คนอื่นตอบดังๆ — เมื่อทายถูก ผู้ใบ้กดเลือกคนที่ตอบถูก',
      'ทายถูก: อธิบาย +3, ทาย +1',
      'แต่ละคนได้เป็น Describer 1 รอบ (60 วินาที)',
      'ครบทุกคนแล้วดูคะแนนรวม',
    ],
    tips: [
      'ห้ามพูดคำที่ใกล้เคียงหรือรากศัพท์ของคำต้องห้าม',
      'ใช้ท่าทาง ตัวอย่าง หรือเล่าเรื่องช่วยได้',
      'ผู้ใบ้เป็นคนกดว่าใครตอบถูก — เล่นด้วยความซื่อสัตย์!',
    ],
  },
  mathrace: {
    title: 'คำนวณเร็ว',
    steps: [
      'โจทย์คณิตจะแสดงพร้อมกันทุกคน',
      'พิมพ์คำตอบให้ถูกต้องและเร็วที่สุด',
      'ยิ่งตอบเร็ว ยิ่งได้คะแนนมาก',
      'ทั้งหมด 10 ข้อ คะแนนรวมสูงสุดชนะ',
    ],
    tips: [
      'ตอบถูกได้ 1-15 คะแนน ขึ้นอยู่กับความเร็ว',
      'ตอบผิดได้ 0 คะแนน ไม่หักแต้ม',
      'โหมดยากมีคูณ/หาร และโจทย์หลายขั้นตอน',
    ],
  },
  twentyquestions: {
    title: 'Insider',
    steps: [
      'Host เป็นกรรมการ รู้คำลับ ตอบคำถามด้วยวาจา (ใช่/ไม่ใช่)',
      '1 คนถูกสุ่มเป็น Insider — แอบรู้คำตอบเหมือนกัน!',
      'ผู้เล่นทุกคนถามคำถามและพยายามทายคำลับภายใน 90 วินาที',
      'ถ้ามีคนทายถูก → เข้าสู่รอบโหวตหา Insider (30 วินาที)',
      'โหวตถูก: ชาวบ้าน +2 / โหวตผิด: Insider +3',
      'หมดเวลาไม่มีใครทายถูก: Insider +3',
    ],
    tips: [
      'Insider ต้องช่วยนำทางให้เดาถูก แต่อย่าชี้นำชัดเกิน!',
      'สังเกตว่าใครถามคำถาม "เฉพาะเจาะจง" เกินไป',
      'กรรมการตอบด้วยปากเท่านั้น ไม่ต้องพิมพ์',
    ],
  },
  fakeartist: {
    title: 'ศิลปินปลอม',
    steps: [
      'ผู้เล่นทุกคนได้รับคำเดียวกัน ยกเว้น "ศิลปินปลอม" ที่ไม่รู้คำ',
      'ผลัดกันวาดคนละ 1 เส้น ตามลำดับ (2 รอบ)',
      'แต่ละคนมีสีเฉพาะตัว — ดูได้ว่าใครวาดเส้นไหน',
      'จบรอบวาด → โหวตหาศิลปินปลอม',
      'ถ้าจับถูก: ศิลปินปลอมมีโอกาสเดาคำ ถ้าเดาถูกก็ยังชนะ!',
      'ถ้าจับผิด: ศิลปินปลอมชนะทันที',
    ],
    tips: [
      'ศิลปินตัวจริง: อย่าวาดชัดเกินไป ไม่งั้นปลอมจะเดาคำได้',
      'ศิลปินปลอม: วาดตามคนอื่น ทำเป็นว่ารู้คำ',
      'สังเกตว่าใครวาดเส้น "กว้างๆ" ไม่เฉพาะเจาะจง',
    ],
  },
};

const GameGuide = ({ gameId }) => {
  const [open, setOpen] = useState(false);
  const guide = guides[gameId];

  if (!guide) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl py-2 px-3 text-[12px] min-h-[42px]"
      >
        <BookOpen size={14} />
        คู่มือ
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="bg-slate-900 rounded-t-3xl w-full max-w-[460px] max-h-[85dvh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center p-5 pb-3 border-b border-slate-700">
                <h2 className="font-display font-bold text-lg text-white">{guide.title}</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 active:bg-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ WebkitOverflowScrolling: 'touch' }}>
                {/* Steps */}
                <div>
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">วิธีเล่น</h3>
                  <div className="space-y-2">
                    {guide.steps.map((step, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[11px] font-extrabold text-neon-green shrink-0">
                          {i + 1}
                        </span>
                        <p className="text-[13px] text-slate-200 font-medium leading-relaxed pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Rules (Drinking) */}
                {guide.rules && (
                  <div>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">กฎแต่ละใบ</h3>
                    <div className="space-y-1.5">
                      {guide.rules.map((r) => (
                        <div key={r.card} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800 border border-slate-700">
                          <span className="w-8 h-8 rounded-lg bg-slate-900 border-2 border-slate-700 flex items-center justify-center text-[13px] font-black text-slate-200 shrink-0">
                            {r.card}
                          </span>
                          <p className="text-[12px] text-slate-300 font-semibold leading-snug">{r.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tips */}
                {guide.tips && (
                  <div>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">เคล็ดลับ</h3>
                    <div className="space-y-1.5">
                      {guide.tips.map((tip, i) => (
                        <div key={i} className="flex gap-2.5 items-start p-2.5 rounded-xl bg-slate-800/50 border border-slate-700">
                          <span className="text-sm shrink-0"></span>
                          <p className="text-[12px] text-slate-300 font-semibold leading-snug">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom safe area */}
              <div className="p-4 pt-2">
                <button onClick={() => setOpen(false)} className="bg-neon-blue text-white font-bold rounded-xl w-full py-3.5 text-[15px]">
                  เข้าใจแล้ว!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GameGuide;
