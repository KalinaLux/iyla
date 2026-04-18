import { useState, useRef, useEffect } from 'react';
import { MessageCircleHeart, Send, Sparkles } from 'lucide-react';
import Modal from '../Modal';
import { answerQuestion, suggestedQuestions, type CoachContext, type CoachAnswer } from '../../lib/coach';

interface Message {
  id: string;
  role: 'user' | 'coach';
  text: string;
  citations?: string[];
  followUps?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  context: CoachContext;
}

export default function CoachModal({ open, onClose, context }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      const intro: Message = {
        id: 'intro',
        role: 'coach',
        text: 'Hi. I\'m iyla. I know your data — your cycles, your signals, your patterns. Ask me anything.',
        followUps: suggestedQuestions().slice(0, 4),
      };
      setMessages([intro]);
    }
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function ask(question: string) {
    if (!question.trim()) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: question };
    const answer: CoachAnswer = answerQuestion(question, context);
    const coachMsg: Message = {
      id: `c-${Date.now() + 1}`,
      role: 'coach',
      text: answer.text,
      citations: answer.citations,
      followUps: answer.followUpSuggestions,
    };
    setMessages(m => [...m, userMsg, coachMsg]);
    setInput('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <Modal open={open} onClose={onClose} title="iyla Coach" maxWidth="max-w-2xl">
      <div className="flex flex-col h-[70vh] max-h-[600px] -mx-1">
        {/* Subtitle */}
        <div className="flex items-center gap-1.5 text-[10px] text-warm-400 uppercase tracking-wider font-medium px-1 mb-3">
          <Sparkles size={11} className="text-teal-500" strokeWidth={2} />
          Grounded in your data · no hallucinations
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-1 py-2 space-y-4">
          {messages.map(msg => (
            <div key={msg.id}>
              {msg.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-warm-800 text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-sm">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shrink-0">
                    <MessageCircleHeart size={14} className="text-white" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0 max-w-[85%]">
                    <div className="bg-warm-50 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-warm-800 whitespace-pre-line leading-relaxed">
                      {msg.text}
                    </div>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                        {msg.citations.map((c, i) => (
                          <span key={i} className="text-[10px] text-warm-400 bg-warm-50 border border-warm-150 rounded-full px-2 py-0.5">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.followUps && msg.followUps.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3 px-1">
                        {msg.followUps.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => ask(q)}
                            className="text-[11px] px-3 py-1.5 bg-white border border-warm-200 text-warm-600 rounded-full hover:bg-warm-50 hover:border-warm-300 transition-all active:scale-[0.97]"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2 pt-3 border-t border-warm-100">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your cycle, patterns, what to do today…"
            className="flex-1 px-4 py-2.5 bg-warm-50 border border-warm-200 rounded-2xl text-sm text-warm-800 placeholder-warm-400 focus:outline-none focus:border-warm-400"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-10 h-10 rounded-2xl bg-warm-800 text-white flex items-center justify-center disabled:opacity-40 hover:bg-warm-900 transition-all active:scale-[0.95]"
          >
            <Send size={15} strokeWidth={2} />
          </button>
        </form>
      </div>
    </Modal>
  );
}
