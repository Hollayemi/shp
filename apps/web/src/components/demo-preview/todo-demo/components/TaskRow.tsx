import React from 'react';
import { Check, MoreHorizontal, Trash2, Calendar, Tag } from 'lucide-react';
import { Task } from './types';

interface TaskRowProps {
  task: Task;
  step: 1 | 2 | 3 | 4;
  columns: Array<{ id: string; label: string; width: string }>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  features: {
    categories?: boolean;
    tags?: boolean;
    priorities?: boolean;
    dueDates?: boolean;
  };
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  step,
  columns,
  onToggle,
  onDelete,
  features
}) => {
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-700 border-red-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'Work': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Personal': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Projects': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const renderColumnContent = (columnId: string) => {
    switch (columnId) {
      case 'title':
        return (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onToggle(task.id)}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                task.completed
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-muted-foreground hover:border-primary'
              }`}
            >
              {task.completed && <Check className="w-3 h-3" />}
            </button>
            <span className={`${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {task.title}
            </span>
          </div>
        );
      
      case 'status':
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            task.completed 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : 'bg-gray-100 text-gray-700 border border-gray-200'
          }`}>
            {task.completed ? 'Done' : 'To Do'}
          </span>
        );
      
      case 'category':
        return task.category ? (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getCategoryColor(task.category)}`}>
            {task.category}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );
      
      case 'priority':
        return task.priority ? (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );
      
      case 'dueDate':
        return task.dueDate ? (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {task.dueDate.toLocaleDateString()}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="group flex items-center hover:bg-muted/30 transition-colors border-b border-border last:border-b-0">
      {columns.map((column) => (
        <div key={column.id} className={`${column.width} px-4 py-3`}>
          {renderColumnContent(column.id)}
        </div>
      ))}
      
      {/* Actions */}
      <div className="w-8 px-2">
        {step > 1 && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onDelete(task.id)}
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
