import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { streamChat, getApiKey } from '@/lib/chat';
import type { ChatMessage } from '@/types';
import albertAvatar from '@/assets/albert.png';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

const EXAMPLE_QUERIES = [
  'What should we do in Week 1 of a Red emergency?',
  'What comes after the MSNA?',
  'Difference between Orange and Red for Finance?',
  'What is the Response Imperative?',
  'What does Supply Chain need to do first?',
];

export default function ChatPanel({ isOpen, onClose, onOpenSettings }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamBufferRef = useRef('');

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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
          return [...prev.slice(0, -1), { ...last, content: 'Sorry, an error occurred. Please check your API key and try again.' }];
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

  const hasApiKey = !!getApiKey();

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
                onClick={() => setMessages([])}
                className="p-1.5 rounded hover:bg-irc-gray-100 text-irc-gray-500"
                title="Clear chat"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
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
          {!hasApiKey && (
            <div className="bg-yellow-50 border border-irc-yellow rounded-lg p-3">
              <p className="text-sm text-black font-bold">API Key Required</p>
              <p className="text-xs text-irc-gray-700 mt-1">
                Set your OpenRouter API key in{' '}
                <button onClick={onOpenSettings} className="underline font-medium">
                  Settings
                </button>{' '}
                to use Ask Albert. Free models available.
              </p>
            </div>
          )}

          {messages.length === 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-irc-gray-400 uppercase tracking-wide font-medium">Try asking</p>
              {EXAMPLE_QUERIES.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  disabled={!hasApiKey}
                  className="block w-full text-left px-3 py-2 rounded-lg border border-irc-gray-200 text-sm text-irc-gray-700 hover:bg-yellow-50 hover:border-irc-yellow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' ? (
                <div className="flex gap-2.5 max-w-[85%]">
                  <img src={albertAvatar} alt="Albert" className="w-9 h-9 rounded-full object-cover flex-shrink-0 self-start" />
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

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-irc-gray-200 bg-white">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasApiKey ? 'Ask about the response process...' : 'Set API key first...'}
              disabled={!hasApiKey || isStreaming}
              rows={1}
              className="flex-1 px-3 py-2 border border-irc-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-irc-yellow focus:border-transparent disabled:bg-irc-gray-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!input.trim() || !hasApiKey || isStreaming}
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
