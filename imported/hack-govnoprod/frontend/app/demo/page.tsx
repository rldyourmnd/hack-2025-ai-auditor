'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Globe,
  FileText,
  Shuffle,
  Search,
  Zap,
  Target,
  Lightbulb,
  MessageSquare,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';

interface PipelineStep {
  id: number;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
  details?: string;
}

interface DemoExample {
  id: string;
  title: string;
  category: string;
  description: string;
  prompt: string;
  color: string;
}

const DEMO_EXAMPLES: DemoExample[] = [
  {
    id: 'coding',
    title: 'Code Analysis Assistant',
    category: 'Software Development',
    description: 'AI assistant for JavaScript code review and improvement',
    color: 'blue',
    prompt: `You are a helpful assistant that helps users write better code. Please analyze the following JavaScript function and suggest improvements:

function calculateTotal(items) {
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}`
  },
  {
    id: 'customer-support',
    title: 'Служба Поддержки',
    category: 'Бизнес и Поддержка',
    description: 'AI ассистент для обработки запросов клиентов на русском языке',
    color: 'green',
    prompt: `Ты помощник службы поддержки. Помоги пользователям с их вопросами о нашем продукте. Будь дружелюбным и профессиональным.

Вопрос клиента: Не могу войти в свой аккаунт, пытался сбросить пароль несколько раз. Письма для восстановления не приходят. Это очень срочно, мне нужны данные для презентации завтра. Что делать?`
  },
  {
    id: 'content-writing',
    title: 'Article Writing Assistant',
    category: 'Content & Marketing',
    description: 'AI assistant for creating engaging blog posts and articles',
    color: 'purple',
    prompt: `Please write a blog post about artificial intelligence in healthcare. Make it engaging and informative. The target audience is healthcare professionals who are not very technical.

Topic: "How AI is transforming patient care"
Length: around 800 words
Tone: professional but accessible
Include examples and benefits`
  }
];

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 1,
    name: 'Language Detection',
    description: 'Detecting input language and checking translation needs',
    icon: <Globe className="h-5 w-5" />,
    status: 'pending'
  },
  {
    id: 2,
    name: 'Format Validation',
    description: 'Validating markup structure and fixing syntax issues',
    icon: <FileText className="h-5 w-5" />,
    status: 'pending'
  },
  {
    id: 3,
    name: 'Vocabulary Analysis',
    description: 'Unifying terminology and checking consistency',
    icon: <Shuffle className="h-5 w-5" />,
    status: 'pending'
  },
  {
    id: 4,
    name: 'Contradiction Detection',
    description: 'Finding logical conflicts and inconsistencies',
    icon: <Search className="h-5 w-5" />,
    status: 'pending'
  },
  {
    id: 5,
    name: 'Semantic Entropy',
    description: 'Analyzing meaning consistency across samples',
    icon: <Zap className="h-5 w-5" />,
    status: 'pending'
  },
  {
    id: 6,
    name: 'LLM Judge Scoring',
    description: 'Evaluating prompt quality with rubric-based assessment',
    icon: <Target className="h-5 w-5" />,
    status: 'pending'
  },
  {
    id: 7,
    name: 'Patch Generation',
    description: 'Creating improvement suggestions and categorizing safety',
    icon: <Lightbulb className="h-5 w-5" />,
    status: 'pending'
  },
  {
    id: 8,
    name: 'Clarification Questions',
    description: 'Generating questions for interactive refinement',
    icon: <MessageSquare className="h-5 w-5" />,
    status: 'pending'
  }
];

