import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { streamChat, MODELS, getModel, setModel } from '@/lib/chat';
import type { ChatMessage } from '@/types';
import albertAvatar from '@/assets/albert.png';
// @ts-ignore — @irc/shared is a workspace dependency (plain JS)
import { getSettingsUrl } from '@irc/shared';

const SUPABASE_FUNCTION_URL =
  import.meta.env.VITE_SUPABASE_FUNCTION_URL ||
  'https://qykjjfbdvwqxqmsgiebs.supabase.co/functions/v1';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  prefillQuery?: string | null;
  onPrefillConsumed?: () => void;
}

const EXAMPLE_QUERIES = [
  'What should we do in Week 1 of a Red emergency?',
  'What comes after the MSNA?',
  'Difference between Orange and Red for Finance?',
  'What is the Response Imperative?',
  'What does Supply Chain need to do first?',
];

const CHAT_STORAGE_KEY = 'irc_albert_chat_navigator';

function loadPersistedChat(): ChatMessage[] {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function persistChat(messages: ChatMessage[]) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch { /* quota exceeded — ignore */ }
}

// 1E: Feedback — store thumbs up/down
async function sendFeedback(messageId: string, rating: 'up' | 'down', query: string) {
  try {
    await fetch(`${SUPABASE_FUNCTION_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: { messageId, rating, query, timestamp: new Date().toISOString() } }),
    });
  } catch { /* non-blocking */ }
}

export default function ChatPanel({ isOpen, onClose, prefillQuery, onPrefillConsumed }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadPersistedChat);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState(getModel);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamBufferRef = useRef('');

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Persist chat to localStorage whenever messages change (skip during streaming)
  useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      persistChat(messages);
    }
  }, [messages, isStreaming]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle prefilled query from "Ask Albert about this task"
  useEffect(() => {
    if (prefillQuery && isOpen && !isStreaming) {
      sendMessage(prefillQuery);
      onPrefillConsumed?.();
    }
  }, [prefillQuery, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);
    streamBufferRef.current = '';

    const chatHistory = [...messages, userMsg].map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    try {
      for await (const chunk of streamChat(chatHistory)) {
        streamBufferRef.current += chunk;
        const content = streamBufferRef.current;
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content }];
          }
          return updated;
        });
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === 'assistant' && !last.content) {
          return [...prev.slice(0, -1), { ...last, content: 'Sorry, an error occurred. Please try again.' }];
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-14 bottom-0 w-full sm:w-[28rem] lg:w-[32rem] bg-white border-l border-irc-gray-200 shadow-xl z-30 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className={`flex items-start justify-between px-4 ${messages.length === 0 ? 'py-4' : 'py-3'} border-b border-irc-gray-200 bg-irc-gray-50`}>
          <div className="flex items-start gap-3">
            {messages.length === 0 ? (
              <img src={albertAvatar} alt="Albert" className="w-20 flex-shrink-0 object-contain -mb-3" />
            ) : (
              <img src={albertAvatar} alt="Albert" className="w-9 h-9 object-contain flex-shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <h3 className={`font-bold text-black tracking-irc-tight ${messages.length === 0 ? 'text-lg' : 'text-sm'}`}>Ask Albert</h3>
              {messages.length === 0 ? (
                <p className="text-xs text-irc-gray-500 mt-1 leading-relaxed">
                  Your AI-powered guide to IRC's emergency response tools, templates, and ways of working. Albert knows it all. Don't worry about how you ask — Albert will figure it out and direct you to the right documents and next steps.
                </p>
              ) : (
                <p className="text-xs text-irc-gray-500">Your IRC emergency response guide</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); localStorage.removeItem(CHAT_STORAGE_KEY); }}
                className="p-1.5 rounded hover:bg-irc-gray-100 text-irc-gray-500"
                title="New conversation"
                aria-label="New conversation"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            <a
              href={getSettingsUrl() + '#ai'}
              className="p-1.5 rounded hover:bg-irc-gray-100 text-irc-gray-500 inline-flex"
              title="AI Settings"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.11-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-irc-gray-100 text-irc-gray-500"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-irc-gray-400 uppercase tracking-wide font-medium">Try asking</p>
              {EXAMPLE_QUERIES.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="block w-full text-left px-3 py-2 rounded-lg border border-irc-gray-200 text-sm text-irc-gray-700 hover:bg-yellow-50 hover:border-irc-yellow transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' ? (
                <div className="flex gap-2.5 max-w-[85%]">
                  <img src={albertAvatar} alt="Albert" className="w-9 h-9 rounded-full object-cover flex-shrink-0 self-start" />
                  <div>
                    <div className="rounded-lg px-3 py-2 text-sm bg-irc-gray-50 text-black">
                      <div className="chat-content">
                        <ReactMarkdown
                          components={{
                            a: ({ href, children, ...props }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
                            ),
                          }}
                        >{msg.content || '...'}</ReactMarkdown>
                      </div>
                    </div>
                    {/* 1E: Feedback buttons */}
                    {msg.content && !isStreaming && (
                      <div className="flex gap-1 mt-1 ml-1">
                        {feedbackGiven.has(msg.id) ? (
                          <span className="text-xs text-irc-gray-400">Thanks for the feedback</span>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                const prevUser = messages.slice(0, idx).reverse().find(m => m.role === 'user');
                                sendFeedback(msg.id, 'up', prevUser?.content || '');
                                setFeedbackGiven(prev => new Set(prev).add(msg.id));
                              }}
                              className="p-1 rounded hover:bg-irc-gray-100 text-irc-gray-400 hover:text-green-600 transition-colors"
                              title="Helpful"
                              aria-label="Thumbs up"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" /></svg>
                            </button>
                            <button
                              onClick={() => {
                                const prevUser = messages.slice(0, idx).reverse().find(m => m.role === 'user');
                                sendFeedback(msg.id, 'down', prevUser?.content || '');
                                setFeedbackGiven(prev => new Set(prev).add(msg.id));
                              }}
                              className="p-1 rounded hover:bg-irc-gray-100 text-irc-gray-400 hover:text-red-500 transition-colors"
                              title="Not helpful"
                              aria-label="Thumbs down"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" /></svg>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-black text-white">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              )}
            </div>
          ))}

          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-irc-gray-400">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-irc-yellow rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-irc-yellow rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-irc-yellow rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input + Model selector */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-irc-gray-200 bg-white">
          {/* Model selector row */}
          <div className="flex items-center gap-2 mb-2">
            <select
              value={selectedModel}
              onChange={e => { setSelectedModel(e.target.value); setModel(e.target.value); }}
              className="text-xs px-2 py-1 border border-irc-gray-200 rounded bg-white text-irc-gray-600"
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <span className="text-xs text-irc-gray-400">{MODELS.find(m => m.id === selectedModel)?.description}</span>
          </div>
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the response process..."
              disabled={isStreaming}
              rows={1}
              className="flex-1 px-3 py-2 border border-irc-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-irc-yellow focus:border-transparent disabled:bg-irc-gray-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="px-3 py-2 bg-irc-yellow text-black rounded-lg text-sm font-medium hover:bg-irc-yellow-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
