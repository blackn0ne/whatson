'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Users,
  Settings,
  Shield,
  Activity,
  Menu,
  QrCode,
  Bot,
  Terminal,
  Phone,
  ChevronRight,
  LifeBuoy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { MemberPermissions } from '@/lib/permissions';

const fetcher = (url: string) => fetch(url).then((res) => res.json());
type MembershipData = { role: string; permissions: MemberPermissions };

const RESTRICTED_SETTINGS: string[] = ['/settings/connect', '/settings/ai', '/settings/voice', '/settings/developers'];

export default function SettingsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('SettingsLayout');
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { data: membership } = useSWR<MembershipData>('/api/team/membership', fetcher);

  const isOwnerOrHasSettings = membership?.role === 'owner' || membership?.permissions?.settings === true;

  const allNavItems = [
    {
      href: '/settings',
      icon: Users,
      label: t('nav.team'),
      description: t('nav.team_desc'),
      restricted: false,
    },
    {
      href: '/settings/general',
      icon: Settings,
      label: t('nav.general'),
      description: t('nav.general_desc'),
      restricted: false,
    },
    {
      href: '/settings/connect',
      icon: QrCode,
      label: t('nav.instances'),
      description: t('nav.instances_desc'),
      restricted: true,
    },
    {
      href: '/settings/ai',
      icon: Bot,
      label: t('nav.ai'),
      description: t('nav.ai_desc'),
      restricted: true,
    },
    {
      href: '/settings/voice',
      icon: Phone,
      label: t('nav.voice'),
      description: t('nav.voice_desc'),
      restricted: true,
    },
    {
      href: '/settings/developers',
      icon: Terminal,
      label: t('nav.developers'),
      description: t('nav.developers_desc'),
      restricted: true,
    },
    {
      href: '/settings/activity',
      icon: Activity,
      label: t('nav.activity'),
      description: t('nav.activity_desc'),
      restricted: false,
    },
    {
      href: '/settings/security',
      icon: Shield,
      label: t('nav.security'),
      description: t('nav.security_desc'),
      restricted: false,
    }
  ];

  const navItems = allNavItems.filter(item => {
    if (!item.restricted) return true;
    return isOwnerOrHasSettings;
  });

  return (
    <div className="flex flex-col h-full w-full bg-background">
      
      <div className="lg:hidden flex items-center justify-between bg-card border-b p-4 shadow-sm sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <span className="font-semibold text-lg tracking-tight">{t('header')}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hover:bg-primary/10 active:scale-95 transition-transform"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden h-full relative">
        
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden animate-in fade-in duration-200"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 bg-card border-r shadow-2xl lg:shadow-none lg:static lg:flex flex-col transition-transform duration-300 ease-in-out h-full",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="p-6 border-b hidden lg:flex items-center gap-3 shrink-0">
             <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                <Settings className="h-6 w-6" />
             </div>
             <div>
                <h2 className="font-bold text-lg leading-none">{t('header')}</h2>
                <p className="text-xs text-muted-foreground mt-1">{t('sub_header')}</p>
             </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={() => setIsSidebarOpen(false)}>
                  <div
                    className={cn(
                      "group flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 border cursor-pointer select-none",
                      isActive 
                        ? "bg-primary/5 border-primary/20 shadow-sm" 
                        : "border-transparent hover:bg-muted/50 hover:border-border/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex items-center justify-center h-10 w-10 rounded-lg transition-colors duration-200",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-md" 
                          : "bg-muted text-muted-foreground group-hover:bg-background group-hover:text-foreground group-hover:shadow-sm"
                      )}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex flex-col">
                        <span className={cn(
                          "text-sm font-semibold transition-colors",
                          isActive ? "text-primary" : "text-foreground group-hover:text-foreground"
                        )}>
                          {item.label}
                        </span>
                        <span className={cn(
                          "text-[11px] transition-colors hidden xl:block",
                          isActive ? "text-primary/70" : "text-muted-foreground group-hover:text-muted-foreground/80"
                        )}>
                            {item.description}
                        </span>
                      </div>
                    </div>
                    
                    {isActive && (
                        <ChevronRight className="h-4 w-4 text-primary animate-in slide-in-from-left-2 fade-in duration-300" />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
          
          <div className="p-4 border-t bg-muted/10 mt-auto shrink-0">
            <div className="bg-gradient-to-br from-card to-muted border rounded-xl p-4 shadow-sm flex gap-3 items-start">
                <div className="bg-background p-2 rounded-full shrink-0 shadow-sm">
                    <LifeBuoy className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                    <p className="text-xs font-semibold text-foreground">{t('footer.help')}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                        {t('footer.desc')}
                    </p>
                </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-muted/5 p-4 lg:p-8 scroll-smooth w-full">
            <div className="max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                {children}
            </div>
        </main>
      </div>
    </div>
  );
}