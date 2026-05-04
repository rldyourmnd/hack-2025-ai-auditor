'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  ShieldAlert, 
  Key, 
  Database, 
  AlertTriangle,
  Eye,
  ChevronRight
} from "lucide-react";
import { useState } from "react";

interface SecurityPanelProps {
  data: Array<{
    type: string;
    count: number;
    files: string[];
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

export function SecurityPanel({ data, colors }: SecurityPanelProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const getSecurityIcon = (type: string) => {
    if (type.toLowerCase().includes('secret') || type.toLowerCase().includes('key')) {
      return <Key className="w-4 h-4" />;
    }
    if (type.toLowerCase().includes('sql') || type.toLowerCase().includes('injection')) {
      return <Database className="w-4 h-4" />;
    }
    if (type.toLowerCase().includes('hash')) {
      return <Shield className="w-4 h-4" />;
    }
    return <ShieldAlert className="w-4 h-4" />;
  };

  const getSeverityLevel = (type: string, count: number) => {
    if (type.toLowerCase().includes('secret') || type.toLowerCase().includes('injection')) {
      return { level: 'critical', color: colors.error };
    }
    if (type.toLowerCase().includes('hash') && count > 5) {
      return { level: 'high', color: colors.warning };
    }
    if (count > 10) {
      return { level: 'medium', color: colors.warning };
    }
    return { level: 'low', color: colors.success };
  };

  const totalSecurityFindings = data.reduce((sum, item) => sum + item.count, 0);
  const criticalFindings = data.filter(item => 
    item.type.toLowerCase().includes('secret') || item.type.toLowerCase().includes('injection')
  ).length;

  const toggleExpanded = (type: string) => {
    setExpandedItem(expandedItem === type ? null : type);
  };

  return (
    <Card style={{ backgroundColor: colors.border, borderColor: colors.border }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: colors.primary }} />
            <CardTitle style={{ color: colors.text }}>Security Findings</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={criticalFindings > 0 ? "destructive" : "secondary"}
              style={{
                backgroundColor: criticalFindings > 0 ? colors.error + '20' : colors.success + '20',
                color: criticalFindings > 0 ? colors.error : colors.success,
                border: `1px solid ${criticalFindings > 0 ? colors.error : colors.success}40`
              }}
            >
              {criticalFindings > 0 ? `${criticalFindings} Critical` : 'All Clear'}
            </Badge>
          </div>
        </div>
        <p className="text-sm" style={{ color: colors.muted }}>
          {totalSecurityFindings} security issues detected across {data.length} categories
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {data.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: colors.success }} />
              <p className="font-medium" style={{ color: colors.success }}>
                No Security Issues Found
              </p>
              <p className="text-sm" style={{ color: colors.muted }}>
                Your codebase looks secure!
              </p>
            </div>
          ) : (
            data.map((item, index) => {
              const severity = getSeverityLevel(item.type, item.count);
              const isExpanded = expandedItem === item.type;
              
              return (
                <div key={item.type} className="group">
                  <div 
                    className="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: colors.background + '40',
                      borderColor: severity.color + '40'
                    }}
                    onClick={() => toggleExpanded(item.type)}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: severity.color + '20' }}
                      >
                        <div style={{ color: severity.color }}>
                          {getSecurityIcon(item.type)}
                        </div>
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: colors.text }}>
                          {item.type}
                        </p>
                        <p className="text-sm" style={{ color: colors.muted }}>
                          {item.count} instance{item.count !== 1 ? 's' : ''} found
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary"
                        style={{
                          backgroundColor: severity.color + '20',
                          color: severity.color,
                          border: `1px solid ${severity.color}40`
                        }}
                      >
                        {item.count}
                      </Badge>
                      <ChevronRight 
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        style={{ color: colors.muted }}
                      />
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div 
                      className="mt-2 p-3 rounded-lg border-l-4"
                      style={{ 
                        backgroundColor: colors.background + '20',
                        borderLeftColor: severity.color
                      }}
                    >
                      <p className="text-sm font-medium mb-2" style={{ color: colors.text }}>
                        Affected Files:
                      </p>
                      <div className="space-y-1">
                        {item.files.slice(0, 5).map((file, fileIndex) => (
                          <div 
                            key={fileIndex}
                            className="flex items-center gap-2 p-2 rounded-md transition-colors hover:opacity-80 cursor-pointer"
                            style={{ backgroundColor: colors.border + '40' }}
                          >
                            <Eye className="w-3 h-3" style={{ color: colors.muted }} />
                            <span className="text-xs font-mono" style={{ color: colors.text }}>
                              {file}
                            </span>
                          </div>
                        ))}
                        {item.files.length > 5 && (
                          <p className="text-xs" style={{ color: colors.muted }}>
                            ... and {item.files.length - 5} more files
                          </p>
                        )}
                      </div>
                      
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          style={{ 
                            borderColor: colors.primary,
                            color: colors.primary
                          }}
                        >
                          View Details
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          style={{ 
                            borderColor: severity.color,
                            color: severity.color
                          }}
                        >
                          Fix Now
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Summary Stats */}
        {data.length > 0 && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs" style={{ color: colors.muted }}>Total Issues</p>
                <p className="text-lg font-bold" style={{ color: colors.text }}>
                  {totalSecurityFindings}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: colors.muted }}>Categories</p>
                <p className="text-lg font-bold" style={{ color: colors.text }}>
                  {data.length}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: colors.muted }}>Critical</p>
                <p className="text-lg font-bold" style={{ color: criticalFindings > 0 ? colors.error : colors.success }}>
                  {criticalFindings}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}