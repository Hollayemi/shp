import React from 'react';
import { AppShell } from './components/AppShell';
import { Task } from './components/types';

// Step 4: Analytics - Complete Notion-style productivity hub
const NotionTodoStep4: React.FC = () => {
  const initialTasks: Task[] = [
    {
      id: '1',
      title: 'Q4 Planning Session',
      completed: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      category: 'Work',
      priority: 'High',
      tags: ['planning', 'quarterly']
    },
    {
      id: '2', 
      title: 'Team retrospective',
      completed: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
      category: 'Work',
      priority: 'Medium',
      tags: ['team', 'retrospective']
    },
    {
      id: '3',
      title: 'Update portfolio website',
      completed: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
      category: 'Projects',
      priority: 'Medium',
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      tags: ['portfolio', 'website'],
      status: 'doing'
    },
    {
      id: '4',
      title: 'Read productivity book',
      completed: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30),
      category: 'Personal',
      priority: 'Low',
      tags: ['reading', 'self-improvement']
    },
    {
      id: '5',
      title: 'Plan weekend trip',
      completed: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 15),
      category: 'Personal',
      priority: 'Medium',
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      tags: ['travel', 'planning']
    },
    {
      id: '6',
      title: 'Complete code review',
      completed: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      category: 'Work',
      priority: 'High',
      tags: ['code', 'review']
    }
  ];

  return (
    <AppShell
      step={4}
      initialTasks={initialTasks}
      requireAuth={true}
      features={{
        categories: true,
        tags: true,
        priorities: true,
        dueDates: true,
        analytics: true
      }}
    />
  );
};

export default NotionTodoStep4;
