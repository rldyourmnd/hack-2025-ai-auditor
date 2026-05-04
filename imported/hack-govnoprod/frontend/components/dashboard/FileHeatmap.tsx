'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle, BarChart3, Eye, Code } from "lucide-react";
import { useState } from "react";

interface FileHeatmapProps {
  data: Array<{
    file: string;
    findings: number;
    complexity: number;
    loc: number;
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

export function FileHeatmap({ data, colors }: FileHeatmapProps) {
  const [sortBy, setSortBy] = useState<'findings' | 'complexity' | 'loc'>('findings');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Sort data based on selected criteria
  const sortedData = [...data].sort((a, b) => {
    return b[sortBy] - a[sortBy];
  });

  // Calculate intensity for heatmap coloring
  const getIntensityColor = (value: number, maxValue: number, type: 'findings' | 'complexity' | 'loc') => {
    const intensity = value / maxValue;
    
    if (type === 'findings') {
      if (intensity >= 0.8) return colors.error;
      if (intensity >= 0.6) return '#FF6B35'; // Orange-red
      if (intensity >= 0.4) return colors.warning;
      if (intensity >= 0.2) return colors.secondary;
      return colors.success;
    } else if (type === 'complexity') {
      if (intensity >= 0.8) return colors.error;
      if (intensity >= 0.6) return colors.warning;
      if (intensity >= 0.4) return colors.accent;
      return colors.primary;
    } else { // loc
      if (intensity >= 0.8) return colors.accent;
      if (intensity >= 0.6) return colors.primary;
      if (intensity >= 0.4) return colors.secondary;
      return colors.muted;
    }
  };

  const maxFindings = Math.max(...data.map(d => d.findings));
  const maxComplexity = Math.max(...data.map(d => d.complexity));
  const maxLOC = Math.max(...data.map(d => d.loc));

  const getMaxValue = (type: 'findings' | 'complexity' | 'loc') => {
    switch (type) {
      case 'findings': return maxFindings;
      case 'complexity': return maxComplexity;
      case 'loc': return maxLOC;
    }
  };

  const getSortIcon = (type: 'findings' | 'complexity' | 'loc') => {
    const isActive = sortBy === type;
    const baseStyle = { 
      color: isActive ? colors.primary : colors.muted,
      transform: isActive ? 'scale(1.1)' : 'scale(1)'
    };
    
    switch (type) {
      case 'findings':
        return <AlertTriangle className="w-4 h-4" style={baseStyle} />;
      case 'complexity':
        return <BarChart3 className="w-4 h-4" style={baseStyle} />;
      case 'loc':
        return <Code className="w-4 h-4" style={baseStyle} />;
    }
  };

  return (
    <Card style={{ backgroundColor: colors.border, borderColor: colors.border }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: colors.primary }} />
            <CardTitle style={{ color: colors.text }}>File Analysis</CardTitle>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: colors.background }}>
            {(['findings', 'complexity', 'loc'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSortBy(type)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  sortBy === type ? 'shadow-sm' : ''
                }`}
                style={{
                  backgroundColor: sortBy === type ? colors.primary + '20' : 'transparent',
                  color: sortBy === type ? colors.primary : colors.muted,
                  border: sortBy === type ? `1px solid ${colors.primary}40` : '1px solid transparent'
                }}
              >
                <div className="flex items-center gap-1">
                  {getSortIcon(type)}
                  {type === 'loc' ? 'LOC' : type.charAt(0).toUpperCase() + type.slice(1)}
                </div>
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm" style={{ color: colors.muted }}>
          Files sorted by {sortBy} (highest first)
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sortedData.map((fileData, index) => {
            const intensity = fileData[sortBy] / getMaxValue(sortBy);
            const bgColor = getIntensityColor(fileData[sortBy], getMaxValue(sortBy), sortBy);
            const isSelected = selectedFile === fileData.file;
            
            return (
              <div
                key={fileData.file}
                className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                  isSelected ? 'ring-2' : ''
                }`}
                style={{
                  backgroundColor: bgColor + (isSelected ? '30' : '15'),
                  borderColor: bgColor + '40',
                  ...(isSelected ? { boxShadow: `0 0 0 2px ${colors.primary}60` } : {})
                }}
                onClick={() => setSelectedFile(isSelected ? null : fileData.file)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 flex-shrink-0" style={{ color: colors.text }} />
                      <p className="font-medium text-sm truncate" style={{ color: colors.text }}>
                        {fileData.file.split('/').pop()}
                      </p>
                      <Badge 
                        variant="secondary"
                        size="sm"
                        style={{
                          backgroundColor: colors.background + '60',
                          color: colors.text,
                          fontSize: '10px'
                        }}
                      >
                        #{index + 1}
                      </Badge>
                    </div>
                    <p className="text-xs truncate" style={{ color: colors.muted }}>
                      {fileData.file}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 ml-3">
                    {/* Metrics */}
                    <div className="text-center">
                      <p className="text-xs" style={{ color: colors.muted }}>Findings</p>
                      <p className="text-sm font-semibold" style={{ 
                        color: sortBy === 'findings' ? colors.text : colors.muted 
                      }}>
                        {fileData.findings}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs" style={{ color: colors.muted }}>Complexity</p>
                      <p className="text-sm font-semibold" style={{ 
                        color: sortBy === 'complexity' ? colors.text : colors.muted 
                      }}>
                        {fileData.complexity.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs" style={{ color: colors.muted }}>LOC</p>
                      <p className="text-sm font-semibold" style={{ 
                        color: sortBy === 'loc' ? colors.text : colors.muted 
                      }}>
                        {fileData.loc}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Intensity Bar */}
                <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: colors.background }}>
                  <div 
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${intensity * 100}%`,
                      backgroundColor: bgColor
                    }}
                  />
                </div>

                {/* Expanded Details */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: colors.background }}>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs" style={{ color: colors.muted }}>Findings Density</p>
                        <p className="text-sm font-semibold" style={{ color: colors.text }}>
                          {(fileData.findings / fileData.loc * 1000).toFixed(1)} per KLOC
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: colors.muted }}>Risk Score</p>
                        <p className="text-sm font-semibold" style={{ color: colors.text }}>
                          {Math.min(100, Math.round((fileData.findings * 2 + fileData.complexity * 5))).toFixed(0)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: colors.muted }}>Priority</p>
                        <Badge 
                          variant="secondary"
                          size="sm"
                          style={{
                            backgroundColor: bgColor + '30',
                            color: bgColor,
                            border: `1px solid ${bgColor}60`
                          }}
                        >
                          {intensity > 0.7 ? 'High' : intensity > 0.4 ? 'Medium' : 'Low'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs" style={{ color: colors.muted }}>Total Files</p>
              <p className="text-lg font-bold" style={{ color: colors.text }}>
                {data.length}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: colors.muted }}>Avg Complexity</p>
              <p className="text-lg font-bold" style={{ color: colors.text }}>
                {(data.reduce((sum, d) => sum + d.complexity, 0) / data.length).toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: colors.muted }}>Total LOC</p>
              <p className="text-lg font-bold" style={{ color: colors.text }}>
                {data.reduce((sum, d) => sum + d.loc, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}