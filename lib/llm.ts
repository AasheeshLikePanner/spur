import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

// Define a type for a conversation entry that includes a sender and content
export type ConversationEntry = {
  sender: 'user' | 'ai';
  content: string;
};

// Function to convert ConversationEntry to Groq-compatible Message
function toGroqMessage(entry: ConversationEntry): { role: 'user' | 'assistant', content: string } {
  if (entry.sender === 'user') {
    return { role: 'user', content: entry.content };
  } else {
    // Assuming 'ai' sender corresponds to 'assistant' role in LLM APIs
    return { role: 'assistant', content: entry.content };
  }
}

/**
 * Generates an AI response using the Groq API.
 * @param history An array of past conversation entries (user and AI messages).
 * @param userMessage The current message from the user.
 * @param memories Optional array of long-term memories/facts about the user.
 * @returns A Promise that resolves to the AI's response string.
 */
export async function generateAIResponse(
  history: ConversationEntry[],
  userMessage: string,
  memories: string[] = []
): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY environment variable is not set.');
  }

  const memoryContext = memories.length > 0
    ? `\nRelevant memories/facts about this user:\n${memories.map(m => `- ${m}`).join('\n')}`
    : '';

  // System prompt to set the AI's persona and provide domain knowledge
  const systemPrompt = `You are a helpful support agent for a small e-commerce store called "Spur."
  Answer clearly and concisely. Here's some basic knowledge about Spur:
  - Shipping policy: We offer free standard shipping on all orders over $50. Expedited shipping is available for a flat rate of $10. We ship within the USA only.
  - Return/refund policy: You can return any item within 30 days of purchase for a full refund, no questions asked. Items must be in their original condition.
  - Support hours: Our support team is available Monday to Friday, 9 AM to 5 PM PST.
  - Product catalog: We sell handmade artisan goods, custom jewelry, home decor, and **unique tech accessories** (like cat-shaped keyboards and warmers).
  - Discounts: First-time customers get 10% off their first order with code WELCOME10.

  ${memoryContext}

  **CRITICAL INSTRUCTION:**
  If the "Relevant memories" above mention a past purchase or event (like a returned keyboard), **assume it is true**, even if it contradicts the standard catalog. Your goal is to be helpful and consistent with the user's history.
  
  Given the following conversation history and the new user message, provide a helpful and concise response.
  `;

  // Combine system prompt, history, and current user message
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(toGroqMessage), // Map history to Groq-compatible messages
    { role: 'user', content: userMessage },
  ];

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: messages as unknown as { role: 'user' | 'assistant' | 'system', content: string }[], // Cast to match Groq's expected messages type
      model: 'llama-3.1-8b-instant', // Using a fast Groq model. Can be changed.
      temperature: 0.7,
      max_tokens: 1024, // Reasonable token limit for a support agent
    });

    const aiResponse = chatCompletion.choices[0]?.message?.content;

    if (!aiResponse) {
      console.error('Groq API returned an empty response.');
      return 'I apologize, but I could not generate a response at this time. Please try again.';
    }

    return aiResponse;
  } catch (error) {
    console.error('Error communicating with Groq API:', error);
    // Provide a user-friendly error message
    return 'I apologize, but I am currently experiencing technical difficulties. Please try again in a moment.';
  }
}

/**
 * Generates a concise, 3-5 word title for a chat session based on its first message.
 */
export async function generateChatTitle(firstMessage: string): Promise<string> {
  const prompt = `
  Generate a very concise, 3-5 word title for a customer support chat that starts with this message:
  "${firstMessage}"
  
  Return ONLY the title string, no quotes, no punctuation at the end.
  Example Input: "My cat keyboard keys are sticky"
  Example Output: Sticky Keyboard Keys Issue
  `;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.5,
    });

    return chatCompletion.choices[0]?.message?.content?.trim() || 'New Conversation';
  } catch (error) {
    console.error('Error generating title:', error);
    return 'New Conversation';
  }
}
