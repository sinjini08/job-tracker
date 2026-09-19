import 'server-only';

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
