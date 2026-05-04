'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface CCITrendChartProps {
  data: Array<{
    timestamp: string;
    cci: number;
    cdx: number;
    kiloc: number;
    findings: number;
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

export function CCITrendChart({ data, colors }: CCITrendChartProps) {
  // Format data for chart
  const chartData = data.map(item => ({
    ...item,
    date: format(parseISO(item.timestamp), 'MMM dd'),
    fullDate: format(parseISO(item.timestamp), 'MMM dd, yyyy'),
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div 
          className="p-4 rounded-lg border shadow-lg"
          style={{ 
            backgroundColor: colors.border,
            borderColor: colors.primary + '40',
            color: colors.text
          }}
        >
          <p className="font-medium mb-2">{data.fullDate}</p>
          <div className="space-y-1">
            <p style={{ color: colors.primary }}>
              CCI Score: <span className="font-semibold">{data.cci.toFixed(1)}</span>
            </p>
            <p style={{ color: colors.accent }}>
              CDX Score: <span className="font-semibold">{data.cdx.toFixed(1)}</span>
            </p>
            <p style={{ color: colors.secondary }}>
              KLOC: <span className="font-semibold">{data.kiloc.toFixed(1)}</span>
            </p>
            <p style={{ color: colors.warning }}>
              Findings: <span className="font-semibold">{data.findings}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="cciGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={colors.primary} stopOpacity={0.05}/>
            </linearGradient>
            <linearGradient id="cdxGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.accent} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={colors.accent} stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={colors.border}
            opacity={0.3}
          />
          
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: colors.muted, fontSize: 12 }}
          />
          
          <YAxis 
            yAxisId="cci"
            orientation="left"
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: colors.muted, fontSize: 12 }}
            label={{ 
              value: 'CCI/CDX Score', 
              angle: -90, 
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: colors.muted }
            }}
          />
          
          <YAxis 
            yAxisId="secondary"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: colors.muted, fontSize: 12 }}
            label={{ 
              value: 'KLOC/Findings', 
              angle: 90, 
              position: 'insideRight',
              style: { textAnchor: 'middle', fill: colors.muted }
            }}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          <Legend 
            wrapperStyle={{ color: colors.text }}
            iconType="line"
          />
          
          {/* CCI Score - Primary metric */}
          <Area
            yAxisId="cci"
            type="monotone"
            dataKey="cci"
            stroke={colors.primary}
            strokeWidth={3}
            fill="url(#cciGradient)"
            name="CCI Score"
          />
          
          {/* CDX Score */}
          <Line
            yAxisId="cci"
            type="monotone"
            dataKey="cdx"
            stroke={colors.accent}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: colors.accent, strokeWidth: 2, r: 4 }}
            name="CDX Score"
          />
          
          {/* KLOC - Secondary axis */}
          <Line
            yAxisId="secondary"
            type="monotone"
            dataKey="kiloc"
            stroke={colors.secondary}
            strokeWidth={2}
            dot={{ fill: colors.secondary, strokeWidth: 2, r: 3 }}
            name="KLOC"
            opacity={0.7}
          />
          
          {/* Findings count */}
          <Line
            yAxisId="secondary"
            type="monotone"
            dataKey="findings"
            stroke={colors.warning}
            strokeWidth={2}
            dot={{ fill: colors.warning, strokeWidth: 2, r: 3 }}
            name="Total Findings"
            opacity={0.7}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}