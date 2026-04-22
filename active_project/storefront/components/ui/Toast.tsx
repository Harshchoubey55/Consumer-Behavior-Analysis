'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type ToastItem = {
  id: string;
  message: string;
  image?: string;
  productName?: string;
};

type ToastContextType = {
  showToast: (message: string, image?: string, productName?: string) => void;
};

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, image?: string, productName?: string) => {
    const id = Math.random().toString(36).substring(2);
    setToasts((prev) => [...prev, { id, message, image, productName }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast-enter flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-lg"
          >
            {toast.image && (
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                <Image src={toast.image} alt="" fill className="object-cover" sizes="40px" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-800">{toast.message}</p>
              {toast.productName && (
                <p className="truncate text-xs text-stone-500">{toast.productName}</p>
              )}
            </div>
            <Link href="/cart" className="ml-2 shrink-0 text-xs font-semibold text-stone-600 underline underline-offset-2 hover:text-stone-900">
              View Cart
            </Link>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
