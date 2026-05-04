'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  RefreshCw,
  Calendar,
  Filter,
  Download
} from "lucide-react";
import { CCITrendChart } from '@/components/dashboard/CCITrendChart';
import { FindingsBreakdown } from '@/components/dashboard/FindingsBreakdown';
import { SecurityPanel } from '@/components/dashboard/SecurityPanel';
import { FileHeatmap } from '@/components/dashboard/FileHeatmap';
import { MetricsKPIs } from '@/components/dashboard/MetricsKPIs';

// Types for our dashboard data
interface DashboardData {
  kpis: {
    currentCCI: number;
    cciTrend: 'up' | 'down' | 'stable';
    totalFindings: number;
    criticalFindings: number;
    lastScanTime: string;
  };
  timeSeriesData: Array<{
    timestamp: string;
    cci: number;
    cdx: number;
    kiloc: number;
    findings: number;
  }>;
  findingsBreakdown: Array<{
    category: string;
    count: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  securityFindings: Array<{
    type: string;
    count: number;
    files: string[];
  }>;
  fileMetrics: Array<{
    file: string;
    findings: number;
    complexity: number;
    loc: number;
  }>;
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Curestry brand colors
  const curestryColors = {
    text: '#ffffff',
    background: '#000000',
    primary: '#2AC8AA',
    secondary: '#b9d1cc', 
    accent: '#27c7fb',
    info: '#3F51B5',
    success: '#43A047',
    warning: '#FFC107',
    error: '#EF4444',
    border: '#333333',
    muted: '#888888'
  };

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard?range=${timeRange}`);
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Load mock data for development
      setDashboardData(getMockData());
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh data every 30 seconds if enabled
  useEffect(() => {
    loadDashboardData();
    
    if (autoRefresh) {
      const interval = setInterval(loadDashboardData, 30000);
      return () => clearInterval(interval);
    }
  }, [timeRange, autoRefresh]);

  const handleRefresh = () => {
    loadDashboardData();
  };

  const handleExport = () => {
    // TODO: Implement dashboard export functionality
    console.log('Export dashboard data');
  };

  // Mock data generator for development
  const getMockData = (): DashboardData => {
    const now = new Date();
    const timeSeriesData = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      timeSeriesData.push({
        timestamp: date.toISOString(),
        cci: 85 + Math.random() * 15,
        cdx: 7 + Math.random() * 3,
        kiloc: 150 + Math.random() * 50,
        findings: 50 + Math.floor(Math.random() * 100)
      });
    }

    return {
      kpis: {
        currentCCI: 92.4,
        cciTrend: 'up',
        totalFindings: 1530,
        criticalFindings: 12,
        lastScanTime: new Date().toISOString()
      },
      timeSeriesData,
      findingsBreakdown: [
        { category: 'Security', count: 45, severity: 'critical' },
        { category: 'Code Quality', count: 234, severity: 'medium' },
        { category: 'Architecture', count: 89, severity: 'high' },
        { category: 'Performance', count: 156, severity: 'medium' },
        { category: 'Documentation', count: 67, severity: 'low' }
      ],
      securityFindings: [
        { type: 'Hardcoded Secrets', count: 8, files: ['config.py', 'auth.py'] },
        { type: 'SQL Injection Risk', count: 3, files: ['queries.py'] },
        { type: 'Weak Hashing', count: 2, files: ['crypto.py'] }
      ],
      fileMetrics: [
        { file: 'backend/app/main.py', findings: 23, complexity: 8.5, loc: 450 },
        { file: 'backend/app/models.py', findings: 31, complexity: 6.2, loc: 680 },
        { file: 'backend/app/api/routes.py', findings: 18, complexity: 7.8, loc: 320 }
      ]
    };
  };

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: curestryColors.background }}
      >
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4" size={48} style={{ color: curestryColors.primary }} />
          <p style={{ color: curestryColors.text }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: curestryColors.background }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: curestryColors.border }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: curestryColors.text }}>
                Code Quality Dashboard
              </h1>
              <p className="text-sm mt-1" style={{ color: curestryColors.muted }}>
                Real-time insights into your codebase health
              </p>
            </div>
            
            <div className="flex gap-3">
              {/* Time Range Selector */}
              <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: curestryColors.border }}>
                {(['7d', '30d', '90d'] as const).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                    style={{
                      backgroundColor: timeRange === range ? curestryColors.primary : 'transparent',
                      color: timeRange === range ? '#000' : curestryColors.text
                    }}
                  >
                    {range}
                  </Button>
                ))}
              </div>

              {/* Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{ 
                  borderColor: curestryColors.border,
                  color: autoRefresh ? curestryColors.primary : curestryColors.muted
                }}
              >
                <Activity className="w-4 h-4 mr-2" />
                Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                style={{ borderColor: curestryColors.border, color: curestryColors.text }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                style={{ borderColor: curestryColors.border, color: curestryColors.text }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {dashboardData && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <MetricsKPIs data={dashboardData.kpis} colors={curestryColors} />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CCI Trend Chart */}
              <Card style={{ backgroundColor: curestryColors.border, borderColor: curestryColors.border }}>
                <CardHeader>
                  <CardTitle style={{ color: curestryColors.text }}>Quality Trends</CardTitle>
                  <CardDescription style={{ color: curestryColors.muted }}>
                    CCI, CDX, and KLOC trends over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CCITrendChart 
                    data={dashboardData.timeSeriesData} 
                    colors={curestryColors}
                  />
                </CardContent>
              </Card>

              {/* Findings Breakdown */}
              <Card style={{ backgroundColor: curestryColors.border, borderColor: curestryColors.border }}>
                <CardHeader>
                  <CardTitle style={{ color: curestryColors.text }}>Findings Breakdown</CardTitle>
                  <CardDescription style={{ color: curestryColors.muted }}>
                    Distribution of findings by category
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FindingsBreakdown 
                    data={dashboardData.findingsBreakdown} 
                    colors={curestryColors}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Security & Architecture Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Security Panel */}
              <SecurityPanel 
                data={dashboardData.securityFindings} 
                colors={curestryColors}
              />

              {/* File Heatmap */}
              <FileHeatmap 
                data={dashboardData.fileMetrics} 
                colors={curestryColors}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}