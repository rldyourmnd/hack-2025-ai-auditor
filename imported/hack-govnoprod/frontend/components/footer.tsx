'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Chrome, Code } from 'lucide-react';

export function Footer() {
  // Curestry brand colors
  const curestryColors = {
    text: '#ffffff',
    background: '#000000',
    primary: '#2AC8AA',
    secondary: '#b9d1cc',
    accent: '#27c7fb',
    border: '#333333',
    muted: '#888888'
  };

  const handleDownload = (fileName: string, displayName: string) => {
    const link = document.createElement('a');
    link.href = `/${fileName}`;
    link.download = fileName;
    link.click();

    // Optional: Track download analytics
    console.log(`Downloading ${displayName}: ${fileName}`);
  };

  return (
    <footer
      className="border-t"
      style={{
        backgroundColor: curestryColors.background,
        borderColor: curestryColors.border
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8 items-center">
          {/* Logo and Description */}
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start mb-4">
              <img
                src="/logo-64.png"
                alt="Curestry Logo"
                className="w-8 h-8 mr-3"
              />
              <h3
                className="text-xl font-bold"
                style={{
                  color: curestryColors.text,
                  fontFamily: "'Montserrat', system-ui"
                }}
              >
                Curestry
              </h3>
            </div>
            <p
              className="text-sm leading-relaxed max-w-sm"
              style={{
                color: curestryColors.secondary,
                fontFamily: "'Open Sans', system-ui"
              }}
            >
              AI-powered prompt analysis and optimization platform for Large Language Models
            </p>
          </div>

          {/* Extensions Download Section */}
          <div className="text-center">
            <h4
              className="text-lg font-semibold mb-4"
              style={{
                color: curestryColors.primary,
                fontFamily: "'Montserrat', system-ui"
              }}
            >
              Curestry Extensions
            </h4>
            <p
              className="text-sm mb-6"
              style={{
                color: curestryColors.secondary,
                fontFamily: "'Open Sans', system-ui"
              }}
            >
              Use Curestry directly in your browser or IDE
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {/* Browser Extension */}
              <Button
                onClick={() => handleDownload('browser_curestry.zip', 'Расширение для браузера')}
                className="flex items-center px-4 py-2 rounded-lg font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: curestryColors.accent,
                  color: curestryColors.background,
                  fontFamily: "'Open Sans', system-ui"
                }}
              >
                <Chrome className="h-4 w-4 mr-2" />
                Download for Browser
              </Button>

              {/* IDE Extension */}
              <Button
                onClick={() => handleDownload('ide_curestry.vsix', 'Расширение для IDE')}
                className="flex items-center px-4 py-2 rounded-lg font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: curestryColors.primary,
                  color: curestryColors.background,
                  fontFamily: "'Open Sans', system-ui"
                }}
              >
                <Code className="h-4 w-4 mr-2" />
                Download for IDE
              </Button>
            </div>

            {/* Installation Instructions */}
            <div className="mt-4 text-xs space-y-1">
              <div
                style={{
                  color: curestryColors.muted,
                  fontFamily: "'Open Sans', system-ui"
                }}
              >
                <span style={{ color: curestryColors.accent }}>Browser:</span> Chrome → Extensions → Developer mode → Load unpacked
              </div>
              <div
                style={{
                  color: curestryColors.muted,
                  fontFamily: "'Open Sans', system-ui"
                }}
              >
                <span style={{ color: curestryColors.primary }}>VS Code:</span> Extensions → Install from VSIX → Select .vsix file
              </div>
            </div>
          </div>

          {/* Company Info */}
          <div className="text-center md:text-right">
            <div className="space-y-3">
              <div>
                <h4
                  className="text-sm font-semibold mb-2"
                  style={{
                    color: curestryColors.primary,
                    fontFamily: "'Montserrat', system-ui"
                  }}
                >
                  Contact
                </h4>
                <div
                  className="text-sm space-y-1"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui"
                  }}
                >
                  <div>support@curestry.ai</div>
                  <div>docs@curestry.ai</div>
                </div>
              </div>

              <div>
                <h4
                  className="text-sm font-semibold mb-2"
                  style={{
                    color: curestryColors.primary,
                    fontFamily: "'Montserrat', system-ui"
                  }}
                >
                  Links
                </h4>
                <div
                  className="text-sm space-y-1"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui"
                  }}
                >
                  <a
                    href="https://github.com/rldyourmnd/hackathon-ai-auditor-agent"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 cursor-pointer block"
                  >
                    GitHub
                  </a>
                  <a
                    href="/docs"
                    className="hover:opacity-80 cursor-pointer block"
                  >
                    API Docs
                  </a>
                  <a
                    href="/articles"
                    className="hover:opacity-80 cursor-pointer block"
                  >
                    Articles
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright Section */}
        <div
          className="mt-8 pt-6 border-t text-center"
          style={{ borderColor: curestryColors.border }}
        >
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <p
              className="text-sm"
              style={{
                color: curestryColors.muted,
                fontFamily: "'Open Sans', system-ui"
              }}
            >
              © 2025 Curestry. All rights reserved.
            </p>
            <div className="flex items-center mt-2 sm:mt-0">
              <span
                className="text-xs mr-2"
                style={{
                  color: curestryColors.muted,
                  fontFamily: "'Open Sans', system-ui"
                }}
              >
                Powered by AI
              </span>
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: curestryColors.primary }}
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
