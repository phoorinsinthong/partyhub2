import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { RotateCcw, Zap, Heart, ChevronRight, LogOut } from 'lucide-react';
import { recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';

// ─── Question Data ──────────────────────────────────────────────────────────

const TRUTHS = [
  // เบาๆ
  "เคยโกหกเพื่อนสนิทเรื่องอะไรบ้าง?",
  "อะไรคือเรื่องน่าอายที่สุดที่เคยเกิดขึ้นกับคุณ?",
  "เคยแอบชอบใครในกลุ่มนี้ไหม?",
  "เคยร้องไห้เพราะหนังหรือซีรีส์เรื่องอะไร?",
  "คนในกลุ่มนี้ ใครเป็นคนที่คุณไว้ใจมากที่สุด?",
  "เคยส่องโซเชียลแฟนเก่ากี่ครั้งแล้ว?",
  "ความลับที่ไม่เคยบอกใครมาก่อนคืออะไร?",
  "เคยแกล้งป่วยเพื่อหนีเรียน/หนีงานไหม?",
  "ล่าสุดที่โกหกคือโกหกเรื่องอะไร?",
  "ถ้าเลือกได้คนเดียวในกลุ่มนี้ไปเที่ยวด้วย จะเลือกใคร?",
  "ตอนเด็กอยากเป็นอะไรตอนโต?",
  "เพลงที่ฟังซ้ำบ่อยสุดตอนนี้คือเพลงอะไร?",
  "ถ้าต้องกินอาหารอย่างเดียวตลอดชีวิต จะเลือกอะไร?",
  "เคยนอนหลับในห้องเรียน/ที่ทำงานไหม?",
  "สิ่งที่ทำเป็นอย่างแรกหลังตื่นนอนคืออะไร?",
  "ถ้าชนะล็อตเตอรี่ 100 ล้าน จะทำอะไรเป็นอย่างแรก?",
  "เคยลืมวันเกิดเพื่อนสนิทไหม?",
  "ฝันร้ายที่จำได้ชัดที่สุดเป็นเรื่องอะไร?",
  // กลางๆ
  "เคยแอบอ่านแชทคนอื่นไหม?",
  "นิสัยแย่ๆ ที่ยังแก้ไม่ได้คืออะไร?",
  "เคยพูดลับหลังใครในกลุ่มนี้ไหม?",
  "สิ่งที่อายมากที่สุดในมือถือตอนนี้คืออะไร?",
  "เรื่องที่ถ้าแม่รู้จะโดนด่ามากที่สุด?",
  "เคยทำอะไรแปลกๆ ตอนอยู่คนเดียวไหม?",
  "ใครในกลุ่มนี้ที่คุณคิดว่าหน้าตาดีที่สุด?",
  "เคยหมกมุ่นเรื่องอะไรจนเพื่อนว่าแปลก?",
  "First impression ของคุณต่อคนข้างๆ คืออะไร?",
  "ถ้าต้องลบแอปออก 1 แอป จะลบอะไร?",
  "เคยจีบใครแล้วพลาดไหม เล่าให้ฟัง?",
  "คนในกลุ่มนี้ใครมีเสน่ห์ที่สุดในสายตาคุณ?",
  "สิ่งที่คุณทำแล้วรู้สึกผิดมากที่สุดคืออะไร?",
  "เคยโดนจับได้ตอนโกหกไหม?",
  "ถ้าต้องสลับชีวิตกับคนในกลุ่มนี้ 1 วัน จะเลือกใคร?",
  "เคยส่งข้อความผิดคนไหม? ส่งอะไรไป?",
  "ถ้ามีพลังวิเศษได้ 1 อย่าง จะเลือกอะไร?",
  "เคยแอบทำอะไรที่ไม่อยากให้ใครรู้ในช่วง 1 สัปดาห์นี้?",
  "ถ้าโลกจะแตกพรุ่งนี้ วันนี้จะทำอะไร?",
  // เข้มๆ
  "เคยโดนเทจากคนที่ชอบไหม เล่าให้ฟังหน่อย?",
  "ถ้าต้องเลือกคนในกลุ่มนี้เป็นแฟน จะเลือกใคร?",
  "เคยทำเรื่องผิดกฎหมายอะไรบ้าง?",
  "ช่วงที่ร้องไห้หนักที่สุดในชีวิตเป็นเรื่องอะไร?",
  "เคยตกหลุมรักเพื่อนสนิทไหม?",
  "ถ้าเดินทางย้อนเวลาได้ จะไปแก้ไขเรื่องอะไร?",
  "ใครในกลุ่มนี้ที่คุณรู้สึกห่างมากที่สุด?",
  "เรื่องที่เสียใจที่สุดในชีวิตคืออะไร?",
  "ถ้าต้องสารภาพรักกับคนในกลุ่มนี้ จะเลือกใคร?",
  "สิ่งที่กลัวมากที่สุดในตอนนี้คืออะไร?",
  "เคยหลอกตัวเองเรื่องอะไรมานานที่สุด?",
  "ถ้าต้องตัดเพื่อนออก 1 คน จะตัดใครในกลุ่มนี้?",
  "ความลับที่เก็บมานานที่สุดคืออะไร?",
  "เคยทรยศความไว้ใจของเพื่อนไหม?",
  "ถ้ามีคนในกลุ่มนี้แอบชอบคุณ คิดว่าเป็นใคร?",
  "สิ่งที่ไม่กล้าบอกพ่อแม่จนถึงตอนนี้คืออะไร?",
  "เคยรู้สึกอิจฉาใครในกลุ่มนี้ไหม เรื่องอะไร?",
  "ถ้าต้องเลือกระหว่างเงิน 10 ล้าน กับลบความทรงจำเรื่องเจ็บปวดทั้งหมด จะเลือกอะไร?",
  // เพิ่มรอบ 2 - เบาๆ
  "ถ้าต้องเลือกแค่หนัง 1 เรื่องดูตลอดชีวิต จะเลือกเรื่องอะไร?",
  "เคยคุยกับตัวเองไหม? คุยเรื่องอะไร?",
  "อาหารที่ทำเองเก่งที่สุดคืออะไร?",
  "ถ้าเป็นสัตว์ได้ 1 ชนิด จะเป็นอะไร?",
  "ตอนเครียดทำอะไรเพื่อผ่อนคลาย?",
  "เพลงที่ร้องได้ทุกครั้งที่ไปคาราโอเกะคือเพลงอะไร?",
  "ถ้ามีเวลาว่าง 1 วันเต็มๆ จะทำอะไร?",
  "สิ่งที่ซื้อแล้วเสียดายเงินที่สุดคืออะไร?",
  "ตื่นกี่โมงวันนี้?",
  "เคยฝันถึงใครในกลุ่มนี้ไหม?",
  // เพิ่มรอบ 2 - กลางๆ
  "ถ้าเพื่อนในกลุ่มนี้ 2 คนทะเลาะกัน คุณจะเข้าข้างใคร?",
  "เคยโกหกเพื่อนในกลุ่มนี้เรื่องอะไร?",
  "ถ้าให้คะแนนตัวเองเรื่องความซื่อสัตย์ 1-10 จะให้เท่าไร?",
  "เรื่องที่เคยทำแล้วกลัวว่าจะโดนจับได้มากที่สุด?",
  "ถ้าต้องเลือกคนในกลุ่มนี้ไปติดเกาะด้วย จะเลือกใคร?",
  "คุณคิดว่าคนในกลุ่มนี้ใครจะประสบความสำเร็จมากที่สุด?",
  "ถ้าอ่านใจคนได้ 1 คนในกลุ่มนี้ จะเลือกอ่านใจใคร?",
  "เคยรู้สึกว่าตัวเองเป็นคนไม่ดีไหม? เรื่องอะไร?",
  "ความสัมพันธ์ที่ซับซ้อนที่สุดที่เคยมีเป็นยังไง?",
  "ถ้าคนในกลุ่มนี้มีคนโกหก คิดว่าเป็นใคร?",
  // เพิ่มรอบ 2 - เข้มๆ
  "ถ้าให้จัดอันดับคนในกลุ่มนี้ตามความสนิท จะเรียงยังไง?",
  "เคยคิดจะตัดขาดกับเพื่อนในกลุ่มนี้ไหม?",
  "สิ่งที่คุณคิดว่าเป็นจุดอ่อนที่สุดของตัวเองคืออะไร?",
  "ถ้าต้องเลือกระหว่างเพื่อน กับ แฟน จะเลือกใคร?",
  "คนในกลุ่มนี้ใครที่คุณรู้สึกว่าเปลี่ยนไปมากที่สุด?",
  "เคยรู้สึกเป็นตัวประกอบในกลุ่มเพื่อนไหม?",
  "ถ้าวันนี้เป็นวันสุดท้ายของชีวิต จะบอกอะไรกับคนในกลุ่มนี้?",
  "ความจริงเรื่องหนึ่งที่ถ้าบอกออกไปอาจทำให้มิตรภาพพังคืออะไร?",
];

const DARES = [
  // เบาๆ
  "โทรหาเพื่อนสนิทแล้วบอกว่า 'ฉันรักเธอ' แล้ววางสายทันที",
  "เต้นเพลงที่กลุ่มเลือกให้ 30 วินาที",
  "ทำหน้าเซลฟี่ตลกๆ โพสต์สตอรี่ IG",
  "ให้คนข้างๆ ส่ง LINE หาใครก็ได้ในมือถือคุณ",
  "พูดเสียงเด็กเป็นเวลา 2 นาที",
  "ล้อเลียนคนในกลุ่ม 1 คน ให้ทุกคนทาย",
  "กินขนมหรืออาหารที่กลุ่มเลือกให้",
  "ร้องเพลงที่เพื่อนเลือกดังๆ 1 ท่อน",
  "ให้ทุกคนดูรูปล่าสุด 5 รูปในมือถือ",
  "แสดงท่าสัตว์ที่กลุ่มเลือก 1 นาที",
  "ทำหน้าตลก 5 แบบ ให้เพื่อนถ่ายรูป",
  "หัวเราะแบบตัวร้ายในหนัง 10 วินาที",
  "เดินแบบซอมบี้ไปรอบห้อง 1 รอบ",
  "พูดทุกอย่างเป็นเสียงร้องเพลงเป็นเวลา 3 นาที",
  "ทำท่า runway model เดินไป-กลับ 1 รอบ",
  "ร้องเพลง 'ช้าง ช้าง ช้าง' พร้อมทำท่าประกอบ",
  "ให้คนข้างๆ เลือกสติกเกอร์ LINE ส่งให้ใครก็ได้",
  "ทำหน้าตามอิโมจิ 5 ตัวที่กลุ่มเลือก",
  // กลางๆ
  "โทรหาคนล่าสุดในลิสต์โทรแล้วบอกรัก",
  "ส่งข้อความ 'คิดถึง' ให้แฟนเก่า (หรือคนที่เคยชอบ)",
  "ให้คนในกลุ่มเลือกเพลง แล้วร้องพร้อมเต้นประกอบ",
  "ให้ทุกคนดูแชทกลุ่มล่าสุดในมือถือ",
  "ทำท่า aegyo แบบเกาหลี 3 แบบ",
  "พูดสิ่งที่ชอบจริงๆ เกี่ยวกับทุกคนในกลุ่ม",
  "ให้คนข้างขวาวาดอะไรก็ได้บนหน้าคุณ",
  "พูดภาษาอังกฤษอย่างเดียว 5 นาที",
  "เปลี่ยนรูปโปรไฟล์เป็นรูปที่กลุ่มเลือก 24 ชั่วโมง",
  "โพสต์สตอรี่ว่า 'ฉันยอมรับว่าฉันเป็นคนตลก' พร้อมรูปหน้าจริงจัง",
  "แร็ปเกี่ยวกับคนข้างๆ 30 วินาที",
  "โทรหาเพื่อนที่ไม่ได้คุยนานแล้ว ถามว่า 'ยังรักกันอยู่ไหม?'",
  "ให้คนในกลุ่มเลือกท่าโพสถ่ายรูป 3 ท่า แล้วโพสต์สตอรี่",
  "เล่าเรื่องตลกให้ทุกคนหัวเราะภายใน 1 นาที ถ้าไม่หัวเราะต้องวิดพื้น 5 ครั้ง",
  "ส่งข้อความ 'เรื่องที่จะบอก สำคัญมาก' ให้คนที่กลุ่มเลือก แล้วรอ 1 นาทีค่อยบอกว่าล้อเล่น",
  "ให้ทุกคนดูเพลงที่ฟังล่าสุด 3 เพลง",
  "แสดงละครสั้น 30 วินาที โดยเพื่อนเลือกบทให้",
  "ทำเสียงเอฟเฟกต์ประกอบ ตามที่กลุ่มสั่ง 5 เสียง",
  // เข้มๆ
  "โทรหาแม่แล้วบอกว่า 'หนูสอบตก' รอ 10 วินาทีค่อยบอกว่าล้อเล่น",
  "ให้คนที่ถูกเลือกบังคับอะไรก็ได้ 1 อย่าง (ไม่ผิดกฎหมาย)",
  "โทรไปร้านอาหารสั่ง 'น้ำเปล่าร้อนใส่น้ำแข็ง'",
  "กอดคนที่นั่งไกลที่สุดในกลุ่ม 10 วินาที",
  "ให้ทุกคนดู search history ล่าสุด 5 อัน",
  "ส่งข้อความรักให้คนที่กลุ่มเลือก",
  "ให้คนข้างซ้ายแต่งหน้าให้ 1 นาที",
  "วิดพื้นหรือ squat 20 ครั้ง",
  "พูดความจริงเกี่ยวกับตัวเองที่ไม่มีใครรู้ 3 ข้อ",
  "FaceTime/วิดีโอคอลหาคนสุดท้ายในลิสต์โทร",
  "ให้กลุ่มแต่งประโยคจีบ แล้วส่งให้คนที่กลุ่มเลือก",
  "โทรหาร้านพิซซ่าถามว่า 'มีพิซซ่ารสช็อกโกแลตไหม?'",
  "ให้ทุกคนดู Gallery ล่าสุด 10 รูป",
  "ทำ Plank ค้างไว้จนกว่ากลุ่มจะบอกหยุด (สูงสุด 1 นาที)",
  "เปิดเพลงรักแล้วร้องให้คนข้างๆ ฟังแบบจริงจัง",
  "ส่งเสียงข้อความเสียงบอกรักให้คนที่กลุ่มเลือก",
  "บอกข้อดีของทุกคนในกลุ่ม คนละ 1 ข้อ แบบจริงจัง",
  "แกล้งโทรหาแฟนเก่า (หรือคนที่เคยชอบ) แล้วถามว่า 'ทำไมเราถึงเลิกกัน?'",
  // เพิ่มรอบ 2 - เบาๆ
  "ทำเสียงสัตว์ 5 ชนิด ให้เพื่อนทาย",
  "พูดชื่อทุกคนในกลุ่มพร้อมทำท่าเลียนแบบ",
  "ทำท่าหุ่นยนต์เต้น 30 วินาที",
  "ร้องเพลงชาติด้วยท่าทางจริงจัง",
  "พูดทุกอย่างเป็นคำถามเป็นเวลา 3 นาที",
  "แสดงฉากหนังที่กลุ่มเลือก",
  "ทำหน้าดุแล้วพูดว่า 'ฉันน่ารัก' ให้น่าเชื่อ",
  "เลียนแบบครู/อาจารย์ที่ทุกคนรู้จัก",
  "กระโดดตบ 10 ครั้ง พร้อมนับเป็นภาษาอังกฤษ",
  "เต้น TikTok ท่าอะไรก็ได้ที่จำได้ 15 วินาที",
  // เพิ่มรอบ 2 - กลางๆ
  "ส่งสติกเกอร์ 'ฉันรักเธอ' ให้คน 3 คนในรายชื่อ LINE",
  "ให้ทุกคนดูอัลบั้มรูปในมือถือ 30 วินาที",
  "โทรหาคนสุ่มในรายชื่อแล้วร้องเพลง Happy Birthday",
  "เปลี่ยนสถานะ LINE/IG เป็นข้อความที่กลุ่มเลือก 24 ชั่วโมง",
  "ให้เพื่อนเลือกเพลง แล้ว Lip Sync พร้อมทำท่าอย่างจริงจัง",
  "โพสต์รูปที่อายที่สุดในมือถือลง Close Friends",
  "ส่งข้อความ 'ฝันถึงเธอเมื่อคืน' ให้คนที่กลุ่มเลือก",
  "ให้กลุ่มเลือก Filter หน้า แล้วถ่ายรูปโพสต์สตอรี่",
  "ทำ freestyle rap เกี่ยวกับกลุ่มนี้ 30 วินาที",
  "ทำมุกตลกให้คนในกลุ่มหัวเราะ ถ้าไม่มีใครหัวเราะต้องลุกนั่ง 10 ครั้ง",
  // เพิ่มรอบ 2 - เข้มๆ
  "โทรหาคนในครอบครัวแล้วบอกว่า 'มีเรื่องสำคัญจะบอก...' รอ 10 วิค่อยบอกว่ารักนะ",
  "ให้กลุ่มเลือกข้อความ แล้วส่งให้ Crush ของคุณ (ถ้ามี)",
  "กอดทุกคนในกลุ่ม พร้อมบอกสิ่งที่ชอบ คนละ 1 ข้อ",
  "ทำ squat 30 ครั้ง หรือ plank 45 วินาที (เลือกเอง)",
  "ส่งข้อความเสียง (voice message) ร้องเพลงรักให้คนที่กลุ่มเลือก",
  "อ่านข้อความล่าสุดที่ส่งให้ crush ให้ทุกคนฟัง",
  "ให้กลุ่มถ่ายรูปคุณในท่าที่กลุ่มเลือก แล้วโพสต์ Feed IG",
  "โทรหาเพื่อนที่ไม่ได้คุยนาน แล้วบอกว่า 'เราต้องคุยกันเรื่องสำคัญ' รอ 15 วิค่อยบอกว่าแค่คิดถึง",
];

// ─── Main Component ──────────────────────────────────────────────────────────

const TruthOrDare = ({ roomId, roomData, userNickname }) => {
  const nickname = userNickname;
  const isHost = roomData.host === nickname;
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, nickname);
  const gameRecordedRef = useRef(false);

  useEffect(() => {
    if (!gameRecordedRef.current) {
      gameRecordedRef.current = true;
      recordPersonalGame('truthordare');
    }
  }, []);
  const advancingRef = useRef(false);
  const drawingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState('');

  const safeUpdate = async (refPath, data) => {
    try {
      await update(ref(db, refPath), data);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
      throw e;
    }
  };

  const gameData = roomData.gameData || {};
  const players = roomData.players ? Object.keys(roomData.players) : [];

  const currentCard = gameData.currentCard || null;
  const turnIndex = gameData.turnIndex ?? 0;
  const currentPlayer = players[turnIndex % players.length] || '';
  const isMyTurn = currentPlayer === nickname;
  const history = gameData.history || [];

  const [isRevealing, setIsRevealing] = useState(false);
  const [choice, setChoice] = useState(null); // 'truth' | 'dare' | null
  const revealTimerRef = useRef(null);

  useEffect(() => {
    return () => { if (revealTimerRef.current) clearTimeout(revealTimerRef.current); };
  }, []);

  // Init game on first load (host only)
  useEffect(() => {
    if (isHost && !gameData.turnIndex && gameData.turnIndex !== 0) {
      update(ref(db, `rooms/${roomId}/gameData`), {
        turnIndex: 0,
        currentCard: null,
        history: [],
      });
    }
  }, [isHost, roomId]);

  const drawCard = async (type) => {
    if (!isMyTurn) return;
    if (drawingRef.current) return;
    drawingRef.current = true;
    setIsRevealing(true);
    setChoice(type);

    const pool = type === 'truth' ? TRUTHS : DARES;
    const recentTexts = history.slice(-10).map(h => h.text);
    const available = pool.filter(q => !recentTexts.includes(q));
    const selected = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : pool[Math.floor(Math.random() * pool.length)];

    const card = {
      type,
      text: selected,
      player: nickname,
      timestamp: Date.now(),
    };

    const newHistory = [...history, card].slice(-30);

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        currentCard: card,
        history: newHistory,
      });
    } finally {
      drawingRef.current = false;
    }

    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => setIsRevealing(false), 300);
  };

  const nextTurn = async () => {
    if (!isMyTurn && !isHost) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    const next = (turnIndex + 1) % players.length;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        turnIndex: next,
        currentCard: null,
      });
      setChoice(null);
    } finally {
      advancingRef.current = false;
    }
  };

  const restartRef = useRef(false);
  const handleRestart = async () => {
    if (!isHost || restartRef.current) return;
    restartRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        turnIndex: 0,
        currentCard: null,
        history: [],
      });
      setChoice(null);
    } finally {
      restartRef.current = false;
    }
  };

  const ErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
      {errorMsg}
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-4 pb-6 flex-1">
      <ErrorToast />
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      {/* Stats Bar */}
      <div className="flex-between">
        <div className="inline-flex items-center gap-2 bg-cream-100 border-2 border-cream-200 rounded-full px-3.5 py-2">
          <span className="text-[12px] font-extrabold text-olive-600">
            รอบที่ {history.length + (currentCard ? 0 : 1)}
          </span>
        </div>
        {isHost && (
          <button className="btn btn-outline py-2 px-3 text-[12px] min-h-[40px]" onClick={handleRestart}>
            <RotateCcw size={13} /> เริ่มใหม่
          </button>
        )}
      </div>

      {/* Turn Indicator */}
      <div className={`rounded-2xl p-3 border-2 text-center ${isMyTurn ? 'bg-sage-50 border-sage-200' : 'bg-cream-50 border-cream-200'}`}>
        <p className="text-[11px] text-olive-400 font-bold uppercase tracking-wider mb-1">
          ตาของ
        </p>
        <p className={`text-[15px] font-extrabold ${isMyTurn ? 'text-sage-700' : 'text-olive-700'}`}>
          {isMyTurn ? 'ตาของคุณ!' : currentPlayer}
        </p>
      </div>

      {/* Turn Order */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{WebkitOverflowScrolling:'touch'}}>
        {players.map((name, idx) => (
          <div key={name} className="flex items-center shrink-0">
            <div className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
              idx === (turnIndex % players.length)
                ? 'bg-sage-500 text-white'
                : 'bg-cream-100 text-olive-500'
            }`}>
              {name === nickname ? 'คุณ' : name}
            </div>
            {idx < players.length - 1 && <ChevronRight size={12} className="text-olive-200 mx-0.5 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Card Area */}
      <div className="flex-center flex-1" style={{minHeight:'260px'}}>
        <AnimatePresence mode="wait">
          {currentCard ? (
            <motion.div
              key={currentCard.timestamp}
              initial={{ opacity: 0, y: 30, rotateY: 90 }}
              animate={{ opacity: 1, y: 0, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={`w-full max-w-[320px] card p-6 flex flex-col items-center gap-4 border-2 ${
                currentCard.type === 'truth'
                  ? 'border-blue-200 bg-gradient-to-b from-blue-50 to-white'
                  : 'border-red-200 bg-gradient-to-b from-red-50 to-white'
              }`}
            >
              {/* Badge */}
              <div className={`px-4 py-1.5 rounded-full text-[13px] font-extrabold ${
                currentCard.type === 'truth'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-red-100 text-red-600'
              }`}>
                {currentCard.type === 'truth' ? 'ความจริง' : 'ท้าทาย'}
              </div>

              {/* Question */}
              <p className="text-[16px] font-bold text-olive-800 text-center leading-relaxed">
                {currentCard.text}
              </p>

              {/* Player */}
              <p className="text-[12px] text-olive-400 font-semibold">
                {currentCard.player === nickname ? 'คุณ' : currentCard.player}
              </p>

              {/* Next Turn */}
              {(isMyTurn || isHost) && (
                <button
                  className="btn btn-primary w-full py-3.5 text-[15px] mt-2"
                  onClick={nextTurn}
                >
                  คนถัดไป
                </button>
              )}
            </motion.div>
          ) : isMyTurn ? (
            <motion.div
              key="choose"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-[320px] flex flex-col items-center gap-4"
            >
              <p className="text-[14px] text-olive-600 font-bold text-center mb-2">
                เลือกเลย!
              </p>

              <div className="grid grid-cols-2 gap-3 w-full">
                {/* Truth */}
                <button
                  className="card p-5 flex flex-col items-center gap-2 border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-white active:scale-95 transition-transform"
                  onClick={() => drawCard('truth')}
                  disabled={isRevealing}
                >
                  <span className="text-4xl"></span>
                  <span className="font-extrabold text-blue-600 text-[15px]">ความจริง</span>
                  <span className="text-[10px] text-olive-400 font-semibold">TRUTH</span>
                </button>

                {/* Dare */}
                <button
                  className="card p-5 flex flex-col items-center gap-2 border-2 border-red-200 bg-gradient-to-b from-red-50 to-white active:scale-95 transition-transform"
                  onClick={() => drawCard('dare')}
                  disabled={isRevealing}
                >
                  <span className="text-4xl"></span>
                  <span className="font-extrabold text-red-600 text-[15px]">ท้าทาย</span>
                  <span className="text-[10px] text-olive-400 font-semibold">DARE</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-5xl"
              >
              </motion.div>
              <p className="font-bold text-olive-500 text-sm text-center">
                รอ {currentPlayer} เลือก...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Leave button for non-host */}
      {!isHost && (
        <button className="btn btn-outline w-full py-3 text-[13px]" onClick={requestLeave}>
          <LogOut size={14} /> ออกจากห้อง
        </button>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="text-[10px] text-olive-400 font-bold uppercase tracking-wider mb-1.5">ประวัติ</p>
          <div className="flex overflow-x-auto gap-1.5 pb-1" style={{WebkitOverflowScrolling:'touch'}}>
            {[...history].reverse().slice(0, 10).map((h, i) => (
              <div
                key={i}
                className={`shrink-0 px-2.5 py-1.5 text-[10px] font-bold rounded-lg border-2 max-w-[140px] ${
                  h.type === 'truth'
                    ? 'bg-blue-50 border-blue-100 text-blue-600'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}
              >
                <span className="block truncate">{h.player === nickname ? 'คุณ' : h.player}</span>
                <span className="block truncate opacity-70">{h.type === 'truth' ? '' : ''} {h.text.substring(0, 25)}...</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TruthOrDare;
