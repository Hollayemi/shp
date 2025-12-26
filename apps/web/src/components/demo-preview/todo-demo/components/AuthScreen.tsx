import React, { useState } from 'react';
import { LogIn, Mail, Lock } from 'lucide-react';

interface AuthScreenProps {
  onAuthenticated: (user: { name: string; email: string }) => void;
  step: 1 | 2 | 3 | 4;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  step
}) => {
  const [email, setEmail] = useState('sarah.wilson@company.com');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    // Simulate authentication
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Extract name from email for demo purposes
    const name = email.split('@')[0].toUpperCase().replace('.', ' ');
    
    onAuthenticated({
      name: name,
      email: email
    });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Notion-style branding */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-xl font-bold text-primary-foreground">N</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to Your Todo App</h1>
          <p className="text-muted-foreground">Sign in to access your workspace</p>
        </div>

        {/* Login form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-foreground"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-foreground"
                placeholder="Enter your password"
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

        {/* Demo credentials */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-sm font-medium text-foreground mb-2">Demo Credentials</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>📧 Email: sarah.wilson@company.com</p>
            <p>🔑 Password: password</p>
          </div>
        </div>
      </div>
    </div>
  );
};
