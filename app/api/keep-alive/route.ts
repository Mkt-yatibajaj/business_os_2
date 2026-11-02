import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, status: 'unconfigured' }, { status: 200 });
  }
  try {
    const supabase = createClient(url, key);
    const { error } = await supabase.from('categories').select('id').limit(1);
    return NextResponse.json({
      ok: !error,
      service: 'Advaitum Business OS',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, timestamp: new Date().toISOString() }, { status: 200 });
  }
}
