import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LeaveConfirmModal = ({ onConfirm, onCancel }) => (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex-center p-6 bg-slate-950/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
        transition={{ duration: 0.15 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 w-full max-w-[300px] flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <p className="font-bold text-[15px] text-white text-center leading-relaxed">
          ออกจากเกมกลางคัน?
        </p>
        <div className="flex gap-3">
          <button className="bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl py-3 flex-1 text-[14px]" onClick={onCancel}>ยกเลิก</button>
          <button
            className="bg-neon-blue text-white font-bold rounded-xl py-3 shadow-[0_0_15px_rgba(0,240,255,0.3)] flex-1 text-[14px]"
            style={{ background: '#ef4444', borderColor: '#ef4444' }}
            onClick={onConfirm}
          >
            ออก
          </button>
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

export default LeaveConfirmModal;
