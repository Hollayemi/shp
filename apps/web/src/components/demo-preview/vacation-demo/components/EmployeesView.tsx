import React, { useState } from 'react';
import { Search, Filter, Download, Plus, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Employee, LeaveRequest, DayOffFeatures } from './types';

interface EmployeesViewProps {
  step: number;
  features: DayOffFeatures;
  employees: Employee[];
  leaveRequests: LeaveRequest[];
  onShowRequestForm?: () => void;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({ 
  step, 
  features, 
  employees, 
  leaveRequests,
  onShowRequestForm
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'activated' | 'deactivated'>('activated');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [quickAction, setQuickAction] = useState('');
  const [teamAction, setTeamAction] = useState('');

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedTab === 'activated' ? emp.status === 'active' : emp.status === 'inactive')
  );

  const getEmployeeStats = (employeeId: string) => {
    const empRequests = leaveRequests.filter(req => req.employeeId === employeeId);
    const usedDays = empRequests
      .filter(req => req.status === 'approved')
      .reduce((sum, req) => sum + req.days, 0);
    const totalDays = 25; // Default total vacation days
    return { used: usedDays, total: totalDays };
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(filteredEmployees.map(emp => emp.id));
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees(prev => [...prev, employeeId]);
    } else {
      setSelectedEmployees(prev => prev.filter(id => id !== employeeId));
    }
  };

  const handleQuickAction = (action: string) => {
    setQuickAction(action);
    if (action === 'Request day off' && onShowRequestForm) {
      onShowRequestForm();
    }
    // Reset after action
    setTimeout(() => setQuickAction(''), 100);
  };

  const handleTeamAction = (action: string) => {
    setTeamAction(action);
    if (action === 'Add employee' && onShowRequestForm) {
      onShowRequestForm();
    }
    // Reset after action
    setTimeout(() => setTeamAction(''), 100);
  };

  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-medium text-gray-900 mb-4">Employees</h1>
          
          {/* Action Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              {/* Quick Actions Dropdown */}
              <div className="relative">
                <Select value={quickAction} onValueChange={handleQuickAction}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Quick actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Request day off">Request day off</SelectItem>
                    <SelectItem value="Request comp off">Request comp off</SelectItem>
                    <SelectItem value="Send announcement">Send announcement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Team Actions */}
              <div className="flex items-center space-x-2">
                <Select value={teamAction} onValueChange={handleTeamAction}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Team actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Add employee">Add employee</SelectItem>
                    <SelectItem value="Add leave type">Add leave type</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button 
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2"
              >
                <Filter className="w-4 h-4" />
                <span>Show Filter</span>
              </Button>
              <Button 
                onClick={onShowRequestForm}
                className="flex items-center space-x-2 bg-pink-500 hover:bg-pink-600"
              >
                <Plus className="w-4 h-4" />
                <span>Add employee</span>
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center space-x-6 mb-4">
            <button
              onClick={() => setSelectedTab('activated')}
              className={`pb-2 border-b-2 font-medium text-sm ${
                selectedTab === 'activated'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Activated
            </button>
          </div>

          {/* Export Bar */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Items per page: 50</span>
              <span className="text-sm text-gray-600">1 – 1 of 1</span>
            </div>
          </div>
        </div>

        {/* Employee Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300"
                      checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approvers</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave policy</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Work schedule</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEmployees.map((employee) => {
                  const stats = getEmployeeStats(employee.id);
                  return (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300"
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={(e) => handleSelectEmployee(employee.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              {employee.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{employee.name}</p>
                            <p className="text-xs text-gray-500">{employee.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center space-x-1">
                          <span className="text-sm text-gray-900">•</span>
                          <span className="text-sm text-gray-900">{employee.approvers[0]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">-</td>
                      <td className="px-4 py-4 text-sm text-gray-900">{employee.location}</td>
                      <td className="px-4 py-4 text-sm text-gray-900">{employee.leavePolicy}</td>
                      <td className="px-4 py-4 text-sm text-gray-900">{employee.workSchedule}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {employee.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">{stats.used} / {stats.total}</td>
                      <td className="px-4 py-4 text-sm text-gray-900">0 / 0</td>
                      <td className="px-4 py-4">
                        <div className="relative">
                          <button 
                            onClick={() => {
                              // Toggle employee action menu (could expand to show options)
                              console.log(`Actions for ${employee.name}`);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                            title={`Actions for ${employee.name}`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
