import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Employee, LeaveRequest, DayOffFeatures } from './types';

interface ReportsViewProps {
  step: number;
  features: DayOffFeatures;
  employees: Employee[];
  leaveRequests: LeaveRequest[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ 
  step, 
  features, 
  employees, 
  leaveRequests 
}) => {
  const [selectedReport, setSelectedReport] = useState<'balances' | 'detailed' | 'total' | 'accruals' | 'carryover'>('balances');

  // Calculate report data
  const getBalancesData = () => {
    return employees.map(emp => ({
      name: emp.name.split(' ')[0],
      used: emp.vacationBalance.used,
      remaining: emp.vacationBalance.remaining,
      total: emp.vacationBalance.total
    }));
  };

  const getDetailedData = () => {
    const monthlyData = [];
    for (let i = 0; i < 12; i++) {
      const month = new Date(2025, i, 1).toLocaleDateString('en-US', { month: 'short' });
      const monthRequests = leaveRequests.filter(req => {
        const reqMonth = new Date(req.startDate).getMonth();
        return reqMonth === i && req.status === 'approved';
      });
      monthlyData.push({
        month,
        vacation: monthRequests.filter(req => req.leaveType === 'vacation').reduce((sum, req) => sum + req.days, 0),
        sick: monthRequests.filter(req => req.leaveType === 'sick').reduce((sum, req) => sum + req.days, 0),
        personal: monthRequests.filter(req => req.leaveType === 'personal').reduce((sum, req) => sum + req.days, 0)
      });
    }
    return monthlyData;
  };

  const getTotalUsageData = () => {
    const totalVacation = leaveRequests.filter(req => req.leaveType === 'vacation' && req.status === 'approved').reduce((sum, req) => sum + req.days, 0);
    const totalSick = leaveRequests.filter(req => req.leaveType === 'sick' && req.status === 'approved').reduce((sum, req) => sum + req.days, 0);
    const totalPersonal = leaveRequests.filter(req => req.leaveType === 'personal' && req.status === 'approved').reduce((sum, req) => sum + req.days, 0);
    const totalComp = leaveRequests.filter(req => req.leaveType === 'comp' && req.status === 'approved').reduce((sum, req) => sum + req.days, 0);
    
    return [
      { name: 'Vacation', value: totalVacation, color: '#3b82f6' },
      { name: 'Sick Leave', value: totalSick, color: '#10b981' },
      { name: 'Personal', value: totalPersonal, color: '#f59e0b' },
      { name: 'Comp Time', value: totalComp, color: '#8b5cf6' }
    ];
  };

  const getAccrualsData = () => {
    return employees.map(emp => ({
      name: emp.name.split(' ')[0],
      accrued: Math.floor(emp.vacationBalance.total * 0.8),
      used: emp.vacationBalance.used,
      balance: emp.vacationBalance.remaining
    }));
  };

  const getCarryoverData = () => {
    return employees.map(emp => ({
      name: emp.name.split(' ')[0],
      current: emp.vacationBalance.remaining,
      carryover: Math.min(emp.vacationBalance.remaining, 5), // Max 5 days carryover
      forfeited: Math.max(emp.vacationBalance.remaining - 5, 0)
    }));
  };

  const renderChart = () => {
    switch (selectedReport) {
      case 'balances':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={getBalancesData()}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#ec4899"
                dataKey="used"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {getBalancesData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 60%)`} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );

      case 'detailed':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getDetailedData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Bar dataKey="vacation" fill="#3b82f6" />
              <Bar dataKey="sick" fill="#10b981" />
              <Bar dataKey="personal" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'total':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={getTotalUsageData()}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value} days`}
              >
                {getTotalUsageData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );

      case 'accruals':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getAccrualsData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Bar dataKey="accrued" fill="#8b5cf6" />
              <Bar dataKey="used" fill="#ec4899" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'carryover':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getCarryoverData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Bar dataKey="current" fill="#3b82f6" />
              <Bar dataKey="carryover" fill="#10b981" />
              <Bar dataKey="forfeited" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  const reports = [
    {
      id: 'balances' as const,
      title: 'Balances report',
      description: 'Shows the total and used balance for each leave type.',
      color: '#ec4899'
    },
    {
      id: 'detailed' as const,
      title: 'Detailed report',
      description: 'Shows the employees requests overview.',
      color: '#3b82f6'
    },
    {
      id: 'total' as const,
      title: 'Total report',
      description: 'Shows the employees total used balance.',
      color: '#10b981'
    },
    {
      id: 'accruals' as const,
      title: 'Accruals report',
      description: 'Shows balance details of leave types with accrual rates.',
      color: '#8b5cf6',
    },
    {
      id: 'carryover' as const,
      title: 'Carry over report',
      description: 'Shows the carried over balance details for the past and current year.',
      color: '#f59e0b',
    }
  ];

  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-medium text-gray-900 mb-6">Reports</h1>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`bg-white rounded-lg border-2 p-6 cursor-pointer transition-all ${
                selectedReport === report.id
                  ? 'border-pink-500 shadow-lg'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedReport(report.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-base font-medium text-gray-900 mb-2 flex items-center space-x-2">
                    <span>{report.title}</span>
                  </h3>
                  <p className="text-sm text-gray-600">{report.description}</p>
                </div>
              </div>
              <button className="text-sm text-pink-600 hover:text-pink-700 font-medium">
                View full report
              </button>
            </div>
          ))}
        </div>

        {/* Selected Report Display */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-gray-900">
              {reports.find(r => r.id === selectedReport)?.title}
            </h2>
            <button className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium transition-colors">
              Export Report
            </button>
          </div>
          
          <div className="mb-6">
            {renderChart()}
          </div>

          {/* Report Summary */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Total Employees</p>
                <p className="text-lg font-semibold text-gray-900">{employees.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Total Requests</p>
                <p className="text-lg font-semibold text-gray-900">{leaveRequests.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Approved Requests</p>
                <p className="text-lg font-semibold text-gray-900">
                  {leaveRequests.filter(req => req.status === 'approved').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
