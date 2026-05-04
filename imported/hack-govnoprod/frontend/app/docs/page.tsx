'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Palette,
  Type,
  Square,
  Circle,
  Triangle,
  Star,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Zap,
  Settings,
  Download,
  Upload,
  Copy,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Code,
  FileText,
  Send,
  ArrowRight
} from 'lucide-react';

export default function DocsPage() {
  const [selectedTab, setSelectedTab] = useState('api');

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

  const tabs = [
    { id: 'api', label: 'API Documentation', icon: Code },
    { id: 'colors', label: 'Colors', icon: Palette },
    { id: 'typography', label: 'Typography', icon: Type },
    { id: 'buttons', label: 'Buttons', icon: Square },
    { id: 'components', label: 'Components', icon: Circle },
    { id: 'patterns', label: 'Patterns', icon: Triangle },
    { id: 'examples', label: 'Examples', icon: Star }
  ];

  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: curestryColors.background }}
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="text-5xl font-bold mb-4"
            style={{
              fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
              color: curestryColors.text
            }}
          >
            Curestry UI Elements
          </h1>
          <p
            className="text-xl max-w-3xl mx-auto"
            style={{
              fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
              color: curestryColors.secondary
            }}
          >
            Complete design system and component showcase for Curestry AI platform.
            Dark theme with teal-green accent colors for modern AI interfaces.
          </p>

          {/* Brand Badge */}
          <div className="flex items-center justify-center mt-6">
            <div
              className="px-6 py-3 rounded-lg border-2 flex items-center space-x-3"
              style={{
                backgroundColor: curestryColors.primary + '20',
                borderColor: curestryColors.primary,
                color: curestryColors.primary
              }}
            >
              <Zap className="h-5 w-5" />
              <span className="font-semibold">Curestry Design System v1.0</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Navigation */}
          <div className="lg:col-span-1">
            <div
              className="rounded-lg border p-6 sticky top-6"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <h3
                className="font-bold text-lg mb-4"
                style={{ color: curestryColors.text }}
              >
                Navigation
              </h3>
              <div className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = selectedTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedTab(tab.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center space-x-3 ${
                        isActive ? 'scale-105' : 'hover:scale-102'
                      }`}
                      style={{
                        backgroundColor: isActive ? curestryColors.primary + '20' : 'transparent',
                        borderWidth: isActive ? '2px' : '1px',
                        borderColor: isActive ? curestryColors.primary : curestryColors.border,
                        color: isActive ? curestryColors.primary : curestryColors.secondary
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* API Documentation Section */}
            {selectedTab === 'api' && (
              <div className="space-y-6">
                <div
                  className="rounded-lg border p-6"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border
                  }}
                >
                  <h2
                    className="text-3xl font-bold mb-6"
                    style={{
                      fontFamily: "'Montserrat', system-ui",
                      color: curestryColors.text
                    }}
                  >
                    Curestry API Documentation
                  </h2>
                  <p
                    className="text-lg mb-8"
                    style={{
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui"
                    }}
                  >
                    Complete API reference for integrating Curestry's prompt analysis and improvement capabilities into your applications.
                  </p>

                  {/* Base URL */}
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold mb-3" style={{ color: curestryColors.primary }}>
                      Base URL
                    </h3>
                    <div
                      className="p-4 rounded-lg border font-mono text-sm"
                      style={{
                        backgroundColor: curestryColors.border + '20',
                        borderColor: curestryColors.border,
                        color: curestryColors.text
                      }}
                    >
                      https://api.curestry.com
                    </div>
                  </div>

                  {/* Authentication */}
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold mb-3" style={{ color: curestryColors.primary }}>
                      Authentication
                    </h3>
                    <p className="text-sm mb-3" style={{ color: curestryColors.secondary }}>
                      All API requests require authentication using an API key in the request headers:
                    </p>
                    <div
                      className="p-4 rounded-lg border font-mono text-sm"
                      style={{
                        backgroundColor: curestryColors.border + '20',
                        borderColor: curestryColors.border,
                        color: curestryColors.text
                      }}
                    >
                      Authorization: Bearer YOUR_API_KEY
                    </div>
                  </div>
                </div>

                {/* Main Endpoints */}
                <div className="space-y-6">
                  {/* Analyze Endpoint */}
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      backgroundColor: curestryColors.background,
                      borderColor: curestryColors.border
                    }}
                  >
                    <div className="flex items-center mb-4">
                      <span
                        className="px-3 py-1 rounded text-sm font-semibold mr-3"
                        style={{
                          backgroundColor: curestryColors.primary,
                          color: curestryColors.background
                        }}
                      >
                        POST
                      </span>
                      <code
                        className="text-lg font-mono"
                        style={{ color: curestryColors.text }}
                      >
                        /analyze/
                      </code>
                    </div>
                    <h4
                      className="text-xl font-semibold mb-3"
                      style={{ color: curestryColors.primary }}
                    >
                      Analyze Prompt
                    </h4>
                    <p
                      className="text-sm mb-4"
                      style={{
                        color: curestryColors.secondary,
                        fontFamily: "'Open Sans', system-ui"
                      }}
                    >
                      Analyzes a prompt across multiple dimensions including semantic entropy, contradictions, vocabulary analysis, and LLM-as-judge scoring.
                    </p>

                    {/* Request Example */}
                    <div className="mb-4">
                      <h5 className="font-semibold mb-2" style={{ color: curestryColors.text }}>
                        Request Body:
                      </h5>
                      <div
                        className="p-4 rounded-lg border font-mono text-sm"
                        style={{
                          backgroundColor: curestryColors.border + '20',
                          borderColor: curestryColors.border,
                          color: curestryColors.text
                        }}
                      >
{`{
  "text": "You are a helpful assistant. Help me write a blog post about AI.",
  "metadata": {
    "title": "Blog Writing Prompt",
    "category": "content_generation"
  }
}`}
                      </div>
                    </div>

                    {/* Response Example */}
                    <div>
                      <h5 className="font-semibold mb-2" style={{ color: curestryColors.text }}>
                        Response:
                      </h5>
                      <div
                        className="p-4 rounded-lg border font-mono text-sm max-h-64 overflow-y-auto"
                        style={{
                          backgroundColor: curestryColors.border + '20',
                          borderColor: curestryColors.border,
                          color: curestryColors.text
                        }}
                      >
{`{
  "report": {
    "judge_score": {"score": 7.2, "reasoning": "Clear but lacks specificity"},
    "semantic_entropy": {"entropy": 0.45, "clusters": 3, "spread": 0.62},
    "contradictions": [],
    "detected_language": "en",
    "format_valid": true,
    "translated": false
  },
  "patches": [
    {
      "id": "patch_1",
      "type": "safe",
      "category": "specificity",
      "description": "Add target audience specification",
      "rationale": "Improves clarity and output relevance"
    }
  ],
  "questions": [
    {
      "id": "q1",
      "text": "What is the target audience for this blog post?",
      "category": "context",
      "priority": "important"
    }
  ]
}`}
                      </div>
                    </div>
                  </div>

                  {/* Clarify Endpoint */}
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      backgroundColor: curestryColors.background,
                      borderColor: curestryColors.border
                    }}
                  >
                    <div className="flex items-center mb-4">
                      <span
                        className="px-3 py-1 rounded text-sm font-semibold mr-3"
                        style={{
                          backgroundColor: curestryColors.accent,
                          color: curestryColors.background
                        }}
                      >
                        POST
                      </span>
                      <code
                        className="text-lg font-mono"
                        style={{ color: curestryColors.text }}
                      >
                        /analyze/clarify
                      </code>
                    </div>
                    <h4
                      className="text-xl font-semibold mb-3"
                      style={{ color: curestryColors.accent }}
                    >
                      Process Clarifications
                    </h4>
                    <p
                      className="text-sm mb-4"
                      style={{
                        color: curestryColors.secondary,
                        fontFamily: "'Open Sans', system-ui"
                      }}
                    >
                      Process clarification answers and return updated analysis with refined suggestions.
                    </p>

                    {/* Request Example */}
                    <div>
                      <h5 className="font-semibold mb-2" style={{ color: curestryColors.text }}>
                        Request Body:
                      </h5>
                      <div
                        className="p-4 rounded-lg border font-mono text-sm"
                        style={{
                          backgroundColor: curestryColors.border + '20',
                          borderColor: curestryColors.border,
                          color: curestryColors.text
                        }}
                      >
{`{
  "session_id": "session_123",
  "answers": [
    {
      "question_id": "q1",
      "answer": "Professional developers and tech enthusiasts"
    }
  ]
}`}
                      </div>
                    </div>
                  </div>

                  {/* Export Endpoint */}
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      backgroundColor: curestryColors.background,
                      borderColor: curestryColors.border
                    }}
                  >
                    <div className="flex items-center mb-4">
                      <span
                        className="px-3 py-1 rounded text-sm font-semibold mr-3"
                        style={{
                          backgroundColor: curestryColors.success,
                          color: curestryColors.background
                        }}
                      >
                        GET
                      </span>
                      <code
                        className="text-lg font-mono"
                        style={{ color: curestryColors.text }}
                      >
                        /analyze/export/{"{prompt_id}"}.{"{format}"}
                      </code>
                    </div>
                    <h4
                      className="text-xl font-semibold mb-3"
                      style={{ color: curestryColors.success }}
                    >
                      Export Processed Prompt
                    </h4>
                    <p
                      className="text-sm mb-4"
                      style={{
                        color: curestryColors.secondary,
                        fontFamily: "'Open Sans', system-ui"
                      }}
                    >
                      Export the processed and improved prompt in various formats (md, xml, json).
                    </p>

                    {/* Parameters */}
                    <div>
                      <h5 className="font-semibold mb-2" style={{ color: curestryColors.text }}>
                        Path Parameters:
                      </h5>
                      <div className="space-y-2 text-sm">
                        <div
                          className="p-3 rounded border"
                          style={{ borderColor: curestryColors.border }}
                        >
                          <code style={{ color: curestryColors.primary }}>prompt_id</code>
                          <span style={{ color: curestryColors.secondary }}> (string) - The unique identifier for the analyzed prompt</span>
                        </div>
                        <div
                          className="p-3 rounded border"
                          style={{ borderColor: curestryColors.border }}
                        >
                          <code style={{ color: curestryColors.primary }}>format</code>
                          <span style={{ color: curestryColors.secondary }}> (string) - Export format: </span>
                          <code style={{ color: curestryColors.accent }}>md</code>
                          <span style={{ color: curestryColors.secondary }}>, </span>
                          <code style={{ color: curestryColors.accent }}>xml</code>
                          <span style={{ color: curestryColors.secondary }}>, or </span>
                          <code style={{ color: curestryColors.accent }}>json</code>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Error Handling */}
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      backgroundColor: curestryColors.background,
                      borderColor: curestryColors.border
                    }}
                  >
                    <h4
                      className="text-xl font-semibold mb-4"
                      style={{ color: curestryColors.warning }}
                    >
                      Error Handling
                    </h4>
                    <p
                      className="text-sm mb-4"
                      style={{
                        color: curestryColors.secondary,
                        fontFamily: "'Open Sans', system-ui"
                      }}
                    >
                      All endpoints return standard HTTP status codes and error responses in JSON format.
                    </p>

                    <div className="space-y-4">
                      <div>
                        <h5 className="font-semibold mb-2" style={{ color: curestryColors.text }}>
                          Common Error Responses:
                        </h5>
                        <div className="space-y-3">
                          <div
                            className="p-3 rounded border"
                            style={{
                              borderColor: curestryColors.error,
                              backgroundColor: curestryColors.error + '10'
                            }}
                          >
                            <div className="flex items-center mb-2">
                              <span
                                className="px-2 py-1 rounded text-xs font-semibold mr-2"
                                style={{
                                  backgroundColor: curestryColors.error,
                                  color: curestryColors.background
                                }}
                              >
                                400
                              </span>
                              <span style={{ color: curestryColors.text }}>Bad Request</span>
                            </div>
                            <code
                              className="text-sm"
                              style={{ color: curestryColors.error }}
                            >
                              {`{"detail": "Validation error", "errors": [...]}`}
                            </code>
                          </div>

                          <div
                            className="p-3 rounded border"
                            style={{
                              borderColor: curestryColors.warning,
                              backgroundColor: curestryColors.warning + '10'
                            }}
                          >
                            <div className="flex items-center mb-2">
                              <span
                                className="px-2 py-1 rounded text-xs font-semibold mr-2"
                                style={{
                                  backgroundColor: curestryColors.warning,
                                  color: curestryColors.background
                                }}
                              >
                                401
                              </span>
                              <span style={{ color: curestryColors.text }}>Unauthorized</span>
                            </div>
                            <code
                              className="text-sm"
                              style={{ color: curestryColors.warning }}
                            >
                              {`{"detail": "Invalid or missing API key"}`}
                            </code>
                          </div>

                          <div
                            className="p-3 rounded border"
                            style={{
                              borderColor: curestryColors.info,
                              backgroundColor: curestryColors.info + '10'
                            }}
                          >
                            <div className="flex items-center mb-2">
                              <span
                                className="px-2 py-1 rounded text-xs font-semibold mr-2"
                                style={{
                                  backgroundColor: curestryColors.info,
                                  color: curestryColors.background
                                }}
                              >
                                429
                              </span>
                              <span style={{ color: curestryColors.text }}>Rate Limited</span>
                            </div>
                            <code
                              className="text-sm"
                              style={{ color: curestryColors.info }}
                            >
                              {`{"detail": "Rate limit exceeded", "retry_after": 60}`}
                            </code>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SDK Examples */}
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      backgroundColor: curestryColors.background,
                      borderColor: curestryColors.border
                    }}
                  >
                    <h4
                      className="text-xl font-semibold mb-4"
                      style={{ color: curestryColors.primary }}
                    >
                      SDK & Code Examples
                    </h4>
                    
                    {/* Python Example */}
                    <div className="mb-6">
                      <h5 className="font-semibold mb-3 flex items-center" style={{ color: curestryColors.text }}>
                        <FileText className="mr-2 h-4 w-4" />
                        Python
                      </h5>
                      <div
                        className="p-4 rounded-lg border font-mono text-sm"
                        style={{
                          backgroundColor: curestryColors.border + '20',
                          borderColor: curestryColors.border,
                          color: curestryColors.text
                        }}
                      >
{`import requests

# Analyze a prompt
response = requests.post(
    "https://api.curestry.com/analyze/",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={
        "text": "Your prompt text here",
        "metadata": {"category": "content_generation"}
    }
)

result = response.json()
print(f"Judge Score: {result['report']['judge_score']['score']}")
print(f"Patches: {len(result['patches'])}")`}
                      </div>
                    </div>

                    {/* JavaScript Example */}
                    <div>
                      <h5 className="font-semibold mb-3 flex items-center" style={{ color: curestryColors.text }}>
                        <FileText className="mr-2 h-4 w-4" />
                        JavaScript / Node.js
                      </h5>
                      <div
                        className="p-4 rounded-lg border font-mono text-sm"
                        style={{
                          backgroundColor: curestryColors.border + '20',
                          borderColor: curestryColors.border,
                          color: curestryColors.text
                        }}
                      >
{`const response = await fetch('https://api.curestry.com/analyze/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: 'Your prompt text here',
    metadata: { category: 'content_generation' }
  })
});

