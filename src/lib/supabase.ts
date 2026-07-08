import { createClient } from '@supabase/supabase-js';

// Captura as variáveis de ambiente carregadas pelo Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Inicializa e exporta o cliente do Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);