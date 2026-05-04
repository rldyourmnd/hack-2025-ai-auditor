'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, CheckCircle, Zap, BarChart3, MessageSquare, Database } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiService } from "@/lib/store";

export default function Home() {
  const [isSystemHealthy, setIsSystemHealthy] = useState<boolean | null>(null);

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

  useEffect(() => {
    // Check system health on page load
    ApiService.healthCheck()
      .then(() => setIsSystemHealthy(true))
      .catch(() => setIsSystemHealthy(false));
  }, []);

  return (
    <main
      className="min-h-screen"
      style={{ backgroundColor: curestryColors.background }}
    >
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <div className="mb-8">
            <img
              src="/logo-256.png"
              alt="Curestry Logo"
              className="mx-auto w-24 h-24 mb-4"
            />
          </div>
          <h1
            className="text-5xl font-bold mb-6"
            style={{
              color: curestryColors.text,
              fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            Welcome to <span style={{ color: curestryColors.primary }}>Curestry</span>
          </h1>
          <p
            className="text-xl mb-8 leading-relaxed"
            style={{
              color: curestryColors.secondary,
              fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            AI-powered prompt analysis and optimization platform that transforms your prompts
            into high-quality, consistent, and effective instructions for better LLM results.
          </p>
          <div className="flex justify-center gap-4 mb-12">
            <Link href="/analyze">
              <button
                className="text-lg px-8 py-3 rounded-lg font-semibold transition-all hover:scale-105"
                style={{
                  backgroundColor: curestryColors.primary,
                  color: curestryColors.background,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Try It Now <ArrowRight className="ml-2 h-5 w-5 inline" />
              </button>
            </Link>
            <Link href="/dashboard">
              <button
                className="text-lg px-8 py-3 rounded-lg font-semibold border-2 transition-all hover:scale-105"
                style={{
                  backgroundColor: 'transparent',
                  color: curestryColors.accent,
                  borderColor: curestryColors.accent,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                <BarChart3 className="mr-2 h-5 w-5 inline" />
                View Dashboard
              </button>
            </Link>
            <Link href="/prompt-base">
              <button
                className="text-lg px-8 py-3 rounded-lg font-semibold border-2 transition-all hover:scale-105"
                style={{
                  backgroundColor: 'transparent',
                  color: curestryColors.secondary,
                  borderColor: curestryColors.border,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Explore Prompt-base
              </button>
            </Link>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mb-16">
          <h2
            className="text-3xl font-bold text-center mb-12"
            style={{
              color: curestryColors.text,
              fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div
              className="text-center p-6 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <div
                className="mx-auto rounded-full w-16 h-16 flex items-center justify-center mb-4"
                style={{ backgroundColor: curestryColors.primary + '20' }}
              >
                <Zap className="h-8 w-8" style={{ color: curestryColors.primary }} />
              </div>
              <h3
                className="text-xl font-bold mb-3"
                style={{
                  color: curestryColors.text,
                  fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                1. Submit Your Prompt
              </h3>
              <p
                className="text-sm"
                style={{
                  color: curestryColors.secondary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Paste your prompt and let our AI analyze it across multiple dimensions
              </p>
            </div>

            <div
              className="text-center p-6 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <div
                className="mx-auto rounded-full w-16 h-16 flex items-center justify-center mb-4"
                style={{ backgroundColor: curestryColors.success + '20' }}
              >
                <BarChart3 className="h-8 w-8" style={{ color: curestryColors.success }} />
              </div>
              <h3
                className="text-xl font-bold mb-3"
                style={{
                  color: curestryColors.text,
                  fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                2. Get Detailed Analysis
              </h3>
              <p
                className="text-sm"
                style={{
                  color: curestryColors.secondary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Receive comprehensive metrics including semantic entropy, contradictions, and quality scores
              </p>
            </div>

            <div
              className="text-center p-6 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <div
                className="mx-auto rounded-full w-16 h-16 flex items-center justify-center mb-4"
                style={{ backgroundColor: curestryColors.accent + '20' }}
              >
                <CheckCircle className="h-8 w-8" style={{ color: curestryColors.accent }} />
              </div>
              <h3
                className="text-xl font-bold mb-3"
                style={{
                  color: curestryColors.text,
                  fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                3. Apply Improvements
              </h3>
              <p
                className="text-sm"
                style={{
                  color: curestryColors.secondary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Review suggested patches and apply safe fixes to optimize your prompt quality
              </p>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-16">
          <h2
            className="text-3xl font-bold text-center mb-12"
            style={{
              color: curestryColors.text,
              fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            System Capabilities
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div
              className="p-6 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <h3
                className="flex items-center text-lg font-bold mb-3"
                style={{
                  color: curestryColors.text,
                  fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                <BarChart3 className="h-5 w-5 mr-2" style={{ color: curestryColors.primary }} />
                Multi-dimensional Analysis
              </h3>
              <p
                className="text-sm"
                style={{
                  color: curestryColors.secondary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Semantic entropy, contradiction detection, vocabulary analysis, and LLM-as-judge scoring
              </p>
            </div>

            <div
              className="p-6 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <h3
                className="flex items-center text-lg font-bold mb-3"
                style={{
                  color: curestryColors.text,
                  fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                <Zap className="h-5 w-5 mr-2" style={{ color: curestryColors.success }} />
                Smart Patch Generation
              </h3>
              <p
                className="text-sm"
                style={{
                  color: curestryColors.secondary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Automated improvement suggestions categorized as safe or risky changes
              </p>
            </div>

            <div
              className="p-6 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <h3
                className="flex items-center text-lg font-bold mb-3"
                style={{
                  color: curestryColors.text,
                  fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                <MessageSquare className="h-5 w-5 mr-2" style={{ color: curestryColors.accent }} />
                Interactive Clarification
              </h3>
              <p
                className="text-sm"
                style={{
                  color: curestryColors.secondary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                AI-generated questions to clarify ambiguous parts of your prompts
              </p>
            </div>

            <div
              className="p-6 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <h3
                className="flex items-center text-lg font-bold mb-3"
                style={{
                  color: curestryColors.text,
                  fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                <Database className="h-5 w-5 mr-2" style={{ color: curestryColors.warning }} />
                Prompt-base Management
              </h3>
              <p
                className="text-sm"
                style={{
                  color: curestryColors.secondary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Store, organize, and manage prompt relationships with conflict detection
              </p>
            </div>

            <div
              className="p-6 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <h3
                className="flex items-center text-lg font-bold mb-3"
                style={{
                  color: curestryColors.text,
                  fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                <CheckCircle className="h-5 w-5 mr-2" style={{ color: curestryColors.info }} />
                Multi-format Support
              </h3>
              <p
                className="text-sm"
                style={{
                  color: curestryColors.secondary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Works with XML, Markdown, and plain text prompts with format validation
              </p>
            </div>

            <div
              className="p-6 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <h3
                className="flex items-center text-lg font-bold mb-3"
                style={{
                  color: curestryColors.text,
                  fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                <ArrowRight className="h-5 w-5 mr-2" style={{ color: curestryColors.error }} />
                Export & Integration
              </h3>
              <p
                className="text-sm"
                style={{
                  color: curestryColors.secondary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Export optimized prompts in multiple formats (MD, XML, JSON)
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="mb-16">
          <h2
            className="text-3xl font-bold text-center mb-12"
            style={{
              color: curestryColors.text,
              fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            Pricing
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Solo Plan */}
            <div
              className="p-8 rounded-lg border relative"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <div className="text-center mb-6">
                <h3
                  className="text-2xl font-bold mb-2"
                  style={{
                    color: curestryColors.text,
                    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  🆓 Solo
                </h3>
                <div
                  className="text-3xl font-bold mb-2"
                  style={{
                    color: curestryColors.primary,
                    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  Free Forever
                </div>
                <p
                  className="text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  For individuals trying out prompt improvements.
                </p>
              </div>
              <ul className="space-y-3 mb-8">
                <li
                  className="flex items-center text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <span
                    className="mr-2"
                    style={{ color: curestryColors.success }}
                  >✓</span>
                  Basic risk detection (structure, clarity, style)
                </li>
                <li
                  className="flex items-center text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <span
                    className="mr-2"
                    style={{ color: curestryColors.success }}
                  >✓</span>
                  Up to 30 prompt checks/month
                </li>
                <li
                  className="flex items-center text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <span
                    className="mr-2"
                    style={{ color: curestryColors.success }}
                  >✓</span>
                  Works directly in your browser
                </li>
              </ul>
              <button
                className="w-full px-6 py-3 rounded-lg font-semibold border-2 transition-all hover:scale-105"
                style={{
                  backgroundColor: 'transparent',
                  color: curestryColors.primary,
                  borderColor: curestryColors.primary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Get Started Free
              </button>
            </div>

            {/* Contributor Plan */}
            <div
              className="p-8 rounded-lg border-2 relative transform scale-105"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.primary
              }}
            >
              <div
                className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor: curestryColors.primary,
                  color: curestryColors.background
                }}
              >
                POPULAR
              </div>
              <div className="text-center mb-6">
                <h3
                  className="text-2xl font-bold mb-2"
                  style={{
                    color: curestryColors.text,
                    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  👩‍💻 Contributor
                </h3>
                <div
                  className="text-3xl font-bold mb-2"
                  style={{
                    color: curestryColors.primary,
                    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  $25<span className="text-lg">/mo</span>
                </div>
                <p
                  className="text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  For regular users who rely on prompts daily.
                </p>
              </div>
              <ul className="space-y-3 mb-8">
                <li
                  className="flex items-center text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <span
                    className="mr-2"
                    style={{ color: curestryColors.success }}
                  >✓</span>
                  Everything in Solo
                </li>
                <li
                  className="flex items-center text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <span
                    className="mr-2"
                    style={{ color: curestryColors.success }}
                  >✓</span>
                  Unlimited prompt checks
                </li>
                <li
                  className="flex items-center text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <span
                    className="mr-2"
                    style={{ color: curestryColors.success }}
                  >✓</span>
                  Advanced risks (fact-check, stability)
                </li>
              </ul>
              <button
                className="w-full px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
                style={{
                  backgroundColor: curestryColors.primary,
                  color: curestryColors.background,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Start Free Trial
              </button>
            </div>

            {/* Business Plan */}
            <div
              className="p-8 rounded-lg border relative"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <div className="text-center mb-6">
                <h3
                  className="text-2xl font-bold mb-2"
                  style={{
                    color: curestryColors.text,
                    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  🏢 Business
                </h3>
                <div
                  className="text-3xl font-bold mb-2"
                  style={{
                    color: curestryColors.primary,
                    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  from $19<span className="text-lg">/user/mo</span>
                </div>
                <p
                  className="text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  For small teams and companies.
                </p>
              </div>
              <ul className="space-y-3 mb-8">
                <li
                  className="flex items-center text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <span
                    className="mr-2"
                    style={{ color: curestryColors.success }}
                  >✓</span>
                  Everything in Contributor
                </li>
                <li
                  className="flex items-center text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <span
                    className="mr-2"
                    style={{ color: curestryColors.success }}
                  >✓</span>
                  Up to 10 team seats
                </li>
                <li
                  className="flex items-center text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <span
                    className="mr-2"
                    style={{ color: curestryColors.success }}
                  >✓</span>
                  Shared history of checks
                </li>
                <li
                  className="flex items-center text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <span
                    className="mr-2"
                    style={{ color: curestryColors.success }}
                  >✓</span>
                  Export fixed prompts
                </li>
                <li
                  className="flex items-center text-sm"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  <span
                    className="mr-2"
                    style={{ color: curestryColors.success }}
                  >✓</span>
                  Priority support
                </li>
              </ul>
              <button
                className="w-full px-6 py-3 rounded-lg font-semibold border-2 transition-all hover:scale-105"
                style={{
                  backgroundColor: 'transparent',
                  color: curestryColors.secondary,
                  borderColor: curestryColors.border,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                Contact Sales
              </button>
            </div>
          </div>
        </div>

        {/* Roadmap Section */}
        <div className="mb-16">
          <h2
            className="text-3xl font-bold text-center mb-12"
            style={{
              color: curestryColors.text,
              fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            Roadmap
          </h2>
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {/* Short Term */}
              <div
                className="p-6 rounded-lg border relative"
                style={{
                  backgroundColor: curestryColors.background,
                  borderColor: curestryColors.primary,
                  borderWidth: '2px'
                }}
              >
                <div
                  className="absolute -top-3 left-6 px-3 py-1 rounded text-sm font-semibold"
                  style={{
                    backgroundColor: curestryColors.primary,
                    color: curestryColors.background
                  }}
                >
                  SHORT TERM
                </div>
                <h3
                  className="text-xl font-bold mb-4 mt-4"
                  style={{
                    color: curestryColors.primary,
                    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  0–6 months
                </h3>
                <ul className="space-y-3 text-sm">
                  <li
                    style={{
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    • Launch of an advanced service to improve AI controllability by reducing hallucinations and detecting sources of entropy and risks.
                  </li>
                  <li
                    style={{
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    • Automatic prompt checking and correction via browser extensions and IDEs.
                  </li>
                  <li
                    style={{
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    • Delivery of the first quality metrics through a simple dashboard for monitoring stability.
                  </li>
                </ul>
              </div>

              {/* Mid Term */}
              <div
                className="p-6 rounded-lg border relative"
                style={{
                  backgroundColor: curestryColors.background,
                  borderColor: curestryColors.border
                }}
              >
                <div
                  className="absolute -top-3 left-6 px-3 py-1 rounded text-sm font-semibold"
                  style={{
                    backgroundColor: curestryColors.accent,
                    color: curestryColors.background
                  }}
                >
                  MID TERM
                </div>
                <h3
                  className="text-xl font-bold mb-4 mt-4"
                  style={{
                    color: curestryColors.accent,
                    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  6–12 months
                </h3>
                <ul className="space-y-3 text-sm">
                  <li
                    style={{
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    • Transformation into a platform for deep AI analysis and control, addressing trust issues (hallucinations, jailbreaks, vulnerabilities, viruses, context loss).
                  </li>
                  <li
                    style={{
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    • Integration with CI/CD, support for team workspaces, and launch of enterprise pilots.
                  </li>
                  <li
                    style={{
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    • Ensuring AI predictability on par with classical software.
                  </li>
                </ul>
              </div>

              {/* Long Term */}
              <div
                className="p-6 rounded-lg border relative"
                style={{
                  backgroundColor: curestryColors.background,
                  borderColor: curestryColors.border
                }}
              >
                <div
                  className="absolute -top-3 left-6 px-3 py-1 rounded text-sm font-semibold"
                  style={{
                    backgroundColor: curestryColors.success,
                    color: curestryColors.background
                  }}
                >
                  LONG TERM
                </div>
                <h3
                  className="text-xl font-bold mb-4 mt-4"
                  style={{
                    color: curestryColors.success,
                    fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  2–3 years
                </h3>
                <ul className="space-y-3 text-sm">
                  <li
                    style={{
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    • Creation of a standard QA layer for AI with playgrounds for debugging agents, simulations, and real-time fixes.
                  </li>
                  <li
                    style={{
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    • Development of a compatibility matrix with providers (OpenAI, Claude, Gemini) and regression tests.
                  </li>
                  <li
                    style={{
                      color: curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    • Full threat control, enabling the era of reliable AI.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="text-center">
          <div
            className="inline-block p-6 rounded-lg border"
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
              System Status
            </h3>
            <div className="flex items-center justify-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: isSystemHealthy === null
                    ? curestryColors.warning
                    : isSystemHealthy
                    ? curestryColors.success
                    : curestryColors.error
                }}
              />
              <span
                className="font-semibold"
                style={{
                  color: curestryColors.text,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                {isSystemHealthy === null
                  ? 'Checking...'
                  : isSystemHealthy
                  ? 'All Systems Operational'
                  : 'System Offline'
                }
              </span>
            </div>
            {isSystemHealthy && (
              <p
                className="text-sm mt-2"
                style={{
                  color: curestryColors.secondary,
                  fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                ✓ Analysis Pipeline Ready ✓ Database Connected ✓ LLM Services Active
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