const result = await response.json();
console.log(\`Judge Score: \${result.report.judge_score.score}\`);
console.log(\`Patches: \${result.patches.length}\`);`}
                      </div>
                    </div>
                  </div>

                  {/* Rate Limits & Best Practices */}
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      backgroundColor: curestryColors.background,
                      borderColor: curestryColors.border
                    }}
                  >
                    <h4
                      className="text-xl font-semibold mb-4"
                      style={{ color: curestryColors.primary }}
                    >
                      Rate Limits & Best Practices
                    </h4>

                    <div className="space-y-4">
                      <div>
                        <h5 className="font-semibold mb-2" style={{ color: curestryColors.text }}>
                          Rate Limits:
                        </h5>
                        <ul className="space-y-2 text-sm" style={{ color: curestryColors.secondary }}>
                          <li className="flex items-center">
                            <CheckCircle className="mr-2 h-4 w-4" style={{ color: curestryColors.success }} />
                            Solo Plan: 30 requests per month
                          </li>
                          <li className="flex items-center">
                            <CheckCircle className="mr-2 h-4 w-4" style={{ color: curestryColors.success }} />
                            Contributor Plan: Unlimited requests
                          </li>
                          <li className="flex items-center">
                            <CheckCircle className="mr-2 h-4 w-4" style={{ color: curestryColors.success }} />
                            Business Plan: Unlimited + priority processing
                          </li>
                        </ul>
                      </div>

                      <div>
                        <h5 className="font-semibold mb-2" style={{ color: curestryColors.text }}>
                          Best Practices:
                        </h5>
                        <ul className="space-y-2 text-sm" style={{ color: curestryColors.secondary }}>
                          <li className="flex items-start">
                            <ArrowRight className="mr-2 h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: curestryColors.primary }} />
                            Cache analysis results when possible to avoid redundant API calls
                          </li>
                          <li className="flex items-start">
                            <ArrowRight className="mr-2 h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: curestryColors.primary }} />
                            Use batch processing for multiple prompts when available
                          </li>
                          <li className="flex items-start">
                            <ArrowRight className="mr-2 h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: curestryColors.primary }} />
                            Include relevant metadata to improve analysis accuracy
                          </li>
                          <li className="flex items-start">
                            <ArrowRight className="mr-2 h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: curestryColors.primary }} />
                            Handle rate limiting gracefully with exponential backoff
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Colors Section */}
            {selectedTab === 'colors' && (
              <div className="space-y-6">
                <div
                  className="rounded-lg border p-6"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border
                  }}
                >
                  <h2
                    className="text-3xl font-bold mb-6"
                    style={{
                      fontFamily: "'Montserrat', system-ui",
                      color: curestryColors.text
                    }}
                  >
                    Brand Colors
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(curestryColors).map(([name, color]) => (
                      <div
                        key={name}
                        className="rounded-lg p-4 border"
                        style={{ borderColor: curestryColors.border }}
                      >
                        <div
                          className="w-full h-16 rounded-lg mb-3 border-2"
                          style={{
                            backgroundColor: color,
                            borderColor: curestryColors.border
                          }}
                        ></div>
                        <div className="text-sm">
                          <div
                            className="font-semibold capitalize"
                            style={{ color: curestryColors.text }}
                          >
                            {name.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                          <div
                            className="font-mono text-xs mt-1"
                            style={{ color: curestryColors.muted }}
                          >
                            {color}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Typography Section */}
            {selectedTab === 'typography' && (
              <div className="space-y-6">
                <div
                  className="rounded-lg border p-6"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border
                  }}
                >
                  <h2
                    className="text-3xl font-bold mb-6"
                    style={{
                      fontFamily: "'Montserrat', system-ui",
                      color: curestryColors.text
                    }}
                  >
                    Typography Scale
                  </h2>

                  {/* Headings - Montserrat */}
                  <div className="mb-8">
                    <h3
                      className="text-xl font-bold mb-4"
                      style={{ color: curestryColors.primary }}
                    >
                      Headings (Montserrat)
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <h1
                          className="font-bold"
                          style={{
                            fontFamily: "'Montserrat', system-ui",
                            fontSize: '48px',
                            lineHeight: '58px',
                            letterSpacing: '-0.3px',
                            color: curestryColors.text
                          }}
                        >
                          H1 Heading - 48px Bold
                        </h1>
                        <p className="text-xs mt-1" style={{ color: curestryColors.muted }}>
                          Montserrat Bold, 48px, line-height 58px
                        </p>
                      </div>

                      <div>
                        <h2
                          className="font-bold"
                          style={{
                            fontFamily: "'Montserrat', system-ui",
                            fontSize: '40px',
                            lineHeight: '48px',
                            letterSpacing: '-0.3px',
                            color: curestryColors.text
                          }}
                        >
                          H2 Heading - 40px Bold
                        </h2>
                      </div>

                      <div>
                        <h3
                          className="font-bold"
                          style={{
                            fontFamily: "'Montserrat', system-ui",
                            fontSize: '32px',
                            lineHeight: '40px',
                            letterSpacing: '-0.3px',
                            color: curestryColors.text
                          }}
                        >
                          H3 Heading - 32px Bold
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Body Text - Open Sans */}
                  <div>
                    <h3
                      className="text-xl font-bold mb-4"
                      style={{ color: curestryColors.primary }}
                    >
                      Body Text (Open Sans)
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <p
                          style={{
                            fontFamily: "'Open Sans', system-ui",
                            fontSize: '20px',
                            lineHeight: '24px',
                            letterSpacing: '-0.3px',
                            fontWeight: 700,
                            color: curestryColors.text
                          }}
                        >
                          Text L Bold - 20px Bold
                        </p>
                      </div>

                      <div>
                        <p
                          style={{
                            fontFamily: "'Open Sans', system-ui",
                            fontSize: '16px',
                            lineHeight: '22px',
                            fontWeight: 500,
                            color: curestryColors.secondary
                          }}
                        >
                          Text M - 16px Medium (Body text for UI and content)
                        </p>
                      </div>

                      <div>
                        <p
                          style={{
                            fontFamily: "'Open Sans', system-ui",
                            fontSize: '14px',
                            lineHeight: '20px',
                            fontWeight: 500,
                            color: curestryColors.muted
                          }}
                        >
                          Text S - 14px Medium (Secondary information and labels)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons Section */}
            {selectedTab === 'buttons' && (
              <div className="space-y-6">
                <div
                  className="rounded-lg border p-6"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border
                  }}
                >
                  <h2
                    className="text-3xl font-bold mb-6"
                    style={{
                      fontFamily: "'Montserrat', system-ui",
                      color: curestryColors.text
                    }}
                  >
                    Button Variants
                  </h2>

                  <div className="space-y-8">
                    {/* Primary Buttons */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4" style={{ color: curestryColors.primary }}>
                        Primary Buttons
                      </h3>
                      <div className="flex flex-wrap gap-4">
                        <button
                          className="px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
                          style={{
                            backgroundColor: curestryColors.primary,
                            color: curestryColors.background,
                            border: 'none'
                          }}
                        >
                          Check
                        </button>
                        <button
                          className="px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
                          style={{
                            backgroundColor: curestryColors.success,
                            color: curestryColors.text,
                            border: 'none'
                          }}
                        >
                          Apply All
                        </button>
                        <button
                          className="px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
                          style={{
                            backgroundColor: curestryColors.accent,
                            color: curestryColors.background,
                            border: 'none'
                          }}
                        >
                          Run Tests
                        </button>
                      </div>
                    </div>

                    {/* Secondary Buttons */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4" style={{ color: curestryColors.primary }}>
                        Secondary Buttons
                      </h3>
                      <div className="flex flex-wrap gap-4">
                        <button
                          className="px-6 py-3 rounded-lg font-semibold border-2 transition-all hover:scale-105"
                          style={{
                            backgroundColor: 'transparent',
                            color: curestryColors.primary,
                            borderColor: curestryColors.primary
                          }}
                        >
                          Compare Versions
                        </button>
                        <button
                          className="px-6 py-3 rounded-lg font-semibold border-2 transition-all hover:scale-105"
                          style={{
                            backgroundColor: 'transparent',
                            color: curestryColors.secondary,
                            borderColor: curestryColors.border
                          }}
                        >
                          Show Details
                        </button>
                      </div>
                    </div>

                    {/* Danger Buttons */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4" style={{ color: curestryColors.primary }}>
                        Danger Buttons
                      </h3>
                      <div className="flex flex-wrap gap-4">
                        <button
                          className="px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
                          style={{
                            backgroundColor: curestryColors.error,
                            color: curestryColors.text,
                            border: 'none'
                          }}
                        >
                          Revert
                        </button>
                        <button
                          className="px-6 py-3 rounded-lg font-semibold border-2 transition-all hover:scale-105"
                          style={{
                            backgroundColor: 'transparent',
                            color: curestryColors.error,
                            borderColor: curestryColors.error
                          }}
                        >
                          Delete Fix
                        </button>
                      </div>
                    </div>

                    {/* Button Sizes */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4" style={{ color: curestryColors.primary }}>
                        Button Sizes
                      </h3>
                      <div className="flex items-center gap-4">
                        <button
                          className="px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105"
                          style={{
                            backgroundColor: curestryColors.primary,
                            color: curestryColors.background,
                            height: '28px'
                          }}
                        >
                          Small
                        </button>
                        <button
                          className="px-6 py-2 rounded-lg font-semibold transition-all hover:scale-105"
                          style={{
                            backgroundColor: curestryColors.primary,
                            color: curestryColors.background,
                            height: '36px'
                          }}
                        >
                          Medium
                        </button>
                        <button
                          className="px-8 py-3 rounded-lg font-semibold text-lg transition-all hover:scale-105"
                          style={{
                            backgroundColor: curestryColors.primary,
                            color: curestryColors.background,
                            height: '44px'
                          }}
                        >
                          Large
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Components Section */}
            {selectedTab === 'components' && (
              <div className="space-y-6">
                {/* Badges */}
                <div
                  className="rounded-lg border p-6"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border
                  }}
                >
                  <h3 className="text-xl font-semibold mb-4" style={{ color: curestryColors.primary }}>
                    Tags & Badges
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    <span
                      className="px-3 py-1 rounded-lg text-sm font-semibold"
                      style={{
                        backgroundColor: curestryColors.error + '40',
                        color: curestryColors.error,
                        border: `1px solid ${curestryColors.error}`
                      }}
                    >
                      🏷️ Risk: High
                    </span>
                    <span
                      className="px-3 py-1 rounded-lg text-sm font-semibold"
                      style={{
                        backgroundColor: curestryColors.warning + '40',
                        color: curestryColors.warning,
                        border: `1px solid ${curestryColors.warning}`
                      }}
                    >
                      ⚠️ Risk: Medium
                    </span>
                    <span
                      className="px-3 py-1 rounded-lg text-sm font-semibold"
                      style={{
                        backgroundColor: curestryColors.success + '40',
                        color: curestryColors.success,
                        border: `1px solid ${curestryColors.success}`
                      }}
                    >
                      ✅ Accepted
                    </span>
                    <span
                      className="px-3 py-1 rounded-lg text-sm font-semibold"
                      style={{
                        backgroundColor: curestryColors.accent + '40',
                        color: curestryColors.accent,
                        border: `1px solid ${curestryColors.accent}`
                      }}
                    >
                      ❓ More data needed
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div
                  className="rounded-lg border p-6"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border
                  }}
                >
                  <h3 className="text-xl font-semibold mb-4" style={{ color: curestryColors.primary }}>
                    Cards & Panels
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      className="p-4 rounded-lg border"
                      style={{
                        backgroundColor: curestryColors.background,
                        borderColor: curestryColors.border
                      }}
                    >
                      <h4 className="font-semibold mb-2" style={{ color: curestryColors.text }}>
                        Analysis Details
                      </h4>
                      <p className="text-sm" style={{ color: curestryColors.secondary }}>
                        Check complete. 3 improvements found.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          className="px-3 py-1 text-xs rounded"
                          style={{
                            backgroundColor: curestryColors.primary,
                            color: curestryColors.background
                          }}
                        >
                          Apply
                        </button>
                        <button
                          className="px-3 py-1 text-xs rounded border"
                          style={{
                            color: curestryColors.secondary,
                            borderColor: curestryColors.border
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    <div
                      className="p-4 rounded-lg border-2"
                      style={{
                        backgroundColor: curestryColors.primary + '10',
                        borderColor: curestryColors.primary
                      }}
                    >
                      <h4 className="font-semibold mb-2" style={{ color: curestryColors.primary }}>
                        Highlighted Card
                      </h4>
                      <p className="text-sm" style={{ color: curestryColors.secondary }}>
                        Important information or featured content.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form Elements */}
                <div
                  className="rounded-lg border p-6"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border
                  }}
                >
                  <h3 className="text-xl font-semibold mb-4" style={{ color: curestryColors.primary }}>
                    Form Elements
                  </h3>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: curestryColors.text }}>
                        Text Input
                      </label>
                      <input
                        type="text"
                        placeholder="Describe the agent goal…"
                        className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-opacity-50"
                        style={{
                          backgroundColor: curestryColors.background,
                          borderColor: curestryColors.border,
                          color: curestryColors.text
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: curestryColors.text }}>
                        Textarea
                      </label>
                      <textarea
                        placeholder="Add a fact source (URL)…"
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border resize-none focus:ring-2 focus:ring-opacity-50"
                        style={{
                          backgroundColor: curestryColors.background,
                          borderColor: curestryColors.border,
                          color: curestryColors.text
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: curestryColors.text }}>
                        Select Dropdown
                      </label>
                      <select
                        className="w-full px-3 py-2 rounded-lg border"
                        style={{
                          backgroundColor: curestryColors.background,
                          borderColor: curestryColors.border,
                          color: curestryColors.text
                        }}
                      >
                        <option>Choose an option...</option>
                        <option>Option 1</option>
                        <option>Option 2</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Patterns Section */}
            {selectedTab === 'patterns' && (
              <div className="space-y-6">
                <div
                  className="rounded-lg border p-6"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border
                  }}
                >
                  <h2
                    className="text-3xl font-bold mb-6"
                    style={{
                      fontFamily: "'Montserrat', system-ui",
                      color: curestryColors.text
                    }}
                  >
                    Common Patterns
                  </h2>

                  {/* Progress Bar */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-3" style={{ color: curestryColors.primary }}>
                      Progress Bar
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span style={{ color: curestryColors.text }}>Analysis Progress</span>
                          <span style={{ color: curestryColors.muted }}>Step 3/5: simulation (12 scenarios)</span>
                        </div>
                        <div
                          className="w-full rounded-full h-3"
                          style={{ backgroundColor: curestryColors.border }}
                        >
                          <div
                            className="h-3 rounded-full transition-all duration-500"
                            style={{
                              backgroundColor: curestryColors.primary,
                              width: '60%'
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Indicators */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-3" style={{ color: curestryColors.primary }}>
                      Status Indicators
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-3 rounded-lg border" style={{ borderColor: curestryColors.border }}>
                        <CheckCircle className="h-5 w-5" style={{ color: curestryColors.success }} />
                        <div className="flex-grow">
                          <div className="font-medium" style={{ color: curestryColors.text }}>Test Passed</div>
                          <div className="text-sm" style={{ color: curestryColors.muted }}>All scenarios completed successfully</div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 p-3 rounded-lg border" style={{ borderColor: curestryColors.border }}>
                        <AlertTriangle className="h-5 w-5" style={{ color: curestryColors.warning }} />
                        <div className="flex-grow">
                          <div className="font-medium" style={{ color: curestryColors.text }}>Warning</div>
                          <div className="text-sm" style={{ color: curestryColors.muted }}>Semantic entropy above threshold in 3 scenarios</div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 p-3 rounded-lg border" style={{ borderColor: curestryColors.border }}>
                        <XCircle className="h-5 w-5" style={{ color: curestryColors.error }} />
                        <div className="flex-grow">
                          <div className="font-medium" style={{ color: curestryColors.text }}>Error</div>
                          <div className="text-sm" style={{ color: curestryColors.muted }}>Conflict detected between system and user prompt</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3" style={{ color: curestryColors.primary }}>
                      Action Bar
                    </h3>
                    <div
                      className="flex items-center justify-between p-4 rounded-lg border"
                      style={{
                        backgroundColor: curestryColors.background,
                        borderColor: curestryColors.border
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <button
                          className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium"
                          style={{
                            backgroundColor: curestryColors.primary,
                            color: curestryColors.background
                          }}
                        >
                          <Zap className="h-4 w-4" />
                          <span>Check</span>
                        </button>
                        <button
                          className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium border"
                          style={{
                            color: curestryColors.secondary,
                            borderColor: curestryColors.border
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          <span>Compare versions</span>
                        </button>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          className="p-2 rounded-lg border"
                          style={{
                            color: curestryColors.secondary,
                            borderColor: curestryColors.border
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 rounded-lg border"
                          style={{
                            color: curestryColors.secondary,
                            borderColor: curestryColors.border
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Examples Section */}
            {selectedTab === 'examples' && (
              <div className="space-y-6">
                <div
                  className="rounded-lg border p-6"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border
                  }}
                >
                  <h2
                    className="text-3xl font-bold mb-6"
                    style={{
                      fontFamily: "'Montserrat', system-ui",
                      color: curestryColors.text
                    }}
                  >
                    Real Examples
                  </h2>

                  {/* Suggestion Card */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-3" style={{ color: curestryColors.primary }}>
                      Suggestion Card
                    </h3>
                    <div
                      className="p-4 rounded-lg border"
                      style={{
                        backgroundColor: curestryColors.background,
                        borderColor: curestryColors.border
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <input type="checkbox" />
                          <div>
                            <h4 className="font-medium" style={{ color: curestryColors.text }}>
                              [ID]: PROMPT-12
                            </h4>
                            <p className="text-sm" style={{ color: curestryColors.secondary }}>
                              Reason: Ambiguity in phrase "describe in detail".
                            </p>
                            <p className="text-sm" style={{ color: curestryColors.muted }}>
                              Solution: Specify length and answer format.
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <span
                            className="px-2 py-1 text-xs rounded"
                            style={{
                              backgroundColor: curestryColors.warning + '40',
                              color: curestryColors.warning
                            }}
                          >
                            Medium Risk
                          </span>
                          <span
                            className="px-2 py-1 text-xs rounded"
                            style={{
                              backgroundColor: curestryColors.info + '40',
                              color: curestryColors.info
                            }}
                          >
                            Context
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          className="px-3 py-1 text-sm rounded"
                          style={{
                            backgroundColor: curestryColors.success,
                            color: curestryColors.text
                          }}
                        >
                          Fix
                        </button>
                        <button
                          className="px-3 py-1 text-sm rounded border"
                          style={{
                            color: curestryColors.secondary,
                            borderColor: curestryColors.border
                          }}
                        >
                          Add constraint
                        </button>
                        <button
                          className="px-3 py-1 text-sm rounded border"
                          style={{
                            color: curestryColors.muted,
                            borderColor: curestryColors.border
                          }}
                        >
                          Ignore
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Notification Examples */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3" style={{ color: curestryColors.primary }}>
                      Notifications
                    </h3>
                    <div className="space-y-3">
                      <div
                        className="p-4 rounded-lg border-l-4"
                        style={{
                          backgroundColor: curestryColors.success + '20',
                          borderLeftColor: curestryColors.success,
                          borderWidth: '0 0 0 4px'
                        }}
                      >
                        <div className="font-medium" style={{ color: curestryColors.success }}>Success</div>
                        <div className="text-sm" style={{ color: curestryColors.text }}>
                          Check complete. 3 improvements found
                        </div>
                      </div>

                      <div
                        className="p-4 rounded-lg border-l-4"
                        style={{
                          backgroundColor: curestryColors.warning + '20',
                          borderLeftColor: curestryColors.warning,
                          borderWidth: '0 0 0 4px'
                        }}
                      >
                        <div className="font-medium" style={{ color: curestryColors.warning }}>Warning</div>
                        <div className="text-sm" style={{ color: curestryColors.text }}>
                          Not enough context. Please specify answer style
                        </div>
                      </div>

                      <div
                        className="p-4 rounded-lg border-l-4"
                        style={{
                          backgroundColor: curestryColors.error + '20',
                          borderLeftColor: curestryColors.error,
                          borderWidth: '0 0 0 4px'
                        }}
                      >
                        <div className="font-medium" style={{ color: curestryColors.error }}>Error</div>
                        <div className="text-sm" style={{ color: curestryColors.text }}>
                          Simulation failed. Try again
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
