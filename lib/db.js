import 'server-only';
import { enabledSheets, sheetLabel } from './fields';
import { linkParts } from './job-link.js';

// Data access for ONE user. Every query is filtered by user_id and every insert
// stamps it, whichever client is used. With the signed-in user's client, RLS
// enforces the same rule again in the database; with the service-role client
// (share links, Claude connector) this filter is the boundary, so all access
// goes through here.
export function storeFor(client, userId) {
  if (!userId) throw new Error('storeFor needs a user id');
  const run = async (q) => {
    const { data, error } = await q;
    if (error) throw new Error(error.code === 'PGRST116' ? 'Not found' : error.message);
    return data;
  };
  const apps = () => client.from('applications');
  const events = () => client.from('application_events');

  const assertOwned = (id) =>
    run(apps().select('id').eq('id', id).eq('user_id', userId).single());

  return {
    userId,
    // Which sheets this student keeps and what they are called, in tab order.
    // The connector speaks in these names rather than the stored keys.
    sheets: async () => {
      const row = await run(client.from('profiles')
        .select('sheets_enabled, sheet_names').eq('id', userId).maybeSingle());
      const names = row?.sheet_names ?? {};
      return enabledSheets(row?.sheets_enabled).map((key) => ({ key, name: sheetLabel(key, names) }));
    },
    // Is this posting already in the tracker.
    //
    // Narrower than it looks on purpose. The caller has to supply the link,
    // so it can only answer about a page somebody is already looking at, and
    // it answers with the little that is useful for that question rather than
    // the row. Job links carry tracking parameters that differ between
    // visits, so the comparison is on the address without them.
    findByLink: async (link) => {
      const parts = linkParts(link);
      if (!parts) return null;
      // Escaped, because a URL may contain the wildcards ilike understands.
      const esc = (t) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

      let q = apps()
        .select('id, role, company, status, type, created_at, date_applied')
        .eq('user_id', userId)
        .ilike('job_link', `${esc(parts.base)}%`);

      // When the posting is identified by the query rather than by the path,
      // the path alone matches every job on that board's search page, so
      // those parameters have to be in the comparison too.
      for (const mark of parts.marks) q = q.ilike('job_link', `%${esc(mark)}%`);

      const rows = await run(q.order('created_at', { ascending: false }).limit(1));
      return rows?.[0] ?? null;
    },
    listApplications: () =>
      run(apps().select('*').eq('user_id', userId).order('created_at', { ascending: true })),
    getApplication: (id) => run(apps().select('*').eq('id', id).eq('user_id', userId).single()),
    createApplication: (row) =>
      run(apps().insert({ ...row, user_id: userId }).select().single()),
    updateApplication: (id, patch) =>
      run(apps().update(patch).eq('id', id).eq('user_id', userId).select().single()),
    deleteApplication: async (id) => {
      await assertOwned(id);
      return run(apps().delete().eq('id', id).eq('user_id', userId));
    },
    listEvents: (id) =>
      run(events().select('*').eq('application_id', id).eq('user_id', userId)
        .order('event_date', { ascending: false }).order('created_at', { ascending: false })),
    listAllEvents: () =>
      run(events().select('application_id, event_date, kind, detail, created_at')
        .eq('user_id', userId).order('created_at', { ascending: true })),
    addEvent: async (row) => {
      await assertOwned(row.application_id);
      return run(events().insert(row).select().single()); // user_id set by the event_owner trigger
    },
  };
}
