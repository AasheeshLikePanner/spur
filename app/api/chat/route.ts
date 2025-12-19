import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAIResponse, ConversationEntry, generateChatTitle } from '@/lib/llm';
import { getMemories, summarizeAndStoreFacts } from '@/lib/memory';

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!supabaseUrl || !supabasePublishableKey || !groqApiKey) {
    return NextResponse.json({ error: 'Missing environment variables.' }, { status: 500 });
  }

  const supabase = await createClient();

  try {
    const { message, sessionId, userId, name } = await req.json();

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return NextResponse.json({ error: 'User ID (Name) is required.' }, { status: 400 });
    }

    // 1. Create Conversation (if name provided)
    if (!message && name) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: userId, name: name })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating named conversation:', error);
        return NextResponse.json({ error: 'Failed to create new named conversation.' }, { status: 500 });
      }
      return NextResponse.json({ sessionId: data.id }, { status: 200 });
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 });
    }

    let conversationId = sessionId;

    // 2. Find or Create Conversation for Message
    if (!conversationId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: userId, name: 'New Chat' })
        .select('id')
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to start new conversation.' }, { status: 500 });
      }
      conversationId = data.id;
    } else {
      // Verify ownership
      const { data, error } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Conversation not found or access denied.' }, { status: 404 });
      }
    }

    // 3. Save User Message
    const { error: msgError } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender: 'user', content: message });

    if (msgError) throw new Error('Failed to save user message');

    // 4. Retrieve History & MEMORIES
    const [historyResult, memories] = await Promise.all([
      supabase
        .from('messages')
        .select('sender, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
      getMemories(supabase, userId)
    ]);

    if (memories.length > 0) {
      console.log(`[Chat] Retrieved ${memories.length} memories for user ${userId}:`, memories);
    } else {
      console.log(`[Chat] No memories found for user ${userId}`);
    }

    if (historyResult.error) throw new Error('Failed to fetch history');

    // AUTO-TITLE LOGIC: If this is the FIRST message, generate a title
    if (historyResult.data.length === 1 && historyResult.data[0].sender === 'user') {
      generateChatTitle(message).then(async (title: string) => {
        await supabase
          .from('conversations')
          .update({ name: title })
          .eq('id', conversationId);
        console.log(`[Chat] Auto-titled conversation ${conversationId} as: ${title}`);
      }).catch(err => {
        console.error('[Chat] Auto-titing failed:', err);
      });
    }

    const conversationHistory: ConversationEntry[] = historyResult.data.map(msg => ({
      sender: msg.sender as 'user' | 'ai',
      content: msg.content,
    }));

    // 5. Invoke LLM with Memory Context
    const aiResponse = await generateAIResponse(conversationHistory, message, memories);

    // 6. Save AI Response
    await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender: 'ai', content: aiResponse });

    // 7. Store New Facts
    // We await this to ensure the serverless function doesn't terminate before saving.
    try {
      await summarizeAndStoreFacts(supabase, userId, message, aiResponse);
    } catch (err) {
      console.error('[Memory] Extraction failed:', err);
    }

    return NextResponse.json({ reply: aiResponse, sessionId: conversationId }, { status: 200 });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
