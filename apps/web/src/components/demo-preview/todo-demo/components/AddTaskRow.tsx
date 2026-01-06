import React, { useState, KeyboardEvent } from 'react';
import { Check, X } from 'lucide-react';
import { Task } from './types';

interface AddTaskRowProps {
  step: 1 | 2 | 3 | 4;
  columns: Array<{ id: string; label: string; width: string }>;
  onAdd: (task: Partial<Task>) => void;
  onCancel: () => void;
  features: {
    categories?: boolean;
    tags?: boolean;
    priorities?: boolean;
    dueDates?: boolean;
  };
}

export const AddTaskRow: React.FC<AddTaskRowProps> = ({
  step,
  columns,
  onAdd,
  onCancel,
  features
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return;

    const taskData: Partial<Task> = {
      title: title.trim(),
    };

    if (step >= 2 && category) {
      taskData.category = category;
    }

    if (step >= 3) {
      if (priority) taskData.priority = priority as 'Low' | 'Medium' | 'High';
      if (dueDate) taskData.dueDate = new Date(dueDate);
    }

    onAdd(taskData);
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const renderColumnInput = (columnId: string) => {
    switch (columnId) {
      case 'title':
        return (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Add a task..."
            className="w-full bg-transparent border-0 outline-none text-foreground placeholder-muted-foreground"
            autoFocus
          />
        );
      
      case 'status':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
            To Do
          </span>
        );
      
      case 'category':
        return features.categories ? (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-transparent border-0 outline-none text-sm text-foreground"
          >
            <option value="">Select...</option>
            <option value="Work">Work</option>
            <option value="Personal">Personal</option>
            <option value="Projects">Projects</option>
          </select>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );
      
      case 'priority':
        return features.priorities ? (
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="bg-transparent border-0 outline-none text-sm text-foreground"
          >
            <option value="">Select...</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );
      
      case 'dueDate':
        return features.dueDates ? (
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-transparent border-0 outline-none text-sm text-foreground"
          />
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center bg-muted/20 border-b border-border last:border-b-0">
      {columns.map((column) => (
        <div key={column.id} className={`${column.width} px-4 py-3`}>
          {renderColumnInput(column.id)}
        </div>
      ))}
      
      {/* Actions */}
      <div className="w-8 px-2 flex gap-1">
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="p-1 hover:bg-green-100 hover:text-green-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
