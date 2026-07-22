// ============================================================
// supabase.js — configuração central do Supabase + modo demo
// ============================================================
// Preencha SUPABASE_URL e SUPABASE_ANON_KEY com os dados do seu
// projeto (Project Settings > API no painel do Supabase).
//
// Enquanto DEMO_MODE estiver true, o jogo roda 100% no navegador,
// sem precisar de nenhuma configuração — ótimo para testar a
// interface e o fluxo completo antes de plugar o Supabase real.
// ============================================================

export const SUPABASE_URL = "https://darqnnrguolfvlsbuyli.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_lQq4g0LJ12LprEfAeflxsw_TO_CA_Ej";

// Troque para false quando o Supabase estiver configurado.
export const DEMO_MODE = false;

let _client = null;

/**
 * Retorna o client do Supabase (singleton), carregando a lib via CDN
 * apenas quando necessário (não é carregada em DEMO_MODE).
 */
export async function getSupabaseClient() {
  if (DEMO_MODE) return null;
  if (_client) return _client;

  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2"
  );
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return _client;
}
