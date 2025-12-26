import React from 'react';
import { BarChart3, TrendingUp, Clock, Target, Calendar, Tag, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Task } from './types';

interface AnalyticsViewProps {
  tasks: Task[];
  step: 4;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ tasks }) => {
  const completedTasks = tasks.filter(task => task.completed);
  const pendingTasks = tasks.filter(task => !task.completed);
  const doingTasks = tasks.filter(task => task.status === 'doing');
  const overdueTasks = tasks.filter(task => 
    task.dueDate && task.dueDate < new Date() && !task.completed
  );
  
  const completionRate = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;

  // Category breakdown
  const categoryStats = tasks.reduce((acc, task) => {
    const category = task.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = { total: 0, completed: 0 };
    }
    acc[category].total++;
    if (task.completed) acc[category].completed++;
    return acc;
  }, {} as Record<string, { total: number; completed: number }>);

  // Priority breakdown
  const priorityStats = tasks.reduce((acc, task) => {
    const priority = task.priority || 'None';
    if (!acc[priority]) {
      acc[priority] = { total: 0, completed: 0 };
    }
    acc[priority].total++;
    if (task.completed) acc[priority].completed++;
    return acc;
  }, {} as Record<string, { total: number; completed: number }>);

  const stats = [
    {
      label: 'Total Tasks',
      value: tasks.length,
      icon: <Target className="w-5 h-5" />,
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
    },
    {
      label: 'Completed',
      value: completedTasks.length,
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
    },
    {
      label: 'In Progress',
      value: doingTasks.length,
      icon: <Clock className="w-5 h-5" />,
      color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400'
    },
    {
      label: 'Overdue',
      value: overdueTasks.length,
      icon: <AlertCircle className="w-5 h-5" />,
      color: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="p-6 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Completion Rate Progress */}
      <div className="p-6 bg-card border border-border rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4">Overall Progress</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Completion Rate</span>
            <span className="text-2xl font-bold text-foreground">{Math.round(completionRate)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-green-400 to-emerald-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            ></div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-green-600">{completedTasks.length}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-yellow-600">{doingTasks.length}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-muted-foreground">{pendingTasks.length - doingTasks.length}</div>
              <div className="text-xs text-muted-foreground">To Do</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category & Priority Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="p-6 bg-card border border-border rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5" />
            By Category
          </h3>
          <div className="space-y-3">
            {Object.entries(categoryStats).map(([category, stats]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{category}</span>
                  <span className="text-xs text-muted-foreground">
                    {stats.completed}/{stats.total}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      category === 'Work' ? 'bg-blue-500' :
                      category === 'Personal' ? 'bg-purple-500' :
                      category === 'Projects' ? 'bg-green-500' :
                      'bg-gray-500'
                    }`}
                    style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="p-6 bg-card border border-border rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            By Priority
          </h3>
          <div className="space-y-3">
            {Object.entries(priorityStats).map(([priority, stats]) => (
              <div key={priority} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{priority}</span>
                  <span className="text-xs text-muted-foreground">
                    {stats.completed}/{stats.total}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      priority === 'High' ? 'bg-red-500' :
                      priority === 'Medium' ? 'bg-yellow-500' :
                      priority === 'Low' ? 'bg-green-500' :
                      'bg-gray-500'
                    }`}
                    style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="p-6 bg-card border border-border rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Recent Activity
        </h3>
        <div className="space-y-3">
          {completedTasks.slice(0, 5).map((task) => (
            <div key={task.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground">{task.title}</span>
                {task.category && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {task.category}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {task.completedAt?.toLocaleDateString()}
              </span>
            </div>
          ))}
          {completedTasks.length === 0 && (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No completed tasks yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Deadlines */}
      {tasks.some(task => task.dueDate && !task.completed) && (
        <div className="p-6 bg-card border border-border rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Deadlines
          </h3>
          <div className="space-y-3">
            {tasks
              .filter(task => task.dueDate && !task.completed)
              .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0))
              .slice(0, 5)
              .map((task) => {
                const isOverdue = task.dueDate && task.dueDate < new Date();
                const daysUntilDue = task.dueDate ? Math.ceil((task.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
                
                return (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <AlertCircle className={`w-4 h-4 flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-yellow-500'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground">{task.title}</span>
                      {task.priority && (
                        <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                          task.priority === 'High' ? 'bg-red-100 text-red-700' :
                          task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {task.priority}
                        </span>
                      )}
                    </div>
                    <span className={`text-xs ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {isOverdue ? 'Overdue' : `${daysUntilDue} days`}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
