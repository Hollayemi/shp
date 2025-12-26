import React from 'react';
import { 
  Home, 
  Users, 
  BarChart3, 
  Calendar, 
  Settings, 
  Bell,
  HelpCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ViewType, DayOffFeatures } from './types';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  step: number;
  features: DayOffFeatures;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onShowRequestForm?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onViewChange, 
  step,
  features,
  isCollapsed,
  onToggleCollapse,
  onShowRequestForm
}) => {
  const navigationItems = [
    { id: 'dashboard' as ViewType, label: 'Dashboard', icon: Home, available: true },
    { id: 'employees' as ViewType, label: 'Employees', icon: Users, available: features.showEmployeeManagement },
    { id: 'reports' as ViewType, label: 'Reports', icon: BarChart3, available: features.showReports },
    { id: 'shift-planner' as ViewType, label: 'Shift planner', icon: Calendar, available: features.showShiftPlanner },
  ];

  const settingsItems = [
    { id: 'settings' as ViewType, label: 'Settings', icon: Settings, available: true },
  ];

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 flex flex-col h-full transition-all duration-300`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            {!isCollapsed && <span className="font-semibold text-gray-900">Vacation tracker</span>}
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
        {!isCollapsed && (
          <div className="mt-3">
            <button 
              onClick={onShowRequestForm}
              disabled={!onShowRequestForm}
              className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <span className="text-lg">+</span>
              <span>Add new</span>
            </button>
          </div>
        )}
        {isCollapsed && (
          <div className="mt-3">
            <button 
              onClick={onShowRequestForm}
              disabled={!onShowRequestForm}
              className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
            >
              <span className="text-lg">+</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4">
        <nav className="space-y-1">
          {navigationItems.map((item) => {
            if (!item.available) return null;
            
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-pink-50 text-pink-700 border border-pink-200' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4" />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Settings Section */}
        <div className="mt-8">
          <div className="space-y-1">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-pink-50 text-pink-700 border border-pink-200' 
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {!isCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        {!isCollapsed ? (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">S</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Manager</p>
              <p className="text-xs text-gray-500 truncate">Manager</p>
            </div>
            <div className="flex space-x-1">
              <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <Bell className="w-4 h-4" />
              </button>
              <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">S</span>
            </div>
            <div className="flex space-x-1">
              <button className="p-1 text-gray-400 hover:text-gray-600 rounded" title="Notifications">
                <Bell className="w-4 h-4" />
              </button>
              <button className="p-1 text-gray-400 hover:text-gray-600 rounded" title="Help">
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
