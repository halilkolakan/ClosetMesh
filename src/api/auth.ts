import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../config/supabase';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createLocalGuestUser(): User {
  const timestamp = new Date().toISOString();
  return {
    id: 'local-guest',
    app_metadata: { provider: 'anonymous', providers: ['anonymous'] },
    user_metadata: {},
    aud: 'authenticated',
    created_at: timestamp,
    updated_at: timestamp,
    is_anonymous: true,
  };
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  try {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase ortam değişkenleri tanımlı değil veya URL geçersiz.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    if (!data.user) {
      throw new Error('Supabase giriş yanıtında kullanıcı bilgisi bulunamadı.');
    }
    return data.user;
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[auth] E-posta ile giriş başarısız:', message);
    throw new Error(`E-posta ile giriş başarısız: ${message}`);
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<User> {
  try {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase ortam değişkenleri tanımlı değil veya URL geçersiz.');
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      throw error;
    }
    if (!data.user) {
      throw new Error('Supabase kayıt yanıtında kullanıcı bilgisi bulunamadı.');
    }
    return data.user;
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[auth] E-posta ile kayıt başarısız:', message);
    throw new Error(`E-posta ile kayıt başarısız: ${message}`);
  }
}

export async function signInAnonymously(): Promise<User> {
  try {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase ortam değişkenleri tanımlı değil veya URL geçersiz.');
    }
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      throw error;
    }
    if (!data.user) {
      throw new Error('Supabase anonim giriş yanıtında kullanıcı bilgisi bulunamadı.');
    }
    return data.user;
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[auth] Anonim giriş başarısız:', message);
    throw new Error(`Anonim giriş başarısız: ${message}`);
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    if (!isSupabaseConfigured) {
      return null;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    return data.session?.user ?? null;
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[auth] Aktif kullanıcı alınamadı:', message);
    throw new Error(`Aktif kullanıcı alınamadı: ${message}`);
  }
}

export async function signOut(): Promise<void> {
  try {
    if (!isSupabaseConfigured) {
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[auth] Oturum kapatılamadı:', message);
    throw new Error(`Oturum kapatılamadı: ${message}`);
  }
}
