'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Edit, Trash2, Database, Filter } from 'lucide-react';

interface Prompt {
  id: string;
  name: string;
  description: string;
  content: string;
  format_type: string;
  language: string;
  tags: string[];
  created_at: string;
}

export default function PromptBasePage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // Mock data for demo
  useEffect(() => {
    setPrompts([
      {
        id: '1',
        name: 'Python Coding Assistant',
        description: 'A comprehensive prompt for Python code generation and debugging',
        content: 'You are an expert Python developer. Help users write clean, efficient Python code...',
        format_type: 'text',
        language: 'en',
        tags: ['python', 'coding', 'assistant'],
        created_at: '2024-01-15T10:30:00Z',
      },
      {
        id: '2',
        name: 'JavaScript Helper',
        description: 'Frontend development assistance with JavaScript and React',
        content: 'You are a frontend development expert specializing in JavaScript and React...',
        format_type: 'markdown',
        language: 'en',
        tags: ['javascript', 'web', 'frontend', 'react'],
        created_at: '2024-01-14T15:45:00Z',
      },
      {
        id: '3',
        name: 'Article Writing Template',
        description: 'Template for generating high-quality technical articles',
        content: 'Write a comprehensive technical article about [TOPIC]. Include introduction...',
        format_type: 'xml',
        language: 'en',
        tags: ['writing', 'content', 'technical'],
        created_at: '2024-01-13T09:20:00Z',
      },
    ]);
  }, []);

  const allTags = Array.from(new Set(prompts.flatMap(p => p.tags)));

  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = searchQuery === '' ||
      prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTags = selectedTags.length === 0 ||
      selectedTags.some(tag => prompt.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div
      className="min-h-screen p-4"
      style={{ backgroundColor: curestryColors.background }}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-bold mb-2"
              style={{
                color: curestryColors.text,
                fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
              }}
            >
              Prompt-base
            </h1>
            <p
              style={{
                color: curestryColors.secondary,
                fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
              }}
            >
              Manage and organize your prompt library
            </p>
          </div>
          <button
            className="px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 flex items-center"
            style={{
              backgroundColor: curestryColors.primary,
              color: curestryColors.background,
              fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Prompt
          </button>
        </div>

        {/* Search and Filters */}
        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: curestryColors.background,
            borderColor: curestryColors.border
          }}
        >
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
                  style={{ color: curestryColors.muted }}
                />
                <input
                  type="text"
                  placeholder="Search prompts by name, description, or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-md border focus:ring-2 focus:ring-opacity-50"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border,
                    color: curestryColors.text,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                />
              </div>

              {/* Tag Filters */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="h-4 w-4" style={{ color: curestryColors.muted }} />
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: curestryColors.text,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    Filter by tags:
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className="px-3 py-1 text-sm rounded-full border transition-colors hover:scale-105"
                      style={{
                        backgroundColor: selectedTags.includes(tag)
                          ? curestryColors.primary + '40'
                          : curestryColors.border + '40',
                        borderColor: selectedTags.includes(tag)
                          ? curestryColors.primary
                          : curestryColors.border,
                        color: selectedTags.includes(tag)
                          ? curestryColors.primary
                          : curestryColors.secondary,
                        fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div
                className="flex items-center gap-4 text-sm"
                style={{
                  color: curestryColors.secondary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                <span>Total: {prompts.length} prompts</span>
                <span>Filtered: {filteredPrompts.length} prompts</span>
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="hover:underline transition-all"
                    style={{
                      color: curestryColors.primary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
        </div>

        {/* Prompt List */}
        <div className="grid gap-4">
          {filteredPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="hover:shadow-md transition-shadow rounded-lg border p-6"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <div className="mb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-5 w-5" style={{ color: curestryColors.primary }} />
                      <h3
                        className="text-lg font-bold"
                        style={{
                          color: curestryColors.text,
                          fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                        }}
                      >
                        {prompt.name}
                      </h3>
                    </div>
                    <p
                      className="text-sm"
                      style={{
                        color: curestryColors.secondary,
                        fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                      }}
                    >
                      {prompt.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="p-2 rounded border transition-all hover:scale-105"
                      style={{
                        backgroundColor: 'transparent',
                        borderColor: curestryColors.border,
                        color: curestryColors.secondary
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      className="p-2 rounded border transition-all hover:scale-105"
                      style={{
                        backgroundColor: 'transparent',
                        borderColor: curestryColors.border,
                        color: curestryColors.error
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Content Preview */}
                <div
                  className="p-3 rounded text-sm"
                  style={{ backgroundColor: curestryColors.border + '40' }}
                >
                  <p
                    className="line-clamp-2"
                    style={{
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    {prompt.content.length > 150
                      ? `${prompt.content.substring(0, 150)}...`
                      : prompt.content
                    }
                  </p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {prompt.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs rounded"
                      style={{
                        backgroundColor: curestryColors.primary + '40',
                        color: curestryColors.primary,
                        fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Metadata */}
                <div
                  className="flex items-center justify-between text-xs"
                  style={{
                    color: curestryColors.muted,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <div className="flex gap-4">
                    <span>Format: {prompt.format_type}</span>
                    <span>Language: {prompt.language}</span>
                  </div>
                  <span>Created: {new Date(prompt.created_at).toLocaleDateString()}</span>
                </div>

                {/* Actions */}
                <div
                  className="flex gap-2 pt-2 border-t"
                  style={{ borderColor: curestryColors.border }}
                >
                  <button
                    className="px-3 py-1 text-sm rounded border transition-all hover:scale-105"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: curestryColors.border,
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    Analyze
                  </button>
                  <button
                    className="px-3 py-1 text-sm rounded border transition-all hover:scale-105"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: curestryColors.border,
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    Check Conflicts
                  </button>
                  <button
                    className="px-3 py-1 text-sm rounded border transition-all hover:scale-105"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: curestryColors.border,
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    View Relations
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredPrompts.length === 0 && (
          <div
            className="rounded-lg border p-6"
            style={{
              backgroundColor: curestryColors.background,
              borderColor: curestryColors.border
            }}
          >
            <div className="pt-6">
              <div className="text-center">
                <Database
                  className="mx-auto h-12 w-12 mb-4"
                  style={{ color: curestryColors.muted }}
                />
                <p
                  className="mb-2"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  {searchQuery || selectedTags.length > 0
                    ? 'No prompts match your search criteria'
                    : 'Your prompt-base is empty'
                  }
                </p>
                <p
                  className="text-sm"
                  style={{
                    color: curestryColors.muted,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  {searchQuery || selectedTags.length > 0
                    ? 'Try adjusting your search or filters'
                    : 'Add your first prompt to get started'
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
