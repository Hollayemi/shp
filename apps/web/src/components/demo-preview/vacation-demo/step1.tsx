import React from 'react';
import { AppShell } from './components/AppShell';
import { Employee, LeaveRequest } from './components/types';

// Step 1: Foundation - Basic Day Off-style employee dashboard
const DayOffVacationStep1: React.FC = () => {
  const initialEmployees: Employee[] = [
    {
      id: '1',
      name: 'Sarah Wilson',
      email: 'sarah.wilson@company.com',
      team: 'Engineering',
      location: 'United States',
      workSchedule: 'Default schedule',
      leavePolicy: 'Default Policy',
      status: 'active',
      approvers: ['Manager'],
      vacationBalance: {
        total: 20,
        used: 8,
        remaining: 12
      },
      sickBalance: {
        total: 10,
        used: 2,
        remaining: 8
      },
      personalBalance: {
        total: 5,
        used: 1,
        remaining: 4
      }
    },
    {
      id: '2',
      name: 'Michael Chen',
      email: 'michael.chen@company.com',
      team: 'Design',
      location: 'United States',
      workSchedule: 'Default schedule',
      leavePolicy: 'Default Policy',
      status: 'active',
      approvers: ['Manager'],
      vacationBalance: {
        total: 20,
        used: 5,
        remaining: 15
      },
      sickBalance: {
        total: 10,
        used: 0,
        remaining: 10
      },
      personalBalance: {
        total: 5,
        used: 0,
        remaining: 5
      }
    },
    {
      id: '3',
      name: 'Emily Rodriguez',
      email: 'emily.rodriguez@company.com',
      team: 'Marketing',
      location: 'United States',
      workSchedule: 'Default schedule',
      leavePolicy: 'Default Policy',
      status: 'active',
      approvers: ['Manager'],
      vacationBalance: {
        total: 20,
        used: 12,
        remaining: 8
      },
      sickBalance: {
        total: 10,
        used: 3,
        remaining: 7
      },
      personalBalance: {
        total: 5,
        used: 2,
        remaining: 3
      }
    }
  ];

  const initialLeaveRequests: LeaveRequest[] = [
    {
      id: '1',
      employeeId: '1',
      employeeName: 'Sarah Wilson',
      leaveType: 'vacation',
      startDate: new Date('2025-09-15'),
      endDate: new Date('2025-09-17'),
      days: 3,
      reason: 'Family vacation',
      status: 'approved',
      approver: 'Manager',
      submittedAt: new Date('2025-09-01'),
      approvedAt: new Date('2025-09-02')
    },
    {
      id: '2',
      employeeId: '2',
      employeeName: 'Michael Chen',
      leaveType: 'sick',
      startDate: new Date('2025-09-10'),
      endDate: new Date('2025-09-10'),
      days: 1,
      reason: 'Medical appointment',
      status: 'approved',
      approver: 'Manager',
      submittedAt: new Date('2025-09-08'),
      approvedAt: new Date('2025-09-09')
    },
    {
      id: '3',
      employeeId: '3',
      employeeName: 'Emily Rodriguez',
      leaveType: 'personal',
      startDate: new Date('2025-09-25'),
      endDate: new Date('2025-09-26'),
      days: 2,
      reason: 'Personal matter',
      status: 'approved',
      approver: 'Manager',
      submittedAt: new Date('2025-09-20'),
      approvedAt: new Date('2025-09-21')
    },
    {
      id: '4',
      employeeId: '1',
      employeeName: 'Sarah Wilson',
      leaveType: 'vacation',
      startDate: new Date('2025-10-15'),
      endDate: new Date('2025-10-19'),
      days: 5,
      reason: 'Family vacation to Hawaii',
      status: 'pending',
      submittedAt: new Date('2025-09-25')
    },
    {
      id: '5',
      employeeId: '2',
      employeeName: 'Michael Chen',
      leaveType: 'comp',
      startDate: new Date('2025-09-05'),
      endDate: new Date('2025-09-06'),
      days: 2,
      reason: 'Comp time off',
      status: 'approved',
      approver: 'Manager',
      submittedAt: new Date('2025-08-28'),
      approvedAt: new Date('2025-08-29')
    },
    {
      id: '6',
      employeeId: '3',
      employeeName: 'Emily Rodriguez',
      leaveType: 'vacation',
      startDate: new Date('2025-10-08'),
      endDate: new Date('2025-10-12'),
      days: 5,
      reason: 'Wedding anniversary trip',
      status: 'pending',
      submittedAt: new Date('2025-09-26')
    },
    {
      id: '7',
      employeeId: '2',
      employeeName: 'Michael Chen',
      leaveType: 'personal',
      startDate: new Date('2025-10-03'),
      endDate: new Date('2025-10-03'),
      days: 1,
      reason: 'Doctor appointment',
      status: 'pending',
      submittedAt: new Date('2025-09-27')
    }
  ];

  return (
    <AppShell
      step={1}
      features={{
        showEmployeeManagement: false,
        showReports: false,
        showShiftPlanner: false,
        showAdvancedFilters: false
      }}
      initialEmployees={initialEmployees}
      initialLeaveRequests={initialLeaveRequests}
    />
  );
};

export default DayOffVacationStep1;
