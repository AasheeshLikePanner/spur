'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getStoredUserName, setStoredUserName } from '@/lib/clientUtils';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Message = {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  created_at: string;
};

type Conversation = {
  id: string;
  name?: string;
  created_at: string;
};

const MAX_CHAR_COUNT = 400;
const MAX_NAME_CHAR_COUNT = 20;

export default function ChatPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetchingConversations, setIsFetchingConversations] = useState<boolean>(false);
  const [isFetchingMessages, setIsFetchingMessages] = useState<boolean>(false);

  // Dialog States
  const [isNewChatDialogOpen, setIsNewChatDialogOpen] = useState(false);
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedName = getStoredUserName();
    if (storedName) {
      setUserId(storedName);
    } else {
      setIsNameDialogOpen(true);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    setIsFetchingConversations(true);
    try {
      const response = await fetch(`/api/chat/sessions?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');

      const data: Conversation[] = await response.json();
      setConversations(data);

      if (!sessionId && data.length > 0) {
        setSessionId(data[0].id);
      } else if (!sessionId && data.length === 0) {
        setIsNewChatDialogOpen(true);
      }
    } catch (err: any) {
      toast.error('Could not load your conversations.');
    } finally {
      setIsFetchingConversations(false);
    }
  }, [userId, sessionId]);

  const fetchMessages = useCallback(async () => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    setIsFetchingMessages(true);
    try {
      const response = await fetch(`/api/chat/history?sessionId=${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch messages');

      const data: Message[] = await response.json();
      setMessages(data);
    } catch (err: any) {
      toast.error('Could not load message history.');
    } finally {
      setIsFetchingMessages(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (userId) fetchConversations();
  }, [userId, fetchConversations]);

  useEffect(() => {
    if (sessionId) fetchMessages();
  }, [sessionId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = nameInput.trim();
    if (!trimmedName) return;

    if (trimmedName.length > MAX_NAME_CHAR_COUNT) {
      toast.error(`Name too long (max ${MAX_NAME_CHAR_COUNT} chars)`);
      return;
    }

    setStoredUserName(trimmedName);
    setUserId(trimmedName);
    setIsNameDialogOpen(false);
    toast.success(`Welcome, ${trimmedName}!`);
  };

  const handleCreateChat = async () => {
    if (!userId) return;

    setIsCreatingChat(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId, name: 'New Chat...' }), // Temporary title
      });

      if (!response.ok) throw new Error('Failed to create chat');

      const data = await response.json();
      setSessionId(data.sessionId);
      setMessages([]);
      setInput('');
      await fetchConversations();
      toast.success('New conversation started');
    } catch (err) {
      toast.error('Failed to create new chat');
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!userId) return;

    if (!input.trim()) {
      toast.warning('Message cannot be empty');
      return;
    }
    if (input.length > MAX_CHAR_COUNT) {
      toast.error(`Message too long (${input.length}/${MAX_CHAR_COUNT} chars)`);
      return;
    }

    if (!sessionId) {
      setIsNewChatDialogOpen(true);
      return;
    }

    const userMessageContent = input.trim();
    setInput('');
    setIsLoading(true);

    const newUserMessage: Message = {
      id: uuidv4(),
      sender: 'user',
      content: userMessageContent,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newUserMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessageContent,
          sessionId,
          userId,
        }),
      });

      if (!response.ok) throw new Error('Chat API failed');

      const data = await response.json();

      const aiMessage: Message = {
        id: uuidv4(),
        sender: 'ai',
        content: data.reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      toast.error('Failed to send message');
      setMessages((prev) => prev.filter(m => m.id !== newUserMessage.id));
      setInput(userMessageContent); // Restore input on failure
    } finally {
      setIsLoading(false);
    }
  };

  if (!userId && !isNameDialogOpen) {
    return (
      <div className="flex justify-center items-center h-screen bg-background text-foreground animate-pulse">
        Initializing...
      </div>
    );
  }

  const currentLength = input.length;
  const isOverLimit = currentLength > MAX_CHAR_COUNT;
  const currentNameLength = nameInput.length;
  const isNameOverLimit = currentNameLength > MAX_NAME_CHAR_COUNT;

  return (
    <main className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 flex-shrink-0 border-r bg-muted/20 flex flex-col h-full">
        <div className="p-4 border-b">
          <div className="mb-4 px-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</p>
            <p className="font-bold text-lg truncate">{userId}</p>
          </div>
          <Button
            onClick={handleCreateChat}
            className="w-full justify-start gap-2"
            variant="default"
            disabled={isCreatingChat}
          >
            {isCreatingChat ? 'Starting...' : '+ New Chat'}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isFetchingConversations ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Loading chats...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">No conversations yet</div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSessionId(conv.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${sessionId === conv.id
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                  }`}
              >
                <div className="truncate">{conv.name || 'Untitled Chat'}</div>
                <div className="text-xs opacity-70 truncate">
                  {new Date(conv.created_at).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <section className="flex-1 flex flex-col h-full relative">
        <header className="h-14 border-b flex items-center px-6 bg-background/50 backdrop-blur top-0 z-10">
          <h2 className="font-semibold text-lg">
            {conversations.find(c => c.id === sessionId)?.name || 'Chat'}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-4 content-start">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center text-muted-foreground">
                <p>No messages yet. Start the conversation!</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.sender === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm border'
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex w-full justify-start">
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-sm bg-muted border text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 border-t bg-background">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSendMessage} className="relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className={`pr-20 py-6 text-base shadow-sm ${isOverLimit ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                disabled={isLoading || !sessionId}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className={`text-xs ${isOverLimit ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                  {currentLength}/{MAX_CHAR_COUNT}
                </span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading || !input.trim() || !sessionId || isOverLimit}
                >
                  Send
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>


      {/* Name Identiy Dialog (Blocking) */}
      <Dialog open={isNameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Welcome to Spur AI</DialogTitle>
            <DialogDescription>
              Please enter your name to continue.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleNameSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Your Name</Label>
                <div className="relative">
                  <Input
                    id="username"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. John Doe"
                    autoFocus
                  />
                  <div className={`absolute right-2 top-2 text-[10px] ${isNameOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {currentNameLength}/{MAX_NAME_CHAR_COUNT}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!nameInput.trim() || isNameOverLimit}>
                Get Started
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}