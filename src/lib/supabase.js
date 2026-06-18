import { createClient } from '@supabase/supabase-js';
import { getAppConfig } from './config.js';

let client = null;

export function getSupabase() {
  if (client) return client;

  const { supabaseUrl, supabaseAnonKey, isConfigured } = getAppConfig();
  if (!isConfigured) return null;

  client = createClient(supabaseUrl, supabaseAnonKey);
  return client;
}

export function functionsUrl(name) {
  const { supabaseUrl } = getAppConfig();
  return `${supabaseUrl}/functions/v1/${name}`;
}
