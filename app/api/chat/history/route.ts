import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  console.log('--- app/api/chat/history/route.ts GET received ---');

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
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    console.error('Session ID is required.');
    return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
  }

  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('sender, content, created_at')
      .eq('conversation_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Failed to retrieve message history.' }, { status: 500 });
    }

    console.log(`Fetched ${messages.length} messages for sessionId: ${sessionId}`);
    return NextResponse.json(messages, { status: 200 });

  } catch (error) {
    console.error('Chat history API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
