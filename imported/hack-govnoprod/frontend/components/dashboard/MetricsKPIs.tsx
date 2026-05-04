'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3
} from "lucide-react";
import { formatDistanceToNow } from 'date-fns';

interface MetricsKPIsProps {
  data: {
    currentCCI: number;
    cciTrend: 'up' | 'down' | 'stable';
    totalFindings: number;
    criticalFindings: number;
    lastScanTime: string;
  };
  colors: {
    text: string;
    background: string;
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    border: string;
    muted: string;
  };
}

export function MetricsKPIs({ data, colors }: MetricsKPIsProps) {
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4" style={{ color: colors.success }} />;
      case 'down':
        return <TrendingDown className="w-4 h-4" style={{ color: colors.error }} />;
      case 'stable':
        return <Minus className="w-4 h-4" style={{ color: colors.muted }} />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return colors.success;
      case 'down':
        return colors.error;
      case 'stable':
        return colors.muted;
    }
  };

  const getCCIStatus = (cci: number) => {
    if (cci >= 90) return { label: 'Excellent', color: colors.success };
    if (cci >= 75) return { label: 'Good', color: colors.primary };
    if (cci >= 60) return { label: 'Fair', color: colors.warning };
    return { label: 'Needs Attention', color: colors.error };
  };

  const cciStatus = getCCIStatus(data.currentCCI);
  const lastScanFormatted = formatDistanceToNow(new Date(data.lastScanTime), { addSuffix: true });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* CCI Score */}
      <Card style={{ backgroundColor: colors.border, borderColor: colors.border }}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: colors.muted }}>
                CCI Score
              </p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-3xl font-bold" style={{ color: colors.text }}>
                  {data.currentCCI.toFixed(1)}
                </p>
                {getTrendIcon(data.cciTrend)}
              </div>
              <Badge 
                variant="secondary" 
                className="mt-2"
                style={{ 
                  backgroundColor: cciStatus.color + '20',
                  color: cciStatus.color,
                  border: `1px solid ${cciStatus.color}40`
                }}
              >
                {cciStatus.label}
              </Badge>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: colors.primary + '20' }}>
              <BarChart3 className="w-6 h-6" style={{ color: colors.primary }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Findings */}
      <Card style={{ backgroundColor: colors.border, borderColor: colors.border }}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: colors.muted }}>
                Total Findings
              </p>
              <p className="text-3xl font-bold mt-2" style={{ color: colors.text }}>
                {data.totalFindings.toLocaleString()}
              </p>
              <p className="text-sm mt-2" style={{ color: colors.muted }}>
                Across all categories
              </p>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: colors.accent + '20' }}>
              <AlertTriangle className="w-6 h-6" style={{ color: colors.accent }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Findings */}
      <Card style={{ backgroundColor: colors.border, borderColor: colors.border }}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: colors.muted }}>
                Critical Issues
              </p>
              <p className="text-3xl font-bold mt-2" style={{ 
                color: data.criticalFindings > 0 ? colors.error : colors.success 
              }}>
                {data.criticalFindings}
              </p>
              <Badge 
                variant={data.criticalFindings > 0 ? "destructive" : "secondary"}
                className="mt-2"
                style={{ 
                  backgroundColor: data.criticalFindings > 0 ? colors.error + '20' : colors.success + '20',
                  color: data.criticalFindings > 0 ? colors.error : colors.success,
                  border: `1px solid ${data.criticalFindings > 0 ? colors.error : colors.success}40`
                }}
              >
                {data.criticalFindings > 0 ? 'Action Required' : 'All Clear'}
              </Badge>
            </div>
            <div className="p-3 rounded-lg" style={{ 
              backgroundColor: (data.criticalFindings > 0 ? colors.error : colors.success) + '20' 
            }}>
              {data.criticalFindings > 0 ? (
                <AlertTriangle className="w-6 h-6" style={{ color: colors.error }} />
              ) : (
                <CheckCircle className="w-6 h-6" style={{ color: colors.success }} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Scan */}
      <Card style={{ backgroundColor: colors.border, borderColor: colors.border }}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: colors.muted }}>
                Last Scan
              </p>
              <p className="text-lg font-semibold mt-2" style={{ color: colors.text }}>
                {lastScanFormatted}
              </p>
              <p className="text-sm mt-2" style={{ color: colors.muted }}>
                {new Date(data.lastScanTime).toLocaleDateString()} {new Date(data.lastScanTime).toLocaleTimeString()}
              </p>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: colors.secondary + '20' }}>
              <Clock className="w-6 h-6" style={{ color: colors.secondary }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}