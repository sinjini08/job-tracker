import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

// Delete the signed-in user's account. Their applications, history and profile
// go with it (ON DELETE CASCADE from auth.users).
export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { error } = await supabaseAdmin().auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await user.sb.auth.signOut();
  return new NextResponse(null, { status: 204 });
}
