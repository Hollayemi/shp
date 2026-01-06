import React, { useState } from 'react';
import { Bell, User, Shield, Calendar, Mail, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Employee, LeaveRequest, DayOffFeatures } from './types';

interface SettingsViewProps {
  step: number;
  features: DayOffFeatures;
  employees: Employee[];
  leaveRequests: LeaveRequest[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  step, 
  features, 
  employees, 
  leaveRequests 
}) => {
  const [notifications, setNotifications] = useState({
    emailRequests: true,
    emailApprovals: true,
    pushNotifications: false,
    weeklyDigest: true
  });

  const [workSettings, setWorkSettings] = useState({
    workingDays: 5,
    vacationDays: 20,
    sickDays: 10,
    personalDays: 5
  });

  const [profile, setProfile] = useState({
    name: 'Manager',
    email: 'Manager@company.com',
    role: 'Manager',
    timezone: 'UTC-5 (Eastern Time)'
  });

  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-medium text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Configure your workspace</p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="text-lg font-medium text-gray-900">Profile</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={profile.role} onValueChange={(value) => setProfile(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Employee">Employee</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={profile.timezone} onValueChange={(value) => setProfile(prev => ({ ...prev, timezone: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC-5 (Eastern Time)">UTC-5 (Eastern Time)</SelectItem>
                    <SelectItem value="UTC-6 (Central Time)">UTC-6 (Central Time)</SelectItem>
                    <SelectItem value="UTC-7 (Mountain Time)">UTC-7 (Mountain Time)</SelectItem>
                    <SelectItem value="UTC-8 (Pacific Time)">UTC-8 (Pacific Time)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Bell className="w-4 h-4 text-green-600" />
              </div>
              <h2 className="text-lg font-medium text-gray-900">Notifications</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Email for new requests</p>
                  <p className="text-xs text-gray-500">Get notified when employees submit leave requests</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.emailRequests}
                  onChange={(e) => setNotifications(prev => ({ ...prev, emailRequests: e.target.checked }))}
                  className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Email for approvals</p>
                  <p className="text-xs text-gray-500">Get notified when requests are approved or denied</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.emailApprovals}
                  onChange={(e) => setNotifications(prev => ({ ...prev, emailApprovals: e.target.checked }))}
                  className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Push notifications</p>
                  <p className="text-xs text-gray-500">Receive browser notifications for urgent updates</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.pushNotifications}
                  onChange={(e) => setNotifications(prev => ({ ...prev, pushNotifications: e.target.checked }))}
                  className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Weekly digest</p>
                  <p className="text-xs text-gray-500">Summary of team leave activity every Monday</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.weeklyDigest}
                  onChange={(e) => setNotifications(prev => ({ ...prev, weeklyDigest: e.target.checked }))}
                  className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                />
              </div>
            </div>
          </div>

          {/* Work Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-purple-600" />
              </div>
              <h2 className="text-lg font-medium text-gray-900">Leave Policies</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workingDays">Working days per week</Label>
                <Input
                  id="workingDays"
                  type="number"
                  min="1"
                  max="7"
                  value={workSettings.workingDays}
                  onChange={(e) => setWorkSettings(prev => ({ ...prev, workingDays: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vacationDays">Annual vacation days</Label>
                <Input
                  id="vacationDays"
                  type="number"
                  min="0"
                  max="50"
                  value={workSettings.vacationDays}
                  onChange={(e) => setWorkSettings(prev => ({ ...prev, vacationDays: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sickDays">Annual sick days</Label>
                <Input
                  id="sickDays"
                  type="number"
                  min="0"
                  max="30"
                  value={workSettings.sickDays}
                  onChange={(e) => setWorkSettings(prev => ({ ...prev, sickDays: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personalDays">Annual personal days</Label>
                <Input
                  id="personalDays"
                  type="number"
                  min="0"
                  max="20"
                  value={workSettings.personalDays}
                  onChange={(e) => setWorkSettings(prev => ({ ...prev, personalDays: parseInt(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button className="bg-pink-500 hover:bg-pink-600">
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
