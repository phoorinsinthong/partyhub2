import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LeaveConfirmModal = ({ onConfirm, onCancel }) => (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex-center p-6"
      style={{ background: 'rgba(47,42,34,0.5)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
        transition={{ duration: 0.15 }}
        className="card p-6 w-full max-w-[300px] flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <p className="font-bold text-[15px] text-olive-800 text-center leading-relaxed">
          ออกจากเกมกลางคัน?
        </p>
        <div className="flex gap-3">
          <button className="btn btn-outline flex-1 py-3 text-[14px]" onClick={onCancel}>ยกเลิก</button>
          <button
            className="btn btn-primary flex-1 py-3 text-[14px]"
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
