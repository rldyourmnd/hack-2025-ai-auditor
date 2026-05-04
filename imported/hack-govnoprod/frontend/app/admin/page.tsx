'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Settings, Users, BarChart3, Key, Database, Server } from "lucide-react";
import Link from 'next/link';

const curestryColors = {
  text: '#ffffff',
  background: '#111111',
  primary: '#2AC8AA',
  secondary: '#27c7fb',
  accent: '#fbbf24',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  border: '#1a1a1a',
  muted: '#888888'
};

export default function AdminPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Simple admin authentication
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      setIsAuthorized(true);
      setError('');
    } else {
      setError('Invalid password');
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: curestryColors.background }}>
        <Card style={{ backgroundColor: curestryColors.border, borderColor: curestryColors.border, width: '400px' }}>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Shield className="w-8 h-8" style={{ color: curestryColors.primary }} />
            </div>
            <CardTitle style={{ color: curestryColors.text }}>Admin Access</CardTitle>
            <p className="text-sm" style={{ color: curestryColors.muted }}>
              Enter admin password to continue
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="password"
                  placeholder="Admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border,
                    color: curestryColors.text
                  }}
                />
                {error && (
                  <p className="text-sm mt-2" style={{ color: curestryColors.error }}>
                    {error}
                  </p>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full"
                style={{ 
                  backgroundColor: curestryColors.primary,
                  color: curestryColors.background 
                }}
              >
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: curestryColors.background }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: curestryColors.border }}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8" style={{ color: curestryColors.primary }} />
              <div>
                <h1 className="text-2xl font-bold" style={{ color: curestryColors.text }}>
                  Admin Dashboard
                </h1>
                <p className="text-sm" style={{ color: curestryColors.muted }}>
                  System administration and monitoring
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setIsAuthorized(false)}
              variant="outline"
              style={{ 
                borderColor: curestryColors.border,
                color: curestryColors.muted 
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* CCI Analytics Dashboard */}
          <Card style={{ backgroundColor: curestryColors.border, borderColor: curestryColors.border }}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" style={{ color: curestryColors.primary }} />
                <CardTitle className="text-lg" style={{ color: curestryColors.text }}>
                  CCI Analytics
                </CardTitle>
              </div>
              <p className="text-sm" style={{ color: curestryColors.muted }}>
                Code consistency intelligence monitoring
              </p>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard">
                <Button 
                  className="w-full mb-3"
                  style={{ 
                    backgroundColor: curestryColors.primary,
                    color: curestryColors.background 
                  }}
                >
                  View Dashboard
                </Button>
              </Link>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>Real-time metrics</span>
                  <span style={{ color: curestryColors.success }}>Active</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>File analysis</span>
                  <span style={{ color: curestryColors.success }}>Enabled</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card style={{ backgroundColor: curestryColors.border, borderColor: curestryColors.border }}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5" style={{ color: curestryColors.secondary }} />
                <CardTitle className="text-lg" style={{ color: curestryColors.text }}>
                  System Status
                </CardTitle>
              </div>
              <p className="text-sm" style={{ color: curestryColors.muted }}>
                Infrastructure monitoring
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>API Service</span>
                  <span style={{ color: curestryColors.success }}>Healthy</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>Database</span>
                  <span style={{ color: curestryColors.success }}>Connected</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>Redis Cache</span>
                  <span style={{ color: curestryColors.success }}>Active</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>Docker Services</span>
                  <span style={{ color: curestryColors.success }}>6/6 Running</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card style={{ backgroundColor: curestryColors.border, borderColor: curestryColors.border }}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" style={{ color: curestryColors.accent }} />
                <CardTitle className="text-lg" style={{ color: curestryColors.text }}>
                  User Management
                </CardTitle>
              </div>
              <p className="text-sm" style={{ color: curestryColors.muted }}>
                Access control and permissions
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>Active Sessions</span>
                  <span style={{ color: curestryColors.text }}>1</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>Admin Users</span>
                  <span style={{ color: curestryColors.text }}>1</span>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-3"
                  style={{ 
                    borderColor: curestryColors.border,
                    color: curestryColors.muted 
                  }}
                  disabled
                >
                  Manage Users (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* API Configuration */}
          <Card style={{ backgroundColor: curestryColors.border, borderColor: curestryColors.border }}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5" style={{ color: curestryColors.warning }} />
                <CardTitle className="text-lg" style={{ color: curestryColors.text }}>
                  API Configuration
                </CardTitle>
              </div>
              <p className="text-sm" style={{ color: curestryColors.muted }}>
                External service configuration
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>OpenAI API</span>
                  <span style={{ color: curestryColors.error }}>Not Configured</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>Anthropic API</span>
                  <span style={{ color: curestryColors.error }}>Not Configured</span>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-3"
                  style={{ 
                    borderColor: curestryColors.border,
                    color: curestryColors.muted 
                  }}
                  disabled
                >
                  Configure APIs (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Database Management */}
          <Card style={{ backgroundColor: curestryColors.border, borderColor: curestryColors.border }}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5" style={{ color: curestryColors.primary }} />
                <CardTitle className="text-lg" style={{ color: curestryColors.text }}>
                  Database
                </CardTitle>
              </div>
              <p className="text-sm" style={{ color: curestryColors.muted }}>
                Data management and backup
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>Connection</span>
                  <span style={{ color: curestryColors.success }}>Healthy</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>Tables</span>
                  <span style={{ color: curestryColors.text }}>5</span>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-3"
                  style={{ 
                    borderColor: curestryColors.border,
                    color: curestryColors.muted 
                  }}
                  disabled
                >
                  Database Tools (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* System Settings */}
          <Card style={{ backgroundColor: curestryColors.border, borderColor: curestryColors.border }}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" style={{ color: curestryColors.secondary }} />
                <CardTitle className="text-lg" style={{ color: curestryColors.text }}>
                  Settings
                </CardTitle>
              </div>
              <p className="text-sm" style={{ color: curestryColors.muted }}>
                System configuration
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>Environment</span>
                  <span style={{ color: curestryColors.text }}>Development</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: curestryColors.muted }}>Log Level</span>
                  <span style={{ color: curestryColors.text }}>INFO</span>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-3"
                  style={{ 
                    borderColor: curestryColors.border,
                    color: curestryColors.muted 
                  }}
                  disabled
                >
                  System Settings (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card style={{ backgroundColor: curestryColors.border, borderColor: curestryColors.border }}>
          <CardHeader>
            <CardTitle style={{ color: curestryColors.text }}>Quick Actions</CardTitle>
            <p className="text-sm" style={{ color: curestryColors.muted }}>
              Common administrative tasks
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Link href="/dashboard">
                <Button 
                  className="w-full"
                  style={{ 
                    backgroundColor: curestryColors.primary,
                    color: curestryColors.background 
                  }}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  CCI Dashboard
                </Button>
              </Link>
              <Link href="/analyze">
                <Button 
                  variant="outline" 
                  className="w-full"
                  style={{ 
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.primary,
                    color: curestryColors.primary,
                    border: `1px solid ${curestryColors.primary}`
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Analyze Code
                </Button>
              </Link>
              <Link href="/prompt-base">
                <Button 
                  variant="outline" 
                  className="w-full"
                  style={{ 
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.secondary,
                    color: curestryColors.secondary,
                    border: `1px solid ${curestryColors.secondary}`
                  }}
                >
                  <Database className="w-4 h-4 mr-2" />
                  Prompt Base
                </Button>
              </Link>
              <Link href="/">
                <Button 
                  variant="outline" 
                  className="w-full"
                  style={{ 
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.accent,
                    color: curestryColors.accent,
                    border: `1px solid ${curestryColors.accent}`
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Back to App
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}