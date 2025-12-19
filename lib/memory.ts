import { SupabaseClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export type Memory = {
  id: string;
  content: string;
  created_at: string;
};

/**
 * Retrieves all stored memories (facts) for a specific user.
 */
export async function getMemories(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('memories')
    .select('content')
    .eq('user_id', userId)
    .order('created_at', { ascending: true }); // Oldest first to build a story

  if (error) {
    console.error('Error fetching memories:', error);
    return [];
  }

  return data.map((m: { content: string }) => m.content);
}

/**
 * Analyzes the latest interaction and extracts new, permanent facts about the user.
 * Stores these facts in the 'memories' table.
 */
export async function summarizeAndStoreFacts(
  supabase: SupabaseClient,
  userId: string,
  userMessage: string,
  aiResponse: string
) {
  try {
    const extractionPrompt = `
    Analyze the following interaction between a User and an AI Assistant.
    Extract key *permanent* facts about the User (e.g., name, location, preferences, job, purchases, issues).
    
    **CRITICAL:** If the User asserts a fact about themselves or their history (e.g., "I bought a keyboard"), capture it as a fact even if the AI Assistant disagrees or claims it doesn't sell that item.
    
    Ignore temporary context (e.g., "I'm hungry", "What time is it?").
    Ignore facts about the AI.
    
    User: "${userMessage}"
    AI: "${aiResponse}"
    
    Return a JSON object with a key "facts" containing an array of strings. 
    If no new permanent facts are found, return an empty array.
    Example: { "facts": ["User bought a cat keyboard", "User lives in Mumbai"] }
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: extractionPrompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.1, // Low temp for more deterministic extraction
      response_format: { type: 'json_object' },
    });

    const responseContent = chatCompletion.choices[0]?.message?.content;
    if (!responseContent) return;

    const result = JSON.parse(responseContent);
    const newFacts: string[] = result.facts || [];

    if (newFacts.length > 0) {
      console.log(`Extracting ${newFacts.length} new facts for user ${userId}`);
      const inserts = newFacts.map(fact => ({
        user_id: userId,
        content: fact,
      }));

      const { error } = await supabase.from('memories').insert(inserts);
      if (error) {
        console.error('Error storing memories:', error);
      }
    }
  } catch (error) {
    console.error('Error in fact extraction:', error);
  }
}
