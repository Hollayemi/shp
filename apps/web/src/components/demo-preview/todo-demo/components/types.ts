export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  category?: string;
  priority?: 'Low' | 'Medium' | 'High';
  dueDate?: Date;
  tags?: string[];
  description?: string;
  status?: 'todo' | 'doing' | 'done';
}

export interface TaskFilter {
  category?: string;
  priority?: string;
  tag?: string;
  completed?: boolean;
}

export interface ViewConfig {
  name: string;
  type: 'table' | 'board' | 'list';
  filters?: TaskFilter[];
  sorts?: Array<{
    property: keyof Task;
    direction: 'asc' | 'desc';
  }>;
}
