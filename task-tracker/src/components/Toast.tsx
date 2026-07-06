import { useEffect, useState, useRef } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const dismiss = () => {
    timersRef.current.forEach(clearTimeout);
    setVisible(false);
    setTimeout(() => onClose(), 300);
  };

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setVisible(true), 10);
    // Start exit animation
    const exitTimer = setTimeout(() => setVisible(false), duration - 300);
    // Unmount after exit animation
    const closeTimer = setTimeout(() => onClose(), duration);

    timersRef.current = [enterTimer, exitTimer, closeTimer];

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, [duration, onClose]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 bg-white border border-emerald-200 shadow-lg rounded-xl text-sm font-medium text-emerald-700 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
    >
      <CheckCircle size={16} className="text-emerald-500 shrink-0" />
      {message}
      <button
        onClick={dismiss}
        aria-label="Dismiss notification"
        className="ml-1 -mr-1 p-0.5 rounded hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
