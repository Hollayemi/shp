'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GeneratedProject {
  name: string;
  framework: string;
  files: { path: string; content: string; language: string; }[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  description: string;
}

interface EditorChatProps {
  project: GeneratedProject;
  onProjectUpdate: (updatedProject: GeneratedProject) => void;
  className?: string;
}

export default function EditorChat({ project, onProjectUpdate, className }: EditorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      // Initialize with welcome message
      setMessages([
        {
          id: '1',
          type: 'assistant',
          content: `Hi! I'm your AI assistant for this ${project.framework} application. I can help you:\n\n• Add new features and functionality\n• Change colors, layout, and design\n• Fix bugs and improve performance\n• Add animations and interactions\n• Modify components and structure\n\nWhat would you like to improve in your app?`,
          timestamp: new Date()
        }
      ]);
    }
  }, [project.framework, messages.length]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsGenerating(true);

    try {
      // Call the API to modify the project
      const response = await fetch('/api/modify-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: project,
          userRequest: userMessage.content
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to modify project');
      }

      const data = await response.json();

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.explanation || 'I\'ve updated your application with the requested changes!',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update the project
      if (data.project) {
        onProjectUpdate(data.project);
      }

    } catch (error) {
      console.error('Error modifying project:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while trying to modify your application. Please try again.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`flex flex-col bg-white border-r border-gray-200 ${className || ''}`}>
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex items-center gap-3">
        <MessageCircle className="w-6 h-6" />
        <div>
          <h2 className="font-semibold text-lg">AI Assistant</h2>
          <p className="text-blue-100 text-sm">Improve your {project.framework} app</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-lg text-sm ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              <div
                className={`text-xs mt-2 ${
                  message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        
        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 p-3 rounded-lg flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Updating your app...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Describe the changes you want..."
            className="flex-1 resize-none text-sm bg-white"
            rows={3}
            disabled={isGenerating}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isGenerating}
            size="icon"
            className="h-20 w-12 shrink-0 bg-blue-600 hover:bg-blue-700"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
} 