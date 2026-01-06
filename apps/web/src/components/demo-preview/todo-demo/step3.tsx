import React from 'react';
import { AppShell } from './components/AppShell';
import { Task } from './components/types';

// Step 3: Organization - Advanced Notion-style task management
const NotionTodoStep3: React.FC = () => {
  const initialTasks: Task[] = [
    {
      id: '1',
      title: 'Finish project proposal',
      completed: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60),
      category: 'Work',
      priority: 'High',
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
      tags: ['urgent', 'deadline'],
      status: 'doing'
    },
    {
      id: '2', 
      title: 'Review team feedback',
      completed: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 30),
      completedAt: new Date(Date.now() - 1000 * 60 * 15),
      category: 'Work',
      priority: 'Medium',
      tags: ['team', 'review']
    },
    {
      id: '3',
      title: 'Buy groceries',
      completed: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 45),
      category: 'Personal',
      priority: 'Low',
      tags: ['weekly', 'food']
    },
    {
      id: '4',
      title: 'Morning workout',
      completed: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      completedAt: new Date(Date.now() - 1000 * 60 * 60),
      category: 'Personal',
      priority: 'Medium',
      tags: ['fitness', 'routine']
    },
    {
      id: '5',
      title: 'Call mom',
      completed: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 20),
      category: 'Personal',
      priority: 'High',
      tags: ['family', 'important']
    }
  ];

  return (
    <AppShell
      step={3}
      initialTasks={initialTasks}
      requireAuth={true}
      features={{
        categories: true,
        tags: true,
        priorities: true,
        dueDates: true,
        analytics: false
      }}
    />
  );
};

export default NotionTodoStep3;
