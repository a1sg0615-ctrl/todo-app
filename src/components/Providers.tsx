"use client";

import type { ReactNode } from "react";
import { ConfirmProvider } from "./ConfirmDialog";
import { ToastProvider } from "./Toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
