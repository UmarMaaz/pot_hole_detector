import { createClient } from '@supabase/supabase-js';

// Robust helper to get environment variables in various environments (Vite, Process, etc.)
const getEnv = (key: string): string | undefined => {
  // Check process.env (Standard Node/Vercel)
  if (typeof process !== 'undefined' && process.env && (process.env as any)[key]) {
    return (process.env as any)[key];
  }
  // Check import.meta.env (Vite local dev)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[`VITE_${key}`]) {
    // @ts-ignore
    return import.meta.env[`VITE_${key}`];
  }
  return undefined;
};

const supabaseUrl = getEnv('SUPABASE_URL') || 'https://zipipywbykofdikpvkor.supabase.co';
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') || 'sb_publishable_6yg_9HSvWMEtWsHd4SFEFA_9ZMnZ24D';

// Comprehensive configuration check
export const isSupabaseConfigured = !!(supabaseUrl && supabaseUrl.startsWith('http') && supabaseAnonKey);

// Initialize client only if valid configuration exists
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export const potholeService = {
  async getAll() {
    if (!supabase) return [];
    
    try {
      const { data, error } = await supabase
        .from('potholes')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (error) {
          console.error("Supabase Select Error:", error);
          return [];
      }
      return data || [];
    } catch (e) {
      console.error("Supabase Connection Exception:", e);
      return [];
    }
  },

  async insert(pothole: any) {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('potholes')
      .insert([pothole])
      .select();
    
    if (error) {
      console.error("Supabase Insert Error:", error);
      throw error;
    }
    return data;
  },

  async delete(id: string) {
    if (!supabase) return;
    
    const { error } = await supabase
      .from('potholes')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error("Supabase Delete Error:", error);
      throw error;
    }
  },

  async deleteAll() {
    if (!supabase) return;
    
    const { error } = await supabase
      .from('potholes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      console.error("Supabase Wipe Error:", error);
      throw error;
    }
  }
};