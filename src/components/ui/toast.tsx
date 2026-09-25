"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: ReactNode;
  action?: { label: string; onClick: () => void };
}

const ToastContext = createContext<(t: Omit<Toast, "id">) => void>(() => {});

/** `toast({ message, action })` — short confirmation with optional Undo. */
export function useToast() {
  return useContext(ToastContext);
}

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);

  const show = useCallback((t: Omit<Toast, "id">) => {
    const id = ++next.current;
    setToasts((all) => [...all.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-[60] flex flex-col items-center gap-2 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end"
      >
        {toasts.map((t) => (
          <div key={t.id} className="animate-pop pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg bg-inverse py-2.5 pr-3 pl-3.5 text-sm text-on-inverse shadow-pop">
            <span className="grow">{t.message}</span>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
                className="h-7 rounded-[5px] bg-on-inverse/15 px-2 text-[12.5px] font-medium hover:bg-on-inverse/25"
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
