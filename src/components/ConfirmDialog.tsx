"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

const ConfirmContext = createContext<(message: string) => Promise<boolean>>(async () => false);

/** 삭제 전 확인 대화상자. const confirm = useConfirm(); if (await confirm("...")) ... */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const resolver = useRef<(ok: boolean) => void>(() => {});

  const confirm = useCallback((text: string) => {
    setMessage(text);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    setMessage(null);
    resolver.current(ok);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {message !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={() => close(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-message"
            className="w-80 rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && close(false)}
          >
            <p id="confirm-message" className="mb-4 text-sm text-slate-800">
              {message}
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => close(false)} autoFocus>
                취소
              </button>
              <button className="btn btn-danger" onClick={() => close(true)}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
