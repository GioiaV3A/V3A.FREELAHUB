import { createClient } from '@supabase/supabase-js';

// Suppress known Supabase Auth refresh token console errors and uncaught rejections
if (typeof window !== 'undefined') {
  const isRefreshTokenError = (arg: any): boolean => {
    if (!arg) return false;
    const msg = typeof arg === 'object' ? (arg.message || arg.error_description || JSON.stringify(arg)) : String(arg);
    return msg.includes('Refresh Token Not Found') || msg.includes('Invalid Refresh Token') || msg.includes('invalid_grant');
  };

  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (args.some(isRefreshTokenError)) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (args.some(isRefreshTokenError)) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isRefreshTokenError(event.reason)) {
      event.preventDefault();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client-side Supabase client using the publishable anon key
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: typeof window !== 'undefined',
    detectSessionInUrl: typeof window !== 'undefined',
  },
});

// Server-side Admin client using the service role key
export const getSupabaseAdmin = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || serviceRoleKey === 'INSERT_YOUR_SERVICE_ROLE_KEY_HERE') {
    console.error("SUPABASE_SERVICE_ROLE_KEY is missing in server environment.");
    throw new Error("Não foi possível criar o usuário do Head porque a chave de serviço do Supabase não está configurada no servidor.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
