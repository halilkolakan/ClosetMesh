import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import type { ClothingItem } from '../types';

type Database = {
  public: {
    Tables: {
      clothing_items: {
        Row: { [Key in keyof ClothingItem]: ClothingItem[Key] };
        Insert: Omit<ClothingItem, 'id' | 'created_at'>;
        Update: Partial<Omit<ClothingItem, 'id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function isValidSupabaseUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
  } catch {
    return false;
  }
}

const validSupabaseUrl = isValidSupabaseUrl(supabaseUrl) ? supabaseUrl : null;

export const isSupabaseConfigured =
  Boolean(supabaseAnonKey?.trim()) && validSupabaseUrl !== null;

export const supabase = createClient<Database>(
  validSupabaseUrl ?? 'https://placeholder.supabase.co',
  isSupabaseConfigured && supabaseAnonKey ? supabaseAnonKey : 'local-development-placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
  },
);