export default function DemoPage() {
  const [selectedExample, setSelectedExample] = useState<DemoExample>(DEMO_EXAMPLES[0]);
  const [steps, setSteps] = useState<PipelineStep[]>(PIPELINE_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [analysisData, setAnalysisData] = useState<any>(null);

  // Curestry brand colors - правильный черный фон
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

  const resetDemo = () => {
    setSteps(PIPELINE_STEPS.map(step => ({ ...step, status: 'pending', duration: undefined, details: undefined })));
    setCurrentStep(0);
    setIsRunning(false);
    setAnalysisData(null);
  };

  const runDemo = async () => {
    setIsRunning(true);

    // Simulate pipeline execution
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);

      // Mark step as running
      setSteps(prev => prev.map((step, index) =>
        index === i ? { ...step, status: 'running' } : step
      ));

      // Simulate processing time
      const duration = Math.random() * 2000 + 1000; // 1-3 seconds
      await new Promise(resolve => setTimeout(resolve, duration));

      // Mark step as completed with details
      setSteps(prev => prev.map((step, index) =>
        index === i ? {
          ...step,
          status: 'completed',
          duration: Math.round(duration),
          details: getStepDetails(i)
        } : step
      ));
    }

    // Try to get actual analysis from our API
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
      const response = await fetch(`${API_BASE}/analyze/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: {
            content: selectedExample.prompt,
            format_type: 'text'
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysisData(data);
        console.log('Real analysis data loaded:', data);
      } else {
        console.log('API not available, using demo mode');
        setAnalysisData(getMockAnalysisData());
      }
    } catch (error) {
      console.log('Demo mode - using mock data');
      setAnalysisData(getMockAnalysisData());
    }

    setIsRunning(false);
  };

  const getStepDetails = (stepIndex: number): string => {
    // Different details based on selected example
    const detailsByExample = {
      'coding': [
        'English detected ✓ No translation needed',
        'XML structure added ✓ Role, instruction, input tags applied',
        'Vocabulary simplified ✓ "helpful assistant" → "code analysis expert"',
        'No logical contradictions ✓ Content consistent',
        'Entropy: 0.187 ✓ High semantic consistency achieved',
        'Clarity: 8.5, Structure: 8.7, Specificity: 7.8 → Overall: 8.2/10',
        '5 structural and vocabulary patches applied ✓',
        '3 high-priority clarification questions generated ✓'
      ],
      'customer-support': [
        'Russian detected ✓ Translating to English for processing',
        'XML structure added ✓ Role, customer_context, response_format tags applied',
        'Vocabulary improved ✓ "помощник" → "специалист по успеху клиентов"',
        'No contradictions ✓ Empathy and urgency aligned',
        'Entropy: 0.156 ✓ Consistent multilingual processing',
        'Empathy: 8.2, Professionalism: 8.1, Clarity: 7.5 → Overall: 7.8/10',
        '4 empathy and escalation patches applied ✓',
        '2 policy clarification questions generated ✓'
      ],
      'content-writing': [
        'English detected ✓ No translation needed',
        'XML structure added ✓ Content_specifications, requirements tags applied',
        'Vocabulary enhanced ✓ "engaging" → "authoritative yet accessible"',
        'No contradictions ✓ Audience and tone aligned',
        'Entropy: 0.142 ✓ Excellent content consistency',
        'Clarity: 8.7, Creativity: 8.1, Structure: 8.8 → Overall: 8.5/10',
        '3 content optimization patches applied ✓',
        '2 content depth questions generated ✓'
      ]
    };

    const details = detailsByExample[selectedExample.id as keyof typeof detailsByExample] || detailsByExample['coding'];
    return details[stepIndex] || 'Processing completed';
  };

  const getMockAnalysisData = () => {
    const exampleData = {
      'coding': {
        report: {
          overall_score: 8.2,
          judge_score: {
            score: 8.2,
            rationale: "Good structure and clear instructions. Improved with XML formatting, vocabulary simplification, and specific output requirements.",
            details: { clarity: 8.5, specificity: 7.8, structure: 8.7, completeness: 7.9 }
          },
          improved_prompt: `<task>
<role>You are a code analysis expert that helps developers improve JavaScript code quality</role>

<instruction>
Analyze the provided JavaScript function and suggest improvements focusing on:
1. Modern syntax (use const/let instead of var)
2. Performance optimization
3. Code readability
4. Best practices compliance
</instruction>

<input>
function calculateTotal(items) {
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}
</input>

<output_format>
<analysis>
  <issues>List specific problems found</issues>
  <suggestions>Provide concrete improvement recommendations</suggestions>
  <improved_code>Show the refactored version</improved_code>
  <explanation>Explain the benefits of changes</explanation>
</analysis>
</output_format>

<constraints>
- Focus on practical, actionable improvements
- Prioritize readability over micro-optimizations
- Provide modern ES6+ alternatives when applicable
</constraints>
</task>`
        },
        patches: [
          { id: '1', type: 'safe', category: 'vocabulary', description: 'Replace "helpful assistant" with "code analysis expert"', original: 'helpful assistant', improved: 'code analysis expert', confidence: 0.95 },
          { id: '2', type: 'safe', category: 'structure', description: 'Add XML structure with role, instruction, input, output_format tags', original: 'analyze the following JavaScript function', improved: '<instruction>Analyze the provided JavaScript function...</instruction>', confidence: 0.92 },
          { id: '3', type: 'safe', category: 'vocabulary', description: 'Replace "better" with "improved" for clarity', original: 'better code', improved: 'improved code', confidence: 0.88 }
        ],
        questions: [
          { id: '1', question: 'Should the analysis include security considerations for the code?', category: 'scope', priority: 'medium' },
          { id: '2', question: 'What JavaScript version compatibility should be targeted (ES5, ES6+)?', category: 'requirements', priority: 'high' }
        ]
      },
      'customer-support': {
        report: {
          overall_score: 7.8,
          judge_score: {
            score: 7.8,
            rationale: "Russian customer support prompt successfully translated and improved with empathy-focused XML structure, escalation procedures, and multilingual processing.",
            details: { empathy: 8.2, clarity: 7.5, professionalism: 8.1, completeness: 7.4 }
          },
          improved_prompt: `<task>
<role>You are a customer success specialist focused on resolving urgent technical issues with empathy and efficiency</role>

<instruction>
Address the customer's account access issue following these priorities:
1. Acknowledge urgency and empathize with presentation deadline
2. Provide immediate troubleshooting alternatives
3. Offer escalation path for time-sensitive cases
4. Ensure follow-up communication within business hours
</instruction>

<customer_context>
<original_language>Russian</original_language>
<translated_issue>Account login failure with password reset problems</translated_issue>
<priority>Critical (presentation deadline tomorrow)</priority>
<previous_attempts>Multiple password reset attempts failed</previous_attempts>
<technical_status>Email delivery issues preventing password reset</technical_status>
<urgency_level>High - business critical access needed</urgency_level>
</customer_context>

<response_format>
<acknowledgment>Express empathy and urgency understanding in user's preferred language</acknowledgment>
<immediate_steps>Provide 2-3 alternative login methods or technical workarounds</immediate_steps>
<escalation>Offer direct technical support contact for urgent cases</escalation>
<follow_up>Confirm resolution timeline and backup data access options</follow_up>
</response_format>

<constraints>
- Respond with empathetic, professional tone
- Prioritize immediate resolution for business-critical issues
- Always provide escalation options for urgent cases
- Consider language preferences and cultural context
- Offer alternative solutions when primary methods fail
</constraints>
</task>`
        },
        patches: [
          { id: '1', type: 'safe', category: 'translation', description: 'Detected Russian, translated "помощник" to "customer success specialist"', original: 'Ты помощник службы поддержки', improved: 'You are a customer success specialist', confidence: 0.94 },
          { id: '2', type: 'safe', category: 'structure', description: 'Add multilingual customer context with urgency classification', original: 'Помоги пользователям с их вопросами', improved: '<customer_context> with original_language and urgency_level tags', confidence: 0.91 },
          { id: '3', type: 'safe', category: 'vocabulary', description: 'Enhanced empathy vocabulary for business-critical situations', original: 'дружелюбным и профессиональным', improved: 'empathetic, professional tone with cultural sensitivity', confidence: 0.88 },
          { id: '4', type: 'risky', category: 'clarity', description: 'Add alternative solutions for failed primary methods', original: '', improved: 'Offer alternative login methods when password reset fails', confidence: 0.83 }
        ],
        questions: [
          { id: '1', question: 'Should multilingual support responses be provided in original language or English?', category: 'localization', priority: 'high' },
          { id: '2', question: 'What alternative authentication methods are available when email delivery fails?', category: 'technical', priority: 'high' }
        ]
      },
      'content-writing': {
        report: {
          overall_score: 8.5,
          judge_score: {
            score: 8.5,
            rationale: "Content writing prompt enhanced with audience-specific requirements, structured sections, and SEO considerations.",
            details: { clarity: 8.7, specificity: 8.4, structure: 8.8, creativity: 8.1 }
          },
          improved_prompt: `<task>
<role>You are a healthcare content specialist creating educational materials for medical professionals</role>

<instruction>
Create an authoritative yet accessible blog post about AI in healthcare with the following requirements:
1. Use evidence-based examples from real implementations
2. Balance technical accuracy with readability
3. Include actionable insights for healthcare administrators
4. Address common concerns about AI adoption
</instruction>

<content_specifications>
<topic>How AI is transforming patient care</topic>
<target_audience>Healthcare professionals (non-technical)</target_audience>
<word_count>800-900 words</word_count>
<tone>Professional, authoritative, yet accessible</tone>
<structure>
  <introduction>Hook with compelling statistic</introduction>
  <body>3-4 main sections with real examples</body>
  <conclusion>Call-to-action for implementation</conclusion>
</structure>
</content_specifications>

<requirements>
<examples>Include 2-3 specific AI healthcare implementations</examples>
<benefits>Quantifiable improvements in patient outcomes</benefits>
<concerns>Address privacy and adoption challenges</concerns>
<seo>Include relevant keywords naturally</seo>
</requirements>

<constraints>
- Maintain medical accuracy and credibility
- Avoid overly technical jargon
- Include credible sources and statistics
- Focus on practical implementation value
</constraints>
</task>`
        },
        patches: [
          { id: '1', type: 'safe', category: 'structure', description: 'Add content specifications section with detailed requirements', original: 'around 800 words', improved: '<word_count>800-900 words</word_count>', confidence: 0.94 },
          { id: '2', type: 'safe', category: 'vocabulary', description: 'Replace "engaging" with "authoritative yet accessible"', original: 'engaging and informative', improved: 'authoritative yet accessible', confidence: 0.87 },
          { id: '3', type: 'risky', category: 'clarity', description: 'Add SEO and credibility requirements', original: '', improved: '<seo>Include relevant keywords naturally</seo>', confidence: 0.79 }
        ],
        questions: [
          { id: '1', question: 'Should the article include specific AI vendor recommendations?', category: 'content', priority: 'medium' },
          { id: '2', question: 'What level of technical detail is appropriate for the target audience?', category: 'scope', priority: 'high' }
        ]
      }
    };

    return exampleData[selectedExample.id as keyof typeof exampleData] || exampleData['coding'];
  };

  const getStatusColor = (status: PipelineStep['status']) => {
    switch (status) {
      case 'completed': return { color: curestryColors.success };
      case 'running': return { color: curestryColors.primary };
      case 'error': return { color: curestryColors.error };
      default: return { color: curestryColors.muted };
    }
  };

  const getStatusIcon = (status: PipelineStep['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" style={{ color: curestryColors.success }} />;
      case 'running': return <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: curestryColors.primary }}></div>;
      case 'error': return <AlertTriangle className="h-4 w-4" style={{ color: curestryColors.error }} />;
      default: return null;
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: curestryColors.background }}
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-bold mb-4"
            style={{
              color: curestryColors.text,
              fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            Curestry AI Pipeline Demo
          </h1>
          <p
            className="text-xl max-w-3xl mx-auto mb-4"
            style={{
              color: curestryColors.secondary,
              fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            Watch our comprehensive prompt analysis system in action. This demo showcases
            each step of our LangGraph-powered pipeline, from language detection to improvement suggestions.
          </p>

          {/* Current Example Badge */}
          <div className="flex items-center justify-center">
            <div
              className="px-4 py-2 text-sm rounded-lg border"
              style={{
                backgroundColor: curestryColors.primary + '20',
                borderColor: curestryColors.primary,
                color: curestryColors.primary,
                fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
              }}
            >
              Current: {selectedExample.title} ({selectedExample.category})
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Demo Prompt */}
          <div className="lg:col-span-1">
            <div
              className="h-fit sticky top-6 rounded-lg border p-6"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <div className="mb-6">
                <h3
                  className="flex items-center space-x-2 text-lg font-bold mb-4"
                  style={{
                    color: curestryColors.text,
                    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <FileText className="h-5 w-5" style={{ color: curestryColors.primary }} />
                  <span>Demo Examples</span>
                </h3>
              </div>
              <div>
                {/* Example Selector */}
                <div className="mb-6">
                  <h4
                    className="text-sm font-medium mb-3"
                    style={{
                      color: curestryColors.text,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    Choose Example:
                  </h4>
                  <div className="space-y-2">
                    {DEMO_EXAMPLES.map((example) => (
                      <button
                        key={example.id}
                        onClick={() => {
                          setSelectedExample(example);
                          resetDemo();
                        }}
                        disabled={isRunning}
                        className="w-full text-left p-3 rounded-lg border transition-all hover:scale-102"
                        style={{
                          backgroundColor: selectedExample.id === example.id
                            ? curestryColors.primary + '20'
                            : curestryColors.background,
                          borderColor: selectedExample.id === example.id
                            ? curestryColors.primary
                            : curestryColors.border,
                          color: curestryColors.text
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div
                            className="text-sm font-medium"
                            style={{
                              color: selectedExample.id === example.id
                                ? curestryColors.primary
                                : curestryColors.text,
                              fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                            }}
                          >
                            {example.title}
                          </div>
                          <span
                            className="px-2 py-1 text-xs rounded"
                            style={{
                              backgroundColor: selectedExample.id === example.id
                                ? curestryColors.primary
                                : curestryColors.border + '80',
                              color: selectedExample.id === example.id
                                ? curestryColors.background
                                : curestryColors.secondary
                            }}
                          >
                            {example.category.split(' ')[0]}
                          </span>
                        </div>
                        <div
                          className="text-xs"
                          style={{
                            color: curestryColors.secondary,
                            fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                          }}
                        >
                          {example.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected Prompt Display */}
                <div className="mb-6">
                  <h4
                    className="text-sm font-medium mb-2"
                    style={{
                      color: curestryColors.text,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    Current Prompt:
                  </h4>
                  <pre
                    className="text-xs p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap"
                    style={{
                      backgroundColor: curestryColors.border + '40',
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    {selectedExample.prompt}
                  </pre>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={runDemo}
                    disabled={isRunning}
                    className="w-full px-4 py-3 rounded-lg font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    style={{
                      backgroundColor: curestryColors.primary,
                      color: curestryColors.background,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    {isRunning ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Start Demo
                      </>
                    )}
                  </button>

                  <button
                    onClick={resetDemo}
                    disabled={isRunning}
                    className="w-full px-4 py-3 rounded-lg font-medium border transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    style={{
                      backgroundColor: 'transparent',
                      color: curestryColors.secondary,
                      borderColor: curestryColors.border,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Demo
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline Steps */}
          <div className="lg:col-span-2">
            <div
              className="rounded-lg border p-6"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <h3
                    className="text-lg font-bold"
                    style={{
                      color: curestryColors.text,
                      fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    Analysis Pipeline
                  </h3>
                  {isRunning && (
                    <span
                      className="px-3 py-1 text-sm rounded border animate-pulse"
                      style={{
                        backgroundColor: 'transparent',
                        borderColor: curestryColors.border,
                        color: curestryColors.secondary,
                        fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                      }}
                    >
                      Step {currentStep + 1} of {steps.length}
                    </span>
                  )}
                </div>
                {/* Progress Bar */}
                {(isRunning || steps.some(s => s.status === 'completed')) && (
                  <div
                    className="w-full rounded-full h-2 mt-4"
                    style={{ backgroundColor: curestryColors.border }}
                  >
                    <div
                      className="h-2 rounded-full transition-all duration-500 ease-out"
                      style={{
                        backgroundColor: curestryColors.primary,
                        width: `${(steps.filter(s => s.status === 'completed').length / steps.length) * 100}%`
                      }}
                    ></div>
                  </div>
                )}
              </div>
              <div>
                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div key={step.id} className="relative">
                      {/* Connection line */}
                      {index < steps.length - 1 && (
                        <div
                          className="absolute w-0.5 h-16"
                          style={{
                            backgroundColor: curestryColors.border,
                            left: '36px', // Adjusted for better visual alignment with animations
                            top: '64px'   // Height of step container (48px) + padding (16px) = 64px
                          }}
                        >
                          <div
                            className="w-full transition-all duration-500"
                            style={{
                              backgroundColor: step.status === 'completed' ? curestryColors.success : curestryColors.border,
                              height: step.status === 'completed' ? '100%' : '0%'
                            }}
                          ></div>
                        </div>
                      )}

                      <div
                        className="flex items-start space-x-4 p-4 rounded-lg transition-all duration-500 transform border"
                        style={{
                          backgroundColor: step.status === 'running'
                            ? curestryColors.primary + '20'
                            : step.status === 'completed'
                            ? curestryColors.success + '20'
                            : curestryColors.background,
                          borderColor: step.status === 'running'
                            ? curestryColors.primary
                            : step.status === 'completed'
                            ? curestryColors.success
                            : curestryColors.border,
                          borderWidth: step.status !== 'pending' ? '2px' : '1px',
                          transform: step.status === 'running' ? 'scale(1.05)' : step.status === 'completed' ? 'scale(1.02)' : 'scale(1)'
                        }}
                      >
                        {/* Step icon */}
                        <div
                          className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: step.status === 'completed'
                              ? curestryColors.success + '30'
                              : step.status === 'running'
                              ? curestryColors.primary + '30'
                              : curestryColors.border + '50'
                          }}
                        >
                          <div style={getStatusColor(step.status)}>
                            {step.icon}
                          </div>
                        </div>

                        {/* Step content */}
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3
                              className="font-semibold"
                              style={{
                                color: curestryColors.text,
                                fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                              }}
                            >
                              {step.name}
                            </h3>
                            <div className="flex items-center space-x-2">
                              {step.duration && (
                                <span
                                  className="px-2 py-1 text-xs rounded"
                                  style={{
                                    backgroundColor: curestryColors.border + '80',
                                    color: curestryColors.secondary,
                                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                                  }}
                                >
                                  {step.duration}ms
                                </span>
                              )}
                              {getStatusIcon(step.status)}
                            </div>
                          </div>

                          <p
                            className="text-sm mb-2"
                            style={{
                              color: curestryColors.secondary,
                              fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                            }}
                          >
                            {step.description}
                          </p>

                          {step.details && (
                            <div
                              className="text-sm px-3 py-2 rounded-md"
                              style={{
                                backgroundColor: curestryColors.success + '20',
                                color: curestryColors.success,
                                fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                              }}
                            >
                              {step.details}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            {analysisData && (
              <Card className="mt-6 animate-in slide-in-from-bottom-4 duration-700 transition-all">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-green-600" />
                    <span>Analysis Results</span>
                    <Badge variant="secondary" className="ml-2">Complete</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <div className="text-3xl font-bold text-blue-600 mb-2">
                        {analysisData.report?.overall_score?.toFixed(1) || '8.2'}
                      </div>
                      <div className="text-sm font-medium text-blue-700">Overall Score</div>
                      <div className="text-xs text-blue-600 mt-1">out of 10</div>
                    </div>

                    <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                      <div className="text-3xl font-bold text-green-600 mb-2">
                        {analysisData.patches?.length || 5}
                      </div>
                      <div className="text-sm font-medium text-green-700">Improvements</div>
                      <div className="text-xs text-green-600 mt-1">applied patches</div>
                    </div>

                    <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                      <div className="text-3xl font-bold text-purple-600 mb-2">
                        {analysisData.questions?.length || 3}
                      </div>
                      <div className="text-sm font-medium text-purple-700">Questions</div>
                      <div className="text-xs text-purple-600 mt-1">for clarification</div>
                    </div>
                  </div>

                  {/* Detailed Judge Metrics */}
                  {analysisData.report?.judge_score?.details && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Judge Assessment Breakdown:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(analysisData.report.judge_score.details).map(([metric, score]: [string, any]) => (
                          <div key={metric} className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-bold text-gray-700">{score?.toFixed(1)}</div>
                            <div className="text-xs text-gray-600 capitalize">{metric}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Improved Prompt Display */}
                  {analysisData.report?.improved_prompt && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        Optimized Prompt (XML Format):
                      </h4>
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                        <pre className="text-sm whitespace-pre-wrap font-mono">
                          {analysisData.report.improved_prompt}
                        </pre>
                      </div>
                      <div className="mt-3 flex items-center text-sm text-gray-600">
                        <span className="flex items-center mr-4">
                          <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                          XML Structure
                        </span>
                        <span className="flex items-center mr-4">
                          <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                          Vocabulary Simplified
                        </span>
                        <span className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                          Output Format Specified
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Applied Improvements */}
                  {analysisData.patches && analysisData.patches.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Applied Improvements:</h4>
                      <div className="space-y-2">
                        {analysisData.patches.map((patch: any) => (
                          <div key={patch.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                            <Badge variant={patch.type === 'safe' ? 'default' : 'secondary'}>
                              {patch.type}
                            </Badge>
                            <div className="flex-grow">
                              <div className="text-sm font-medium text-gray-900">{patch.description}</div>
                              {patch.original && patch.improved && (
                                <div className="mt-2 text-xs">
                                  <div className="text-red-600">- {patch.original}</div>
                                  <div className="text-green-600">+ {patch.improved}</div>
                                </div>
                              )}
                              <div className="mt-1 text-xs text-gray-500">
                                Confidence: {Math.round(patch.confidence * 100)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clarification Questions */}
                  {analysisData.questions && analysisData.questions.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Clarification Questions:</h4>
                      <div className="space-y-3">
                        {analysisData.questions.map((question: any) => (
                          <div key={question.id} className="p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <Badge variant="outline" className="text-xs">
                                {question.category}
                              </Badge>
                              <Badge variant={question.priority === 'high' ? 'destructive' :
                                             question.priority === 'medium' ? 'default' : 'secondary'}>
                                {question.priority}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-700">{question.question}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-center">
                    <Button
                      size="lg"
                      className="px-8"
                      onClick={() => window.location.href = '/analyze'}
                    >
                      Try Full Analysis
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
