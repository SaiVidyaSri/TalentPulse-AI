import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function ChatSimulation({ candidate, campaignId, onComplete }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isHumanChat, setIsHumanChat] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isInitializing]);

  useEffect(() => {
    const startOrLoadChat = async () => {
      setIsInitializing(true);
      setMessages([]);
      try {
        const res = await axios.post('http://localhost:5000/api/start-chat', { candidateId: candidate._id, campaignId });
        const history = res.data.chatHistory || [];
        setMessages(history);
        
        // If there's already a human message in history, set isHumanChat to true
        const hasHumanMsg = history.some(m => m.sender === 'Human Recruiter');
        if (hasHumanMsg) setIsHumanChat(true);

        if (history.length > 0) {
          onComplete(); // refresh parent to update interest score status if it was just created
        }
      } catch (error) {
        console.error('Error starting chat:', error);
        const errorMessage = error.response?.data?.error || 'Error connecting to candidate simulator.';
        setMessages([{ sender: 'System', text: errorMessage }]);
      } finally {
        setIsInitializing(false);
      }
    };
    
    startOrLoadChat();
  }, [candidate._id, campaignId]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    // Switch to human chat mode once user sends a message
    setIsHumanChat(true);

    const userMessage = { id: Date.now(), sender: 'Human Recruiter', text: input };
    // Optimistic update
    const tempMessages = [...messages, userMessage];
    setMessages(tempMessages);
    setInput('');
    setIsTyping(true);

    try {
      const res = await axios.post('http://localhost:5000/api/simulate-engagement', {
        candidateId: candidate._id,
        campaignId,
        messages: tempMessages // send history + new msg so backend can just append
      });
      
      // Update with exact history from backend
      setMessages(res.data.chatHistory);
      onComplete(); // refresh parent
    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage = error.response?.data?.error || 'Error connecting to candidate simulator.';
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'System', text: errorMessage }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50 rounded-xl items-center justify-center border border-slate-200 dark:border-slate-800">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm text-slate-500 font-medium animate-pulse">AI is initiating contact & analyzing response...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <AnimatePresence>
          {messages.map((msg, idx) => {
            const isRecruiter = msg.sender === 'AI Recruiter' || msg.sender === 'Human Recruiter';
            const isAI = msg.sender === 'AI Recruiter';
            const isSystem = msg.sender === 'System';
            
            return (
              <motion.div
                key={msg._id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isRecruiter || isSystem ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[80%] ${isRecruiter || isSystem ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isAI ? 'bg-indigo-100 text-indigo-600 ml-3' : 
                    isRecruiter ? 'bg-emerald-100 text-emerald-600 ml-3' :
                    isSystem ? 'bg-slate-100 text-slate-600 ml-3' :
                    'bg-pink-100 text-pink-600 mr-3'
                  }`}>
                    {isAI ? <Bot size={16} /> : isRecruiter ? <User size={16} /> : isSystem ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className={`px-4 py-2 rounded-2xl ${
                    isAI 
                      ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md' 
                      : isRecruiter
                      ? 'bg-emerald-600 text-white rounded-tr-sm shadow-md'
                      : isSystem
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs italic'
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-md border border-slate-100 dark:border-slate-700 rounded-tl-sm'
                  }`}>
                    <div className="text-[10px] opacity-70 mb-1 block">
                      {msg.sender}
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="flex flex-row max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 mr-3 flex items-center justify-center shrink-0 shadow-sm">
                <User size={16} />
              </div>
              <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm shadow-md border border-slate-100 dark:border-slate-700 flex items-center space-x-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 rounded-b-xl">
        {isHumanChat && (
          <div className="flex items-center space-x-2 mb-2 px-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Human Intervention Mode Active</span>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isHumanChat ? "Chat as yourself..." : "Type your message as AI Recruiter..."}
            className={`flex-1 bg-slate-100 dark:bg-slate-900/80 border-none rounded-full px-5 py-3 text-sm focus:ring-2 ${isHumanChat ? 'focus:ring-emerald-500' : 'focus:ring-indigo-500'} text-slate-900 dark:text-white outline-none shadow-inner`}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className={`w-11 h-11 rounded-full bg-gradient-to-r ${isHumanChat ? 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700' : 'from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'} text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md`}
          >
            <Send size={18} className="-ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
