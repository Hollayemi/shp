export interface Employee {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  team: string;
  location: string;
  workSchedule: string;
  leavePolicy: string;
  status: 'active' | 'inactive';
  approvers: string[];
  vacationBalance: {
    total: number;
    used: number;
    remaining: number;
  };
  sickBalance: {
    total: number;
    used: number;
    remaining: number;
  };
  personalBalance: {
    total: number;
    used: number;
    remaining: number;
  };
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'vacation' | 'sick' | 'personal' | 'comp';
  startDate: Date;
  endDate: Date;
  days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approver?: string;
  submittedAt: Date;
  approvedAt?: Date;
}

export interface DayOffFeatures {
  showEmployeeManagement?: boolean;
  showReports?: boolean;
  showShiftPlanner?: boolean;
  showAdvancedFilters?: boolean;
}

export type ViewType = 'dashboard' | 'employees' | 'reports' | 'shift-planner' | 'settings';
