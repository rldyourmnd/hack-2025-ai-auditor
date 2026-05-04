'use client';

import { useState, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore, ApiService } from '@/lib/store';
import { PromptSession } from '@/lib/types';
import { Loader2, Play, Download, Save, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';

export default function AnalyzePage() {
  const {
    currentSession,
    setCurrentSession,
    updateAnalysis,
    isLoading,
    setLoading,
    error,
    setError
  } = useAppStore();

  const [promptText, setPromptText] = useState('');
  const [selectedPatches, setSelectedPatches] = useState<string[]>([]);

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

  // Helper function to safely format numbers
  const formatNumber = (value: any, decimals: number = 1): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toFixed(decimals);
    }
    return 'N/A';
  };

  const handleAnalyze = async () => {
    if (!promptText.trim()) {
      setError('Please enter a prompt to analyze');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sessionId = Date.now().toString();
      const session: PromptSession = {
        id: sessionId,
        originalPrompt: promptText,
        currentPrompt: promptText,
        appliedPatches: [],
        isAnalyzing: true,
      };

      setCurrentSession(session);

      const analysis = await ApiService.analyzePrompt(promptText);
      updateAnalysis(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPatches = async () => {
    if (!currentSession || selectedPatches.length === 0) return;

    setLoading(true);
    try {
      const result = await ApiService.applyPatches(currentSession.id, selectedPatches);
      setPromptText(result.improved_prompt);

      setCurrentSession({
        ...currentSession,
        currentPrompt: result.improved_prompt,
        appliedPatches: [...currentSession.appliedPatches, ...selectedPatches],
      });

      setSelectedPatches([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply patches');
    } finally {
      setLoading(false);
    }
  };

  const handlePatchSelection = (patchId: string) => {
    setSelectedPatches(prev =>
      prev.includes(patchId)
        ? prev.filter(id => id !== patchId)
        : [...prev, patchId]
    );
  };

  const applySafePatches = () => {
    if (!currentSession?.analysis) return;

    const safePatches = currentSession.analysis.patches
      .filter(patch => patch.type === 'safe')
      .map(patch => patch.id);

    setSelectedPatches(safePatches);
  };

  return (
    <div
      className="min-h-screen p-4"
      style={{ backgroundColor: curestryColors.background }}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1
            className="text-3xl font-bold mb-2"
            style={{
              color: curestryColors.text,
              fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            Prompt Analysis Studio
          </h1>
          <p
            style={{
              color: curestryColors.secondary,
              fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            Analyze and optimize your prompts with AI-powered insights
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Editor */}
          <div className="space-y-4">
            <div
              className="rounded-lg border p-6"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <h3
                className="text-lg font-bold mb-2"
                style={{
                  color: curestryColors.text,
                  fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Prompt Editor
              </h3>
              <p
                className="text-sm mb-4"
                style={{
                  color: curestryColors.secondary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Enter your prompt below and click analyze to get comprehensive insights
              </p>
              <div
                className="border rounded-md overflow-hidden"
                style={{ borderColor: curestryColors.border }}
              >
                <Editor
                  height="400px"
                  defaultLanguage="markdown"
                  value={promptText}
                  onChange={(value) => setPromptText(value || '')}
                  options={{
                    minimap: { enabled: false },
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    theme: 'vs-dark',
                  }}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAnalyze}
                  disabled={isLoading || !promptText.trim()}
                  className="flex-1 px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  style={{
                    backgroundColor: curestryColors.primary,
                    color: curestryColors.background,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Analyze Prompt
                </button>
                {currentSession?.analysis && (
                  <>
                    <button
                      className="px-4 py-2 rounded-lg font-medium border transition-all hover:scale-105 flex items-center"
                      style={{
                        backgroundColor: 'transparent',
                        color: curestryColors.secondary,
                        borderColor: curestryColors.border,
                        fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                      }}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save to Prompt-base
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg font-medium border transition-all hover:scale-105 flex items-center"
                      style={{
                        backgroundColor: 'transparent',
                        color: curestryColors.secondary,
                        borderColor: curestryColors.border,
                        fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div
                className="p-4 rounded-lg border-l-4"
                style={{
                  backgroundColor: curestryColors.error + '20',
                  borderLeftColor: curestryColors.error,
                  borderWidth: '0 0 0 4px'
                }}
              >
                <div
                  className="flex items-center"
                  style={{
                    color: curestryColors.error,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  {error}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Analysis Results */}
          <div className="space-y-4">
            {currentSession?.analysis?.report && (
              <>
                {/* Metrics Dashboard */}
                <div
                  className="rounded-lg border p-6"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border
                  }}
                >
                  <h3
                    className="text-lg font-bold mb-4"
                    style={{
                      color: curestryColors.text,
                      fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    Analysis Metrics
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className="text-center p-3 rounded"
                      style={{ backgroundColor: curestryColors.primary + '20' }}
                    >
                      <div
                        className="text-2xl font-bold"
                        style={{
                          color: curestryColors.primary,
                          fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                        }}
                      >
                        {formatNumber(currentSession.analysis.report.judge_score?.score, 1)}
                      </div>
                      <div
                        className="text-sm"
                        style={{
                          color: curestryColors.secondary,
                          fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                        }}
                      >
                        Judge Score
                      </div>
                    </div>
                    <div
                      className="text-center p-3 rounded"
                      style={{ backgroundColor: curestryColors.success + '20' }}
                    >
                      <div
                        className="text-2xl font-bold"
                        style={{
                          color: curestryColors.success,
                          fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                        }}
                      >
                        {formatNumber(currentSession.analysis.report.semantic_entropy?.entropy, 2)}
                      </div>
                      <div
                        className="text-sm"
                        style={{
                          color: curestryColors.secondary,
                          fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                        }}
                      >
                        Entropy
                      </div>
                    </div>
                    <div
                      className="text-center p-3 rounded"
                      style={{ backgroundColor: curestryColors.accent + '20' }}
                    >
                      <div
                        className="text-2xl font-bold"
                        style={{
                          color: curestryColors.accent,
                          fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                        }}
                      >
                        {currentSession.analysis.report.semantic_entropy?.clusters ?? 'N/A'}
                      </div>
                      <div
                        className="text-sm"
                        style={{
                          color: curestryColors.secondary,
                          fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                        }}
                      >
                        Clusters
                      </div>
                    </div>
                    <div
                      className="text-center p-3 rounded"
                      style={{ backgroundColor: curestryColors.warning + '20' }}
                    >
                      <div
                        className="text-2xl font-bold"
                        style={{
                          color: curestryColors.warning,
                          fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                        }}
                      >
                        {currentSession.analysis.report.contradictions?.length ?? 0}
                      </div>
                      <div
                        className="text-sm"
                        style={{
                          color: curestryColors.secondary,
                          fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                        }}
                      >
                        Contradictions
                      </div>
                    </div>
                  </div>
                  <div
                    className="mt-4 p-3 rounded"
                    style={{ backgroundColor: curestryColors.border + '40' }}
                  >
                    <div
                      className="text-sm"
                      style={{
                        color: curestryColors.secondary,
                        fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                      }}
                    >
                      Language: <span className="font-medium">{currentSession.analysis.report.detected_language ?? 'Unknown'}</span> |
                      Format: <span className="font-medium">{currentSession.analysis.report.format_valid ? '✓ Valid' : '✗ Invalid'}</span> |
                      Translated: <span className="font-medium">{currentSession.analysis.report.translated ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                {/* Patch List */}
                {currentSession.analysis.patches && currentSession.analysis.patches.length > 0 && (
                <div
                  className="rounded-lg border p-6"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3
                      className="text-lg font-bold"
                      style={{
                        color: curestryColors.text,
                        fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                      }}
                    >
                      Improvement Suggestions
                    </h3>
                    {currentSession.analysis.patches.some(p => p.type === 'safe') && (
                      <button
                        className="px-3 py-1 text-sm rounded border transition-all hover:scale-105"
                        style={{
                          backgroundColor: 'transparent',
                          color: curestryColors.secondary,
                          borderColor: curestryColors.border,
                          fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                        }}
                        onClick={applySafePatches}
                      >
                        Apply All Safe Fixes
                      </button>
                    )}
                  </div>
                  <div>
                    <div className="space-y-3">
                      {currentSession.analysis.patches.map((patch) => (
                        <div
                          key={patch.id}
                          className={`p-3 border rounded cursor-pointer transition-colors ${
                            selectedPatches.includes(patch.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handlePatchSelection(patch.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-1 text-xs rounded ${
                                  patch.type === 'safe'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {patch.type}
                                </span>
                                <span className="text-sm font-medium">{patch.category}</span>
                              </div>
                              <p
                                className="text-sm mb-1"
                                style={{
                                  color: curestryColors.secondary,
                                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                                }}
                              >
                                {patch.description}
                              </p>
                              <p
                                className="text-xs"
                                style={{
                                  color: curestryColors.muted,
                                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                                }}
                              >
                                {patch.rationale}
                              </p>
                            </div>
                            {selectedPatches.includes(patch.id) && (
                              <CheckCircle className="h-5 w-5 text-blue-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedPatches.length > 0 && (
                      <Button
                        onClick={handleApplyPatches}
                        disabled={isLoading}
                        className="w-full mt-4"
                      >
                        Apply Selected Patches ({selectedPatches.length})
                      </Button>
                    )}
                  </div>
                </div>
                )}

                {/* Clarification Questions */}
                {currentSession.analysis.questions && currentSession.analysis.questions.length > 0 && (
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      backgroundColor: curestryColors.background,
                      borderColor: curestryColors.border
                    }}
                  >
                    <div className="mb-4">
                      <h3
                        className="flex items-center text-lg font-bold mb-2"
                        style={{
                          color: curestryColors.text,
                          fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                        }}
                      >
                        <MessageSquare className="mr-2 h-5 w-5" style={{ color: curestryColors.primary }} />
                        Clarification Questions
                      </h3>
                      <p
                        className="text-sm"
                        style={{
                          color: curestryColors.secondary,
                          fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                        }}
                      >
                        Answer these questions to improve your prompt
                      </p>
                    </div>
                    <div>
                      <div className="space-y-3">
                        {currentSession.analysis.questions.map((question) => (
                          <div key={question.id} className="p-3 border rounded">
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className="px-2 py-1 text-xs rounded"
                                style={{
                                  backgroundColor: question.priority === 'critical'
                                    ? curestryColors.error + '40'
                                    : question.priority === 'important'
                                    ? curestryColors.warning + '40'
                                    : curestryColors.border + '40',
                                  color: question.priority === 'critical'
                                    ? curestryColors.error
                                    : question.priority === 'important'
                                    ? curestryColors.warning
                                    : curestryColors.muted
                                }}
                              >
                                {question.priority}
                              </span>
                              <span
                                className="text-xs"
                                style={{
                                  color: curestryColors.muted,
                                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                                }}
                              >
                                {question.category}
                              </span>
                            </div>
                            <p className="text-sm">{question.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Loading State */}
            {isLoading && !currentSession?.analysis && (
              <div
                className="rounded-lg border p-6"
                style={{
                  backgroundColor: curestryColors.background,
                  borderColor: curestryColors.border
                }}
              >
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin mb-4" style={{ color: curestryColors.primary }} />
                  <p
                    style={{
                      color: curestryColors.text,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    Analyzing your prompt...
                  </p>
                  <p
                    className="text-sm mt-2"
                    style={{
                      color: curestryColors.muted,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    This usually takes 35-40 seconds
                  </p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!currentSession && !isLoading && (
              <div
                className="rounded-lg border p-6"
                style={{
                  backgroundColor: curestryColors.background,
                  borderColor: curestryColors.border
                }}
              >
                <div className="text-center">
                  <Play className="mx-auto h-12 w-12 mb-4" style={{ color: curestryColors.muted }} />
                  <p
                    style={{
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    Enter a prompt and click analyze to get started
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
