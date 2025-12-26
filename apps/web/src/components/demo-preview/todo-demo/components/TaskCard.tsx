import React from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { Task } from './types';

interface TaskCardProps {
  task: Task;
  step: 1 | 2 | 3 | 4;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  features: {
    categories?: boolean;
    tags?: boolean;
    priorities?: boolean;
    dueDates?: boolean;
  };
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  step,
  onToggle,
  onDelete,
  features
}) => {
  return (
    <div className="group bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-pointer">
      {/* Task Content */}
      <div className="flex items-start gap-3">
        {/* Task Icon/Emoji */}
        <div className="flex-shrink-0 mt-0.5">
          {task.title.includes('Fig') ? (
            <span className="text-base">🐕</span>
          ) : (
            <span className="text-base">📄</span>
          )}
        </div>

        {/* Task Title */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {task.title}
          </p>

          {/* Task Metadata - Step 3+ */}
          {step >= 3 && (task.category || task.priority || task.tags?.length) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Category */}
              {features.categories && task.category && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                  {task.category}
                </span>
              )}

              {/* Priority */}
              {features.priorities && task.priority && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                  task.priority === 'High' ? 'bg-red-100 text-red-700 border-red-200' :
                  task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                  'bg-green-100 text-green-700 border-green-200'
                }`}>
                  {task.priority}
                </span>
              )}

              {/* Tags */}
              {task.tags?.slice(0, 2).map((tag, index) => (
                <span key={index} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Due Date - Step 3+ */}
          {step >= 3 && features.dueDates && task.dueDate && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {task.dueDate.toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Actions */}
        {step > 1 && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              className="p-1 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
