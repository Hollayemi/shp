import React from 'react';
import { AppShell } from './components/AppShell';
import { Employee, LeaveRequest } from './components/types';

// Step 4: Analytics & Reporting - Adds comprehensive reporting and analytics features
const DayOffVacationStep4: React.FC = () => {
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
    },
    {
      id: '4',
      name: 'David Kim',
      email: 'david.kim@company.com',
      team: 'Engineering',
      location: 'United States',
      workSchedule: 'Default schedule',
      leavePolicy: 'Default Policy',
      status: 'active',
      approvers: ['Manager'],
      vacationBalance: {
        total: 20,
        used: 3,
        remaining: 17
      },
      sickBalance: {
        total: 10,
        used: 1,
        remaining: 9
      },
      personalBalance: {
        total: 5,
        used: 0,
        remaining: 5
      }
    },
    {
      id: '5',
      name: 'Lisa Thompson',
      email: 'lisa.thompson@company.com',
      team: 'Sales',
      location: 'United States',
      workSchedule: 'Default schedule',
      leavePolicy: 'Default Policy',
      status: 'active',
      approvers: ['Manager'],
      vacationBalance: {
        total: 20,
        used: 15,
        remaining: 5
      },
      sickBalance: {
        total: 10,
        used: 4,
        remaining: 6
      },
      personalBalance: {
        total: 5,
        used: 3,
        remaining: 2
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
    },
    {
      id: '8',
      employeeId: '4',
      employeeName: 'David Kim',
      leaveType: 'vacation',
      startDate: new Date('2025-11-20'),
      endDate: new Date('2025-11-24'),
      days: 5,
      reason: 'Thanksgiving week',
      status: 'pending',
      submittedAt: new Date('2025-09-28')
    },
    {
      id: '9',
      employeeId: '5',
      employeeName: 'Lisa Thompson',
      leaveType: 'vacation',
      startDate: new Date('2025-08-01'),
      endDate: new Date('2025-08-10'),
      days: 10,
      reason: 'Summer vacation',
      status: 'approved',
      approver: 'Manager',
      submittedAt: new Date('2025-07-15'),
      approvedAt: new Date('2025-07-16')
    },
    {
      id: '10',
      employeeId: '5',
      employeeName: 'Lisa Thompson',
      leaveType: 'sick',
      startDate: new Date('2025-07-20'),
      endDate: new Date('2025-07-22'),
      days: 3,
      reason: 'Flu recovery',
      status: 'approved',
      approver: 'Manager',
      submittedAt: new Date('2025-07-20'),
      approvedAt: new Date('2025-07-20')
    }
  ];

  return (
    <AppShell
      step={4}
      features={{
        showEmployeeManagement: true,
        showReports: true,
        showShiftPlanner: false,
        showAdvancedFilters: true
      }}
      initialEmployees={initialEmployees}
      initialLeaveRequests={initialLeaveRequests}
    />
  );
};

export default DayOffVacationStep4;
