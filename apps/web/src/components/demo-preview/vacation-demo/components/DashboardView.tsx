import React, { useState } from 'react';
import { Calendar, Clock, Users, TrendingUp, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Employee, LeaveRequest, DayOffFeatures } from './types';

interface DashboardViewProps {
  step: number;
  features: DayOffFeatures;
  employees: Employee[];
  leaveRequests: LeaveRequest[];
  onApproveRequest?: (requestId: string) => void;
  onDenyRequest?: (requestId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  step, 
  features, 
  employees, 
  leaveRequests,
  onApproveRequest,
  onDenyRequest
}) => {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 8, 1)); // September 2025
  const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month');
  
  const totalEmployees = employees.length;
  const today = new Date();
  const requestsToday = leaveRequests.filter(req => {
    const reqDate = new Date(req.submittedAt);
    return reqDate.toDateString() === today.toDateString();
  }).length;
  
  const requestsThisMonth = leaveRequests.filter(req => {
    const reqDate = new Date(req.submittedAt);
    return reqDate.getMonth() === today.getMonth() && reqDate.getFullYear() === today.getFullYear();
  }).length;

  // Calendar functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1; // Convert Sunday (0) to be last (6)
  };

  const getLeaveRequestsForDate = (date: Date) => {
    return leaveRequests.filter(req => {
      const startDate = new Date(req.startDate);
      const endDate = new Date(req.endDate);
      return date >= startDate && date <= endDate && req.status === 'approved';
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit',
      year: 'numeric' 
    });
  };

  const renderCalendarGrid = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="aspect-square p-1">
          <div className="w-full h-full"></div>
        </div>
      );
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const isToday = cellDate.toDateString() === new Date().toDateString();
      const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
      const leaveRequests = getLeaveRequestsForDate(cellDate);
      
      days.push(
        <div key={day} className="aspect-square p-1">
          <div className={`w-full h-full flex flex-col items-center justify-start text-sm rounded relative ${
            isToday ? 'bg-blue-500 text-white' : 
            isWeekend ? 'bg-gray-100 text-gray-400' : 
            'text-gray-700 hover:bg-gray-50'
          }`}>
            <span className="mt-1 font-medium">{day}</span>
            {leaveRequests.length > 0 && (
              <div className="flex flex-wrap gap-0.5 mt-1">
                {leaveRequests.slice(0, 2).map((req, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full ${
                      req.leaveType === 'vacation' ? 'bg-blue-500' :
                      req.leaveType === 'sick' ? 'bg-green-500' :
                      req.leaveType === 'personal' ? 'bg-red-500' :
                      'bg-teal-500'
                    }`}
                    title={`${req.employeeName} - ${req.leaveType}`}
                  />
                ))}
                {leaveRequests.length > 2 && (
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400" title={`+${leaveRequests.length - 2} more`} />
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-medium text-gray-900 mb-6">
            Good morning, Manager ⭐
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Top Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Number of employees</p>
                <p className="text-2xl font-semibold text-gray-900">{totalEmployees}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Requests today</p>
                <p className="text-2xl font-semibold text-gray-900">{requestsToday}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Requests this month</p>
                <p className="text-2xl font-semibold text-gray-900">{requestsThisMonth}</p>
              </div>
            </div>

            {/* Month Overview */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-medium text-gray-900">Month overview</h3>
                <button className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900">
                  <span>🔍</span>
                  <span>Filters</span>
                </button>
              </div>
              
              {/* Calendar Navigation */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => navigateMonth('prev')}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <button 
                    onClick={goToToday}
                    className="text-sm font-medium hover:text-blue-600 cursor-pointer"
                  >
                    Today
                  </button>
                  <button 
                    onClick={() => navigateMonth('next')}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {currentDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} — {new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                </div>
                <div className="flex space-x-1">
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Header */}
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div key={day} className="p-2 text-xs font-medium text-gray-500 text-center">
                    {day}
                  </div>
                ))}
                
                {/* Calendar Days */}
                {renderCalendarGrid()}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-300 rounded"></div>
                  <span className="text-gray-600">Weekends</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-400 rounded"></div>
                  <span className="text-gray-600">Holiday</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-gray-600">Vacation Time</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-gray-600">Sick Leave</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-teal-500 rounded"></div>
                  <span className="text-gray-600">Paid Time Off</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                  <span className="text-gray-600">Short/Long-Term Disability</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-gray-600">Personal Leave</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* User Profile */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center border-2 border-pink-200">
                  <span className="text-white text-sm font-medium">👤</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Manager</p>
                  <p className="text-xs text-gray-500">My requests</p>
                </div>
              </div>
            </div>

            {/* Balance */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-4">Balance</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 relative">
                    <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="2"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeDasharray="0, 100"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium">0/1</span>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 font-medium">Vacation Time</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 relative">
                    <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="2"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                        strokeDasharray="0, 100"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium">0/1</span>
                    </div>
                  </div>
                  <p className="text-xs text-green-600 font-medium">Sick Leave</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 relative">
                    <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="2"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2"
                        strokeDasharray="0, 100"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium">0/1</span>
                    </div>
                  </div>
                  <p className="text-xs text-cyan-600 font-medium">Paid Time Off</p>
                </div>
              </div>
            </div>

            {/* Pending Requests */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-4">Pending requests</h3>
              <div className="space-y-3">
                {leaveRequests.filter(req => req.status === 'pending').length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-3 opacity-30">
                      <svg viewBox="0 0 64 64" className="w-full h-full">
                        <path d="M32 8c13.255 0 24 10.745 24 24S45.255 56 32 56 8 45.255 8 32 18.745 8 32 8zm0 4C20.954 12 12 20.954 12 32s8.954 20 20 20 20-8.954 20-20S43.046 12 32 12z" fill="currentColor"/>
                        <path d="M32 20c1.105 0 2 .895 2 2v8h6c1.105 0 2 .895 2 2s-.895 2-2 2h-8c-1.105 0-2-.895-2-2V22c0-1.105.895-2 2-2z" fill="currentColor"/>
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500">No pending requests</p>
                  </div>
                ) : (
                  leaveRequests
                    .filter(req => req.status === 'pending')
                    .slice(0, 3)
                    .map((request) => (
                      <div key={request.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{request.employeeName}</p>
                          <p className="text-xs text-gray-500">{request.startDate.toLocaleDateString()} • {request.days} days</p>
                        </div>
                        <span className="text-xs text-orange-600 font-medium">Pending</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
