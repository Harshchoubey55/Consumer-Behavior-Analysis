'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type User = {
  userId: string;
  name: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  isSignedIn: boolean;
  signIn: (email: string, password?: string) => Promise<boolean>;
  signUp: (name: string, email: string, password?: string) => Promise<boolean>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isSignedIn: false,
  signIn: async () => false,
  signUp: async () => false,
  signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);

const STORAGE_KEY = '_ze_user';
const MOCK_DB_KEY = '_ze_users_db'; // Mock database

function generateUserId(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i);
    hash |= 0;
  }
  return 'user_' + Math.abs(hash).toString(36);
}

/**
 * Hash a password using SHA-256 via the Web Crypto API.
 * Returns a hex-encoded digest string.
 * This prevents raw plaintext credentials from sitting in localStorage.
 */
async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setMounted(true);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password?: string) => {
    try {
      const db = JSON.parse(localStorage.getItem(MOCK_DB_KEY) || '{}');
      if (db[email]) return false; // Email already exists
      
      const newUserId = generateUserId(email);
      const hashedPw = password ? await hashPassword(password) : undefined;
      db[email] = { name, email, password: hashedPw, userId: newUserId };
      localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));

      const u: User = { userId: newUserId, name, email };
      setUser(u);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      return true;
    } catch {
      return false;
    }
  }, []);

  const signIn = useCallback(async (email: string, password?: string) => {
    try {
      const db = JSON.parse(localStorage.getItem(MOCK_DB_KEY) || '{}');
      const record = db[email];
      
      if (!record) return false;

      // Compare SHA-256 hash of the provided password against stored hash
      const hashedPw = password ? await hashPassword(password) : undefined;
      if (record.password !== hashedPw) {
        return false;
      }
      
      const u: User = { userId: record.userId, name: record.name, email };
      setUser(u);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      return true;
    } catch {
      return false;
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  if (!mounted) return <>{children}</>;

  return (
    <AuthContext.Provider value={{ user, isSignedIn: !!user, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
