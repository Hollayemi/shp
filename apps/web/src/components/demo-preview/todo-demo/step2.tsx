import React from 'react';
import { AppShell } from './components/AppShell';
import { Task } from './components/types';

// Step 2: Authentication - Secure Notion-style workspace
const NotionTodoStep2: React.FC = () => {
  const initialTasks: Task[] = [
    {
      id: '1',
      title: 'Welcome to your secure workspace!',
      completed: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30),
      status: 'doing'
    },
    {
      id: '2', 
      title: 'Your data is now protected',
      completed: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 15),
      completedAt: new Date(Date.now() - 1000 * 60 * 10),
    },
    {
      id: '3',
      title: 'Add your personal tasks',
      completed: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 5),
    }
  ];

  return (
    <AppShell
      step={2}
      initialTasks={initialTasks}
      requireAuth={true}
      features={{
        categories: false,
        tags: false,
        priorities: false,
        dueDates: false,
        analytics: false
      }}
    />
  );
};

export default NotionTodoStep2;
