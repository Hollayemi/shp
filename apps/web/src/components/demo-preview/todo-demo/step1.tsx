import React from 'react';
import { AppShell } from './components/AppShell';
import { Task } from './components/types';

// Step 1: Foundation - Basic Notion-style task management
const NotionTodoStep1: React.FC = () => {
  const initialTasks: Task[] = [
    {
      id: '1',
      title: 'Take Fig on a walk',
      completed: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30),
      status: 'doing'
    }
  ];

  return (
    <AppShell
      step={1}
      initialTasks={initialTasks}
      requireAuth={false}
      features={{}}
    />
  );
};

export default NotionTodoStep1;
