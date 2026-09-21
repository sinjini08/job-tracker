import 'server-only';
import { randomInt } from 'node:crypto';

// Leagues: a group of friends and their leaderboard.
//
// This is the only feature that shows one student anything about another, so
// the rule is that it goes through the database's own functions. `league_board`
// is security-definer and returns aggregates; `join_league` looks up a code the
// joiner isn't yet allowed to read. Everything else obeys the usual RLS, which
// limits a member to the leagues they belong to.

// No I, O, 0 or 1: the code gets read aloud and typed from a screenshot.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 6;
const MAX_LEAGUES = 12;

export const normalizeCode = (code) =>
  String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

function newCode() {
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

const run = async (q) => {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
};

export function leaguesFor(client, userId) {
  if (!userId) throw new Error('leaguesFor needs a user id');

  const myLeagues = async () => {
    const rows = await run(client
      .from('league_members')
      .select('joined_at, leagues!inner(id, name, join_code, owner_id, created_at)')
      .eq('user_id', userId));
    // RLS lets a member read every membership row of their own leagues, which
    // is how the member count is available without another round trip.
    const ids = rows.map((r) => r.leagues.id);
    const members = ids.length
      ? await run(client.from('league_members').select('league_id').in('league_id', ids))
      : [];
    const size = members.reduce((m, r) => m.set(r.league_id, (m.get(r.league_id) ?? 0) + 1), new Map());
    return rows
      .map((r) => ({ ...r.leagues, joined_at: r.joined_at, members: size.get(r.leagues.id) ?? 1,
        is_owner: r.leagues.owner_id === userId }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  };

  return {
    myLeagues,

    create: async (name) => {
      const mine = await myLeagues();
      if (mine.length >= MAX_LEAGUES) throw new Error(`You can be in ${MAX_LEAGUES} leagues at once.`);
      const title = String(name ?? '').trim().slice(0, 60) || 'My league';
      // Codes are short enough to collide; the unique index is the referee.
      for (let attempt = 0; attempt < 6; attempt++) {
        const { data, error } = await client.from('leagues')
          .insert({ name: title, join_code: newCode(), owner_id: userId })
          .select().single();
        if (!error) {
          await run(client.from('league_members').insert({ league_id: data.id, user_id: userId }));
          return { ...data, members: 1, is_owner: true };
        }
        if (error.code !== '23505') throw new Error(error.message);
      }
      throw new Error('Could not allocate a join code. Try again.');
    },

    join: async (code) => {
      const clean = normalizeCode(code);
      if (clean.length < 4) throw new Error('That code looks too short.');
      const id = await run(client.rpc('join_league', { p_code: clean }));
      return (await myLeagues()).find((l) => l.id === id) ?? null;
    },

    // The owner leaving deletes the league: a board with a dangling owner is
    // worse than asking them to hand it over by making a new one.
    leave: async (leagueId) => {
      const league = (await myLeagues()).find((l) => l.id === leagueId);
      if (!league) throw new Error('Not found');
      if (league.is_owner) return run(client.from('leagues').delete().eq('id', leagueId));
      return run(client.from('league_members').delete()
        .eq('league_id', leagueId).eq('user_id', userId));
    },

    // Only the owner can do this (RLS enforces it). The person removed can
    // rejoin with the code — it's a nudge, not a ban.
    removeMember: async (leagueId, memberId) => {
      if (memberId === userId) throw new Error('Use leave to remove yourself.');
      return run(client.from('league_members').delete()
        .eq('league_id', leagueId).eq('user_id', memberId));
    },

    rename: async (leagueId, name) => run(client.from('leagues')
      .update({ name: String(name ?? '').trim().slice(0, 60) || 'My league' })
      .eq('id', leagueId).select().single()),

    // Raw rows: the page ranks them, because the ordering depends on which
    // period the student is looking at.
    board: async (leagueId) => (await run(client.rpc('league_board', { p_league_id: leagueId }))) ?? [],

    pointValues: () => run(client.from('point_values').select('*').order('sort')),
  };
}
