import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Task } from './types';
import { TaskCard } from './TaskCard';

interface BoardViewProps {
  step: 1 | 2 | 3 | 4;
  tasks: Task[];
  onAddTask: (task: Partial<Task>) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  features: {
    categories?: boolean;
    tags?: boolean;
    priorities?: boolean;
    dueDates?: boolean;
  };
}

export const BoardView: React.FC<BoardViewProps> = ({
  step,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  features
}) => {
  const [showAddTask, setShowAddTask] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Organize tasks by status
  const todoTasks = tasks.filter(task => !task.completed && !task.status);
  const doingTasks = tasks.filter(task => task.status === 'doing');
  const doneTasks = tasks.filter(task => task.completed || task.status === 'done');

  const handleAddTask = (status: 'todo' | 'doing' | 'done') => {
    if (!newTaskTitle.trim()) return;

    const taskData: Partial<Task> = {
      title: newTaskTitle.trim(),
      completed: status === 'done',
      status: status === 'todo' ? undefined : status
    };

    onAddTask(taskData);
    setNewTaskTitle('');
    setShowAddTask(null);
  };

  const renderColumn = (
    title: string,
    tasks: Task[],
    status: 'todo' | 'doing' | 'done',
    bgColor: string,
    textColor: string
  ) => (
    <div className="flex-1 min-w-0">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-medium ${textColor}`}>{title}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <button 
          onClick={() => setShowAddTask(status)}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
        >
          <Plus className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Column Content */}
      <div className={`${bgColor} rounded-lg p-3 min-h-[200px] space-y-3`}>
        {/* Existing Tasks */}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            step={step}
            onToggle={onToggleTask}
            onDelete={onDeleteTask}
            features={features}
          />
        ))}

        {/* Add Task Input */}
        {showAddTask === status ? (
          <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a task..."
              className="w-full bg-transparent border-0 outline-none text-sm text-foreground placeholder-muted-foreground"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddTask(status);
                } else if (e.key === 'Escape') {
                  setShowAddTask(null);
                  setNewTaskTitle('');
                }
              }}
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => handleAddTask(status)}
                className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddTask(null);
                  setNewTaskTitle('');
                }}
                className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddTask(status)}
            className="w-full flex items-center gap-2 p-3 text-sm text-muted-foreground hover:text-foreground hover:bg-card/50 rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 transition-all"
          >
            <Plus className="w-4 h-4" />
            New task
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="group">
      <div className="flex gap-6 overflow-x-auto pb-4">
        {/* To Do Column */}
        {renderColumn(
          'To Do',
          todoTasks.filter(task => !doingTasks.includes(task)),
          'todo',
          'bg-red-50 dark:bg-red-950/20',
          'text-red-700 dark:text-red-400'
        )}

        {/* Doing Column */}
        {renderColumn(
          'Doing',
          doingTasks,
          'doing',
          'bg-yellow-50 dark:bg-yellow-950/20',
          'text-yellow-700 dark:text-yellow-400'
        )}

        {/* Done Column */}
        {renderColumn(
          'Done',
          doneTasks,
          'done',
          'bg-green-50 dark:bg-green-950/20',
          'text-green-700 dark:text-green-400'
        )}
      </div>
    </div>
  );
};
