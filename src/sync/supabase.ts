import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Without backend settings the app runs in demo mode on local data only. */
export const isDemoMode = !url || !anonKey;

export const supabase: SupabaseClient | null = isDemoMode
  ? null
  : createClient(url!, anonKey!, {
      auth: { storage: Storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });

export const PHOTO_BUCKET = 'inspection-photos';
