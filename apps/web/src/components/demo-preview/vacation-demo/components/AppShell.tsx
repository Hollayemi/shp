import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { DashboardView } from './DashboardView';
import { EmployeesView } from './EmployeesView';
import { ReportsView } from './ReportsView';
import { SettingsView } from './SettingsView';
import { RequestForm } from './RequestForm';
import { Employee, LeaveRequest, ViewType, DayOffFeatures } from './types';

interface AppShellProps {
  step: number;
  features: DayOffFeatures;
  initialEmployees?: Employee[];
  initialLeaveRequests?: LeaveRequest[];
}

export const AppShell: React.FC<AppShellProps> = ({ 
  step, 
  features, 
  initialEmployees = [],
  initialLeaveRequests = []
}) => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [employees] = useState<Employee[]>(initialEmployees);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(initialLeaveRequests);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  const handleShowRequestForm = () => {
    setShowRequestForm(true);
  };

  const handleCloseRequestForm = () => {
    setShowRequestForm(false);
  };

  const handleSubmitRequest = (newRequest: Omit<LeaveRequest, 'id' | 'submittedAt'>) => {
    const request: LeaveRequest = {
      ...newRequest,
      id: `req_${Date.now()}`,
      submittedAt: new Date()
    };
    setLeaveRequests(prev => [...prev, request]);
  };

  const handleApproveRequest = (requestId: string) => {
    setLeaveRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, status: 'approved' as const, approver: 'Manager', approvedAt: new Date() }
          : req
      )
    );
  };

  const handleDenyRequest = (requestId: string) => {
    setLeaveRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, status: 'rejected' as const, approver: 'Manager', approvedAt: new Date() }
          : req
      )
    );
  };

  const renderMainContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            step={step}
            features={features}
            employees={employees}
            leaveRequests={leaveRequests}
            onApproveRequest={handleApproveRequest}
            onDenyRequest={handleDenyRequest}
          />
        );
      case 'employees':
        return (
          <EmployeesView
            step={step}
            features={features}
            employees={employees}
            leaveRequests={leaveRequests}
            onShowRequestForm={step >= 2 ? handleShowRequestForm : undefined}
          />
        );
      case 'reports':
        return (
          <ReportsView
            step={step}
            features={features}
            employees={employees}
            leaveRequests={leaveRequests}
          />
        );
      case 'shift-planner':
        return (
          <div className="flex-1 p-6 bg-gray-50">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-2xl font-bold text-gray-900">Shift Planner</h1>
              <p className="text-gray-600 mt-1">Coming in Step 4...</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <SettingsView
            step={step}
            features={features}
            employees={employees}
            leaveRequests={leaveRequests}
          />
        );
      default:
        return (
          <DashboardView
            step={step}
            features={features}
            employees={employees}
            leaveRequests={leaveRequests}
          />
        );
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        step={step}
        features={features}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        onShowRequestForm={step >= 2 ? handleShowRequestForm : undefined}
      />
      <div className="flex-1 overflow-y-auto">
        {renderMainContent()}
      </div>
      
      {/* Request Form Modal */}
      {step >= 2 && (
        <RequestForm
          employees={employees}
          onSubmitRequest={handleSubmitRequest}
          onClose={handleCloseRequestForm}
          open={showRequestForm}
        />
      )}
    </div>
  );
};
