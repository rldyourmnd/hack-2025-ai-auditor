'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { Badge } from "@/components/ui/badge";

interface FindingsBreakdownProps {
  data: Array<{
    category: string;
    count: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
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

export function FindingsBreakdown({ data, colors }: FindingsBreakdownProps) {
  // Define colors for different categories and severities
  const getSeverityColor = (severity: 'low' | 'medium' | 'high' | 'critical') => {
    switch (severity) {
      case 'critical':
        return colors.error;
      case 'high':
        return '#FF6B35'; // Orange-red
      case 'medium':
        return colors.warning;
      case 'low':
        return colors.success;
      default:
        return colors.muted;
    }
  };

  const getCategoryColor = (category: string, index: number) => {
    const categoryColors = [
      colors.primary,
      colors.accent, 
      colors.secondary,
      colors.warning,
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#10B981', // Green
      '#F59E0B'  // Amber
    ];
    return categoryColors[index % categoryColors.length];
  };

  // Prepare data for pie chart
  const pieData = data.map((item, index) => ({
    ...item,
    color: getCategoryColor(item.category, index),
    severityColor: getSeverityColor(item.severity),
    percentage: ((item.count / data.reduce((sum, d) => sum + d.count, 0)) * 100).toFixed(1)
  }));

  const totalFindings = data.reduce((sum, item) => sum + item.count, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div 
          className="p-3 rounded-lg border shadow-lg"
          style={{ 
            backgroundColor: colors.border,
            borderColor: data.color + '40',
            color: colors.text
          }}
        >
          <p className="font-medium">{data.category}</p>
          <p className="text-sm">
            Count: <span className="font-semibold">{data.count}</span>
          </p>
          <p className="text-sm">
            Percentage: <span className="font-semibold">{data.percentage}%</span>
          </p>
          <Badge 
            variant="secondary" 
            className="mt-1"
            style={{ 
              backgroundColor: data.severityColor + '20',
              color: data.severityColor,
              border: `1px solid ${data.severityColor}40`
            }}
          >
            {data.severity.toUpperCase()}
          </Badge>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, category }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return percent > 0.05 ? (
      <text 
        x={x} 
        y={y} 
        fill={colors.text} 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  return (
    <div className="w-full h-80">
      <div className="flex flex-col lg:flex-row h-full">
        {/* Pie Chart */}
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                outerRadius={100}
                innerRadius={40}
                fill="#8884d8"
                dataKey="count"
                paddingAngle={2}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend and Stats */}
        <div className="w-full lg:w-64 p-4 space-y-3">
          <div className="text-center lg:text-left mb-4">
            <p className="text-sm font-medium" style={{ color: colors.muted }}>
              Total Findings
            </p>
            <p className="text-2xl font-bold" style={{ color: colors.text }}>
              {totalFindings.toLocaleString()}
            </p>
          </div>

          <div className="space-y-2">
            {pieData.map((item, index) => (
              <div 
                key={item.category}
                className="flex items-center justify-between p-2 rounded-lg transition-colors hover:opacity-80"
                style={{ backgroundColor: colors.background + '40' }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium" style={{ color: colors.text }}>
                    {item.category}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: colors.text }}>
                    {item.count}
                  </span>
                  <Badge 
                    variant="secondary" 
                    size="sm"
                    style={{ 
                      backgroundColor: item.severityColor + '20',
                      color: item.severityColor,
                      border: `1px solid ${item.severityColor}40`,
                      fontSize: '10px'
                    }}
                  >
                    {item.severity.charAt(0).toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Stats */}
          <div className="pt-2 mt-4 border-t" style={{ borderColor: colors.border }}>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-xs" style={{ color: colors.muted }}>Critical</p>
                <p className="text-sm font-semibold" style={{ color: colors.error }}>
                  {data.filter(d => d.severity === 'critical').reduce((sum, d) => sum + d.count, 0)}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: colors.muted }}>High</p>
                <p className="text-sm font-semibold" style={{ color: '#FF6B35' }}>
                  {data.filter(d => d.severity === 'high').reduce((sum, d) => sum + d.count, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}