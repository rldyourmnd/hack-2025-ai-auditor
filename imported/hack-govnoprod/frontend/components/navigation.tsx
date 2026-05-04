'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BarChart3, Database, Home, Play, BookOpen, FileText, Settings } from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();

  // Admin is now integrated in the main app
  const adminActive = pathname === '/admin';

  // Curestry brand colors - правильный черный фон
  const curestryColors = {
    text: '#ffffff',
    background: '#000000',
    primary: '#2AC8AA',
    secondary: '#b9d1cc',
    accent: '#27c7fb',
    border: '#333333',
    muted: '#888888'
  };

  const navItems = [
    {
      href: '/',
      label: 'Home',
      icon: Home,
      active: pathname === '/',
    },
    {
      href: '/analyze',
      label: 'Analyze',
      icon: BarChart3,
      active: pathname === '/analyze',
    },
    {
      href: '/demo',
      label: 'Demo',
      icon: Play,
      active: pathname === '/demo',
    },
    {
      href: '/articles',
      label: 'Articles',
      icon: FileText,
      active: pathname === '/articles' || pathname?.startsWith('/articles/'),
    },
    {
      href: '/docs',
      label: 'Docs',
      icon: BookOpen,
      active: pathname === '/docs',
    },
    {
      href: '/prompt-base',
      label: 'Prompt-base',
      icon: Database,
      active: pathname === '/prompt-base',
    },
  ];

  return (
    <nav
      className="border-b backdrop-blur"
      style={{
        backgroundColor: curestryColors.background,
        borderBottomColor: curestryColors.border
      }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <img
              src="/logo-64.png"
              alt="Curestry"
              className="w-8 h-8"
            />
            <span
              className="text-xl font-bold"
              style={{
                color: curestryColors.text,
                fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
              }}
            >
              Curestry
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <button
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                    style={{
                      backgroundColor: item.active ? curestryColors.primary : 'transparent',
                      color: item.active ? curestryColors.background : curestryColors.secondary,
                      fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>

          {/* Right side - Admin button and version */}
          <div className="flex items-center space-x-2">
            <Link
              href="/admin"
              className="flex items-center space-x-2 px-3 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
              style={{
                backgroundColor: adminActive ? curestryColors.accent : curestryColors.accent + '20',
                borderColor: curestryColors.accent,
                color: adminActive ? curestryColors.background : curestryColors.accent,
                fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                border: '1px solid ' + curestryColors.accent
              }}
            >
              <Settings className="h-3 w-3" />
              <span>Admin</span>
            </Link>
            <div
              className="text-sm"
              style={{
                color: curestryColors.muted,
                fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
              }}
            >
              v1.0.0
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
