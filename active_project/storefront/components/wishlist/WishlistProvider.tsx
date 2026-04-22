'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product } from 'lib/products';

type WishlistContextType = {
  items: Product[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
};

const WishlistContext = createContext<WishlistContextType>({
  items: [],
  addToWishlist: () => {},
  removeFromWishlist: () => {},
  isInWishlist: () => false,
});

export const useWishlist = () => useContext(WishlistContext);

const STORAGE_KEY = '_ze_wishlist';

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Product[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setMounted(true);
  }, []);

  const saveItems = (newItems: Product[]) => {
    setItems(newItems);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
    } catch {}
  };

  const addToWishlist = useCallback((product: Product) => {
    setItems((prev) => {
      if (prev.find((p) => p.id === product.id)) return prev;
      const newItems = [...prev, product];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems)); } catch {}
      return newItems;
    });
  }, []);

  const removeFromWishlist = useCallback((productId: string) => {
    setItems((prev) => {
      const newItems = prev.filter((p) => p.id !== productId);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems)); } catch {}
      return newItems;
    });
  }, []);

  const isInWishlist = useCallback((productId: string) => {
    return items.some((p) => p.id === productId);
  }, [items]);

  if (!mounted) return <>{children}</>;

  return (
    <WishlistContext.Provider value={{ items, addToWishlist, removeFromWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}
