import React, { useEffect } from "react";
import { Siren, X } from "lucide-react";

interface NotificationToastProps {
  message: string;
  subtext?: string;
  onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  message,
  subtext,
  onClose
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed bottom-6 right-6 z-50 bg-red-600 text-white p-4 rounded-2xl shadow-2xl max-w-sm w-full border border-red-500 animate-in fade-in slide-in-from-bottom-5 duration-300 flex items-start gap-3"
      id="emergency-alert-toast"
    >
      <div className="p-2 bg-red-700/80 rounded-xl shrink-0">
        <Siren className="w-6 h-6 text-white animate-pulse" />
      </div>
      <div className="flex-1 pr-2">
        <h4 className="font-bold text-sm tracking-tight flex items-center gap-1.5 uppercase">
          {message}
        </h4>
        {subtext && <p className="text-xs text-red-100 mt-1">{subtext}</p>}
      </div>
      <button
        onClick={onClose}
        className="text-red-200 hover:text-white p-1 rounded-lg hover:bg-red-700/50 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
