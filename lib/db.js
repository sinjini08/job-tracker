import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { memoryStore } from './memory-store';

// All data access goes through this store. In production it's Supabase (with the
// service-role key, so it must only ever run on the server; `server-only` makes
// the build fail if a client component imports this). With DEMO_MODE=1 in local
// dev it's an in-memory store, so the UI can be tried before Supabase exists.

function supabaseStore() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const run = async (q) => {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  };
  return {
    listApplications: () =>
      run(sb.from('applications').select('*').order('created_at', { ascending: true })),
    createApplication: (row) => run(sb.from('applications').insert(row).select().single()),
    updateApplication: (id, patch) =>
      run(sb.from('applications').update(patch).eq('id', id).select().single()),
    deleteApplication: (id) => run(sb.from('applications').delete().eq('id', id)),
    listEvents: (id) =>
      run(sb.from('application_events').select('*').eq('application_id', id)
        .order('event_date', { ascending: false }).order('created_at', { ascending: false })),
    addEvent: (row) => run(sb.from('application_events').insert(row).select().single()),
    listAllEvents: () =>
      run(sb.from('application_events').select('application_id, event_date, kind, detail, created_at')
        .order('created_at', { ascending: true })),
  };
}

let store;
export function db() {
  if (!store) {
    const demo = process.env.DEMO_MODE === '1' && process.env.NODE_ENV !== 'production';
    store = demo ? memoryStore() : supabaseStore();
  }
  return store;
}
