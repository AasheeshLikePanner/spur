# Spur AI Chat Assignment

This project implements a mini AI support agent for a live chat widget, fulfilling the Spur take-home assignment requirements. It uses Next.js (App Router), React, Tailwind CSS, Supabase for persistence, and an LLM (e.g., OpenAI) for AI responses.

## Features

- **Interactive Chat UI:** Scrollable message list, input box, send button, auto-scroll.
- **Contextual AI Agent:** AI responses are based on the full conversation history.
- **Conversation Persistence:** All messages and conversations are stored in Supabase.
- **Session Management:** Users can resume past conversations across visits using a client-side `user_id`. A list of past conversations is accessible.
- **Graceful Error Handling:** Backend and LLM errors are caught and surfaced in the UI.
- **Dark Theme:** A visually appealing dark mode.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes (TypeScript)
- **Database:** PostgreSQL (Supabase)
- **LLM:** Groq (configurable via environment variables)

## Setup Instructions

### 1. Clone the repository

```bash
git clone [repository-url]
cd spur
```

### 2. Install Dependencies

```bash
bun install # or npm install or yarn install
```

### 3. Supabase Setup

#### A. Create a new Supabase Project

Go to [Supabase](https://supabase.com/) and create a new project.

#### B. Configure Database Schema

In your Supabase project, navigate to the `SQL Editor` and run the following SQL to create the `conversations` and `messages` tables:

```sql
-- Enable the uuid-ossp extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, 
  name TEXT, -- New column for chat name (optional)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE SENDER_TYPE AS ENUM ('user', 'ai');

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender SENDER_TYPE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Add RLS policies for public read/write if desired,
-- but for this assignment, we assume direct API access.

-- Update: If you created the table before the 'name' column was added:
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name TEXT;

-- Update: For Memory (Fact Extraction):
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, 
  content TEXT NOT NULL, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### C. Get Supabase Credentials

From your Supabase project settings, go to `API` and find your:
- `Project URL` (e.g., `https://abcdefghijk.supabase.co`)
- `anon public` key (e.g., `eyJ...`)

### 4. LLM API Key

Obtain an API key from your chosen LLM provider (e.g., Groq).

- **Groq:** Go to [Groq Console](https://console.groq.com/keys) to create an API key.

### 5. Environment Variables

Create a `.env.local` file in the root of the project and add the following:

```
NEXT_PUBLIC_SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="YOUR_SUPABASE_PUBLISHABLE_KEY" # This is your 'anon public' key
GROQ_API_KEY="YOUR_GROQ_API_KEY"
```

Replace the placeholder values with your actual credentials. For `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, use your project's `anon public` key found in the Supabase `API` settings.

### 6. Run the Application

```bash
bun dev # or npm run dev or yarn dev
```

The application will be accessible at `http://localhost:3000`.

## Architecture Overview

### Frontend (Next.js App Router)
- `app/page.tsx`: The main chat interface, handling client-side `user_id` generation/retrieval, conversation state management, and rendering core components.
- Components (e.g., `components/chat/...`): Modular UI elements for message display, input, and conversation list.
- Supabase client-side integration (`lib/supabase/client.ts`): Used to interact with the backend API routes and potentially directly with Supabase for simpler reads if needed.

### Backend (Next.js API Routes)
- `app/api/chat/route.ts` (POST): Handles incoming user messages, orchestrates saving to DB, fetching conversation history, calling the LLM, and saving the AI response.
- `app/api/chat/history/route.ts` (GET): Retrieves the full message history for a given `sessionId`.
- `app/api/chat/sessions/route.ts` (GET): Lists all conversations associated with a `user_id`.
- Supabase server-side integration (`lib/supabase/server.ts`): Provides a secure way to interact with the Supabase database from the backend.
- `lib/llm.ts`: Encapsulates the logic for interacting with the chosen LLM provider (e.g., Groq). It handles prompt construction, API calls, and error handling.

### Data Model & Memory
The core "memory" of the AI agent is stored across the `conversations` and `messages` tables, linked by a persistent `user_id` on the client-side.

- **`conversations` table:** Serves as the tracking mechanism for individual chat sessions. Each entry links a unique `conversation_id` to a `user_id`. This allows the system to retrieve all past discussions for a returning user.
- **`messages` table:** This is the detailed record of the "memory." It stores every user and AI message, associated with its `conversation_id`.

**How Memory is Utilized:**
1.  **User Identification:** A `user_id` (a UUID stored in `localStorage`) uniquely identifies a user across visits. This `user_id` is sent with all API requests.
2.  **Conversation Retrieval:** When a user returns, their `user_id` allows the frontend to fetch a list of all their past `conversations` (`GET /api/chat/sessions`).
3.  **Contextual LLM Interaction:** When a conversation is active (either a new one or a resumed one), the backend fetches *all* messages (`GET /api/chat/history`) belonging to that `conversation_id`. This complete historical dialogue is then passed to the LLM as context in the prompt. This enables the AI to "remember" previous interactions within that specific chat and respond contextually.

### LLM Notes

- **Provider:** Groq (using `llama3-8b-8192` or similar).
- **Prompting:** The LLM is prompted with a system message defining its role as a helpful support agent for a fictional e-commerce store, followed by the entire conversation history. This ensures contextual and relevant responses.
  - **Fictional Store Knowledge:** Basic FAQs (shipping, returns, support hours) are hardcoded into the system prompt to seed the agent with domain knowledge.
- **Trade-offs:** Passing the entire conversation history can become expensive for very long chats due to token usage. A more advanced solution would involve summarization of older messages or RAG (Retrieval Augmented Generation) for domain-specific knowledge to manage token limits and cost more effectively.

### Advanced Memory / Personalization (Conceptual)
The current system provides memory at the conversation level, sending the full chat history to the LLM for context. To achieve a more "advanced" memory or a "memory graph" that allows the AI to "know" the user better across *different conversations* or over a longer period, several techniques would be employed:

-   **User Profiles / Fact Extraction:** Develop a mechanism (perhaps a dedicated database table or a knowledge graph) to store extracted facts, preferences, or recurring themes from a user's *entire* conversation history. The LLM itself could be prompted to summarize key information or extract specific data points after each conversation, which would then update this user profile.
-   **Retrieval Augmented Generation (RAG):** Instead of sending raw, potentially very long conversation history, the system would identify the current user's needs and retrieve relevant information from their user profile or from a broader knowledge base (e.g., product FAQs stored as vector embeddings). This retrieved context would then be injected into the LLM's prompt, augmenting its understanding. This allows for:
    -   **Cross-Conversation Recall:** Remembering user preferences or previous issues even in a new chat.
    -   **Token Efficiency:** Only sending relevant snippets to the LLM, reducing cost and staying within context window limits.
-   **Conversation Summarization:** For very long conversations, the system could periodically summarize older parts of the chat, maintaining key points without needing to store or send every single message. This summary would then form part of the context for subsequent messages.

These approaches would evolve the system from simple conversational recall to a more sophisticated, personalized, and "remembering" AI agent.

## How We'll Evaluate (Self-Check)

- **Correctness:**
  - Can we chat end-to-end and get sane answers from the AI? Yes.
  - Are conversations persisted? Yes, in Supabase.
  - Does it handle basic error cases? Yes, LLM/API errors are gracefully surfaced.
- **Code Quality & Best Practices:** Clean, readable, idiomatic TypeScript/JS, logical structure.
- **Architecture & Extensibility:** LLM integration is encapsulated. Data schema supports future extensions.
- **Robustness:** Input validation (non-empty messages). Graceful failure for LLM/API issues.
- **Product & UX Sense:** Intuitive chat experience with dark theme, loading states.

## If I had more time...

- **Advanced Memory/Context:** Implement token-aware summarization of older messages or RAG using vector embeddings for FAQ knowledge to improve context management for very long conversations and reduce LLM costs.
- **User Authentication:** Integrate Supabase Auth for actual user accounts, rather than just `localStorage`-based `user_id`. This would allow more secure and personalized experiences.
- **Real-time Updates:** Use Supabase Realtime or WebSockets for instant message delivery without polling.
- **Typing Indicator:** A more sophisticated "Agent is typing..." indicator that more closely mimics human typing speed.
- **Input Validation:** More comprehensive validation for message length, special characters, etc.
- **Rate Limiting:** Implement backend rate limiting to prevent abuse of the chat API.
- **More Robust UI/UX:** Enhance styling, animations, and accessibility features.
- **Unit/Integration Tests:** Add automated tests for backend API routes and frontend components.
- **CI/CD Pipeline:** Set up a CI/CD pipeline for automated testing and deployment.
- **Multi-LLM Support:** Abstract the LLM interface to easily swap between OpenAI, Anthropic, etc.