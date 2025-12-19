import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  console.log('--- app/api/chat/sessions/route.ts GET received ---');

  // --- Environment Variable Checks ---
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; // Changed from ANON_KEY

  if (!supabaseUrl) {
    console.error('Environment variable NEXT_PUBLIC_SUPABASE_URL is not set.');
    return NextResponse.json({ error: 'Environment variable NEXT_PUBLIC_SUPABASE_URL is not set.' }, { status: 500 });
  }
  if (!supabasePublishableKey) {
    console.error('Environment variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set.');
    return NextResponse.json({ error: 'Environment variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set.' }, { status: 500 });
  }
  // --- End Environment Variable Checks ---

  const supabase = await createClient(); // Initialize Supabase client AFTER env checks AND await it
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    console.error('User ID is required.');
    return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
  }

  try {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json({ error: 'Failed to retrieve conversations.' }, { status: 500 });
    }

    console.log('Successfully fetched conversations for userId:', userId);
    return NextResponse.json(conversations, { status: 200 });

  } catch (error) {
    console.error('Chat sessions API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
