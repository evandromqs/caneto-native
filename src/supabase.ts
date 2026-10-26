import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://huooiccnyprldwjdikvq.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1b29pY2NueXBybGR3amRpa3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NzUyMDMsImV4cCI6MjEwMzQ1MTIwM30.6JPKVALiMIk178NQVak7uxLtJiNB3wNB6qw3kpklNwo';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key, {
  auth: {
    storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
