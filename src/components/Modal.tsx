import { X } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-warm-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-3xl shadow-2xl shadow-warm-200 w-full ${maxWidth} max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-warm-100">
          <h2 className="text-base font-semibold text-warm-700">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-warm-300 hover:text-warm-500 hover:bg-warm-50 rounded-xl transition-all"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto p-7">
          {children}
        </div>
      </div>
    </div>
  );
}
