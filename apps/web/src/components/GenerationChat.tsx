'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  phase?: string;
  status?: 'pending' | 'complete' | 'error';
}

interface GenerationChatProps {
  isGenerating: boolean;
  currentPhase: string;
  phases: Array<{
    phase: string;
    output: string;
    metadata?: any;
  }>;
  userPrompt: string;
  framework: string;
  onComplete?: (code: string) => void;
}

const phaseDescriptions = {
  architecture: "🏗️ Planning the application architecture and component structure...",
  design: "🎨 Creating a comprehensive design system and visual specifications...",
  implementation: "⚙️ Implementing the application with production-ready code...",
  review: "✨ Reviewing and enhancing the code for production readiness..."
};

const phaseCompletedMessages = {
  architecture: "✅ Architecture planning complete! Identified key components and data flow patterns.",
  design: "✅ Design system created! Established color palette, typography, and component specifications.",
  implementation: "✅ Implementation complete! Built a fully functional application with advanced features.",
  review: "✅ Code review finished! Enhanced with error handling, accessibility, and performance optimizations."
};

export default function GenerationChat({ 
  isGenerating, 
  currentPhase, 
  phases, 
  userPrompt, 
  framework,
  onComplete 
}: GenerationChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat with user prompt
  useEffect(() => {
    if (userPrompt && messages.length === 0) {
      setMessages([
        {
          id: '1',
          type: 'user',
          content: userPrompt,
          timestamp: new Date()
        },
        {
          id: '2',
          type: 'assistant',
          content: `Great! I'll create a complete ${framework} project for you using my advanced 4-phase generation system. This will produce a professional, production-ready project structure with multiple files.`,
          timestamp: new Date()
        }
      ]);
    }
  }, [userPrompt, framework, messages.length]);

  // Update messages based on generation progress
  useEffect(() => {
    if (isGenerating && currentPhase) {
      const phaseMessage: ChatMessage = {
        id: `phase-${currentPhase}-${Date.now()}`,
        type: 'system',
        content: phaseDescriptions[currentPhase as keyof typeof phaseDescriptions] || `Working on ${currentPhase}...`,
        timestamp: new Date(),
        phase: currentPhase,
        status: 'pending'
      };

      setMessages(prev => {
        // Remove any existing pending message for this phase
        const filtered = prev.filter(msg => !(msg.phase === currentPhase && msg.status === 'pending'));
        return [...filtered, phaseMessage];
      });
    }
  }, [isGenerating, currentPhase]);

  // Update completed phases
  useEffect(() => {
    phases.forEach(phase => {
      const completedMessage: ChatMessage = {
        id: `completed-${phase.phase}-${Date.now()}`,
        type: 'system',
        content: phaseCompletedMessages[phase.phase as keyof typeof phaseCompletedMessages] || `${phase.phase} completed!`,
        timestamp: new Date(),
        phase: phase.phase,
        status: 'complete'
      };

      setMessages(prev => {
        // Update pending message to complete
        return prev.map(msg => 
          msg.phase === phase.phase && msg.status === 'pending'
            ? { ...msg, ...completedMessage, id: msg.id }
            : msg
        );
      });
    });
  }, [phases]);

  // Final completion message
  useEffect(() => {
    if (!isGenerating && phases.length === 4) {
      const finalMessage: ChatMessage = {
        id: `final-${Date.now()}`,
        type: 'assistant',
        content: "🎉 Your project is ready! I've created a complete, production-ready project with proper file structure, advanced features, error handling, accessibility compliance, and professional design. You can now explore, edit, and download your entire project.",
        timestamp: new Date(),
        status: 'complete'
      };

      setMessages(prev => {
        // Don't add duplicate final messages
        if (prev.some(msg => msg.content.includes("🎉 Your application is ready!"))) {
          return prev;
        }
        return [...prev, finalMessage];
      });
    }
  }, [isGenerating, phases.length]);

  const getMessageIcon = (message: ChatMessage) => {
    switch (message.type) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'assistant':
        return <Bot className="w-4 h-4" />;
      case 'system':
        if (message.status === 'pending') {
          return <Clock className="w-4 h-4 animate-spin" />;
        }
        if (message.status === 'complete') {
          return <CheckCircle className="w-4 h-4 text-green-500" />;
        }
        if (message.status === 'error') {
          return <AlertCircle className="w-4 h-4 text-red-500" />;
        }
        return <Bot className="w-4 h-4" />;
      default:
        return <Bot className="w-4 h-4" />;
    }
  };

  const getMessageStyle = (message: ChatMessage) => {
    switch (message.type) {
      case 'user':
        return 'bg-blue-500 text-white ml-auto';
      case 'assistant':
        return 'bg-gray-100 text-gray-900';
      case 'system':
        return 'bg-purple-50 text-purple-900 border border-purple-200';
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 bg-gray-50">
        <Bot className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-gray-900">Generation Assistant</h3>
        {isGenerating && (
          <div className="ml-auto flex items-center gap-2 text-sm text-purple-600">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
            Generating...
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${
              message.type === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.type === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              {getMessageIcon(message)}
            </div>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${getMessageStyle(message)}`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <div className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Phase Progress */}
      {isGenerating && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Generation Progress</span>
            <span>{phases.length}/4 phases complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(phases.length / 4) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
} 