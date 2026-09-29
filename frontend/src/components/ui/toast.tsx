"use client";
import React, { createContext, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = (type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);

    // Apple spec: auto-dismiss after 3500ms
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Apple Toast: Pinned top, centered, 14px radius, no shadow, solid color pill */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 max-w-md w-full px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-[14px] text-white animate-fade-in transition-all duration-200 w-full",
              t.type === "success" && "bg-primary",
              t.type === "error" && "bg-danger",
              t.type === "warning" && "bg-warning",
              t.type === "info" && "bg-[#272729]"
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className="shrink-0">
                {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-white" />}
                {t.type === "error" && <AlertCircle className="w-4 h-4 text-white" />}
                {t.type === "warning" && <AlertTriangle className="w-4 h-4 text-white" />}
                {t.type === "info" && <Info className="w-4 h-4 text-white" />}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white leading-tight">{t.title}</span>
                {t.message && <span className="text-xs text-white/90 font-normal mt-0.5">{t.message}</span>}
              </div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-white/80 hover:text-white p-1 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toast: (type: ToastType, title: string, message?: string) => {
        console.log(`[Toast ${type}]: ${title} ${message || ""}`);
      },
    };
  }
  return context;
}

export default ToastProvider;
