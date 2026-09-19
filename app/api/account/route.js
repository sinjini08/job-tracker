import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

// Delete the signed-in student's account: their rows (applications, history,
// connections cascade from the profile row) and then the Clerk user itself.
export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { error } = await supabaseAdmin().from('profiles').delete().eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    await (await clerkClient()).users.deleteUser(user.id);
  } catch (e) {
    return NextResponse.json({ error: `Data deleted, but the account remains: ${e.message}` }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
