import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';

/**
 * Hook สำหรับคืนชีพสถานะ (Seamless Recovery)
 * ถ้าผู้เล่นเผลอปิดหน้าจอ หรือเน็ตหลุดตู้ม
 * พอเข้ามาใหม่ จะถูกดึงกลับเข้าห้องและสถานะเดิมทันที
 */
export function useSessionRecovery() {
  const { roomId, userNickname, setRoomId } = useGame();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 1. ดึงข้อมูลจาก LocalStorage
    const savedRoomId = localStorage.getItem('lastRoomId');
    const savedNickname = localStorage.getItem('nickname');
    const savedTimestamp = localStorage.getItem('lastActiveTime');
    
    // ถ้าไม่มีข้อมูล หรืออยู่ที่หน้าแรก ให้เช็คว่าควรดึงกลับไปไหม
    if (location.pathname === '/' && savedRoomId && savedNickname) {
      const now = Date.now();
      const lastActive = savedTimestamp ? parseInt(savedTimestamp, 10) : 0;
      
      // ถ้าเพิ่งหลุดไปไม่เกิน 1 ชั่วโมง (3600000 ms) ให้คืนชีพกลับเข้าห้องเดิม
      if (now - lastActive < 3600000) {
        console.log('[Recovery] Restoring session for', savedNickname, 'in room', savedRoomId);
        setRoomId(savedRoomId);
        
        // เช็คก่อนว่าจริงๆ แล้วตอนหลุด หลุดจากหน้าเล่นเกม หรือหน้าล็อบบี้
        // เราสามารถเดาจาก localStorage.getItem('lastPath') ก็ได้ แต่เพื่อความชัวร์ ดันเข้า Game หรือ Lobby ไปก่อน
        const lastPath = localStorage.getItem('lastPath');
        if (lastPath) {
          navigate(lastPath, { replace: true });
        } else {
          navigate(`/game/${savedRoomId}`, { replace: true });
        }
      } else {
        // ถ้าเกิน 1 ชั่วโมง ถือว่า session หมดอายุ
        localStorage.removeItem('lastRoomId');
        localStorage.removeItem('lastPath');
      }
    }
  }, [location.pathname, navigate, setRoomId]);

  // คอยอัปเดต timestamp ล่าสุดเสมอเวลาที่อยู่หน้าล็อบบี้หรือหน้าเกม
  useEffect(() => {
    if (roomId && userNickname) {
      localStorage.setItem('lastRoomId', roomId);
      localStorage.setItem('lastActiveTime', Date.now().toString());
      localStorage.setItem('lastPath', location.pathname);
    }
  }, [roomId, userNickname, location.pathname]);
}
