import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Employee, LeaveRequest } from './types';

interface RequestFormProps {
  employees: Employee[];
  onSubmitRequest: (request: Omit<LeaveRequest, 'id' | 'submittedAt'>) => void;
  onClose: () => void;
  open: boolean;
}

export const RequestForm: React.FC<RequestFormProps> = ({ 
  employees, 
  onSubmitRequest, 
  onClose,
  open
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [leaveType, setLeaveType] = useState<'vacation' | 'sick' | 'personal' | 'comp'>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const days = calculateDays(startDate, endDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEmployee || !startDate || !endDate) return;
    
    const employee = employees.find(emp => emp.id === selectedEmployee);
    if (!employee) return;

    onSubmitRequest({
      employeeId: selectedEmployee,
      employeeName: employee.name,
      leaveType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      days,
      reason: reason || undefined,
      status: 'pending'
    });

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <rect x="10" y="20" width="80" height="60" rx="5" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2"/>
                  <rect x="20" y="35" width="15" height="10" fill="#6b7280"/>
                  <rect x="40" y="35" width="15" height="10" fill="#6b7280"/>
                  <rect x="60" y="35" width="15" height="10" fill="#6b7280"/>
                  <rect x="20" y="50" width="15" height="10" fill="#6b7280"/>
                  <rect x="40" y="50" width="15" height="10" fill="#6b7280"/>
                  <rect x="60" y="50" width="15" height="10" fill="#6b7280"/>
                  <rect x="20" y="65" width="15" height="10" fill="#6b7280"/>
                </svg>
              </div>
            </div>
            <DialogTitle className="text-lg font-medium text-gray-900">Submit leave request</DialogTitle>
          </div>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Employee and Leave Type Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee} required>
                <SelectTrigger className="shadow-none">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leaveType">Leave type</Label>
              <Select value={leaveType} onValueChange={(value) => setLeaveType(value as 'vacation' | 'sick' | 'personal' | 'comp')}>
                <SelectTrigger className="shadow-none">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Vacation Time</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="personal">Personal Leave</SelectItem>
                  <SelectItem value="comp">Comp Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="shadow-none"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="shadow-none"
                required
              />
            </div>
          </div>

          {/* Days Display and Leave Balance */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Days requested:</span> {days > 0 ? days : 0}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">Available:</span> {days}/25 Days/Year
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason for leave request..."
              rows={3}
              className="resize-none shadow-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-2 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="shadow-none"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedEmployee || !startDate || !endDate}
              className="bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 shadow-none"
            >
              Submit request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
