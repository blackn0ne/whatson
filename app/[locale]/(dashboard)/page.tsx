import Link from 'next/link';
import { 
  ArrowRight, 
  CheckCircle2, 
  MessageSquare, 
  Zap, 
  Users, 
  BarChart3, 
  Smartphone,
  Bot,
  Search,
  MoreVertical,
  Paperclip,
  Send,
  LayoutDashboard,
  Settings,
  Phone,
  Inbox,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPublishedPlans } from '@/lib/db/queries';
import { getBranding } from '@/lib/db/queries/branding';
import Logo from '@/components/interface/Logo';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server'; 




function DashboardPreview() {
  const t = useTranslations('LandingPage.preview');

  return (
    <div className="relative mx-auto max-w-6xl w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
      <div className="relative rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden ring-1 ring-white/10">
        
        <div className="flex items-center justify-between border-b border-border/40 bg-muted/40 px-4 py-3 backdrop-blur-md">
          <div className="flex gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-500/80" />
          </div>
          <div className="h-6 w-1/3 rounded-md bg-background/50 border border-border/30 text-[10px] flex items-center justify-center text-muted-foreground font-mono">
            {t('url_bar')}
          </div>
          <div className="w-10" />
        </div>

        <div className="flex h-[600px] bg-background">
          
          <div className="w-[70px] border-r border-border/40 flex flex-col items-center py-6 gap-6 bg-card/50">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <Logo showName={false} />
            </div>
            <div className="flex flex-col gap-4 mt-4 w-full px-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Inbox className="h-5 w-5" /></div>
              <div className="h-10 w-10 rounded-lg hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors"><LayoutDashboard className="h-5 w-5" /></div>
              <div className="h-10 w-10 rounded-lg hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors"><Users className="h-5 w-5" /></div>
              <div className="h-10 w-10 rounded-lg hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors"><Zap className="h-5 w-5" /></div>
            </div>
            <div className="mt-auto h-10 w-10 rounded-full bg-muted border border-border" />
          </div>

          <div className="w-80 border-r border-border/40 flex flex-col bg-background/50 backdrop-blur-sm hidden md:flex">
            <div className="p-4 border-b border-border/40">
              <h2 className="font-semibold text-lg mb-4">{t('inbox_title')}</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <div className="h-10 w-full rounded-lg border border-border bg-muted/30 pl-9 flex items-center text-sm text-muted-foreground">{t('search_placeholder')}</div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-2 space-y-2">
              {[
                { name: "Alice Freeman", msg: t('chat_1_msg'), time: "10:23 AM", active: true, unread: 0 },
                { name: "Tech Solutions", msg: t('chat_2_msg'), time: "09:45 AM", active: false, unread: 2 },
                { name: "John Doe", msg: t('chat_3_msg'), time: "Yesterday", active: false, unread: 0 },
                { name: "Sarah Smith", msg: t('chat_4_msg'), time: "Yesterday", active: false, unread: 0 },
              ].map((chat, i) => (
                <div key={i} className={`p-3 rounded-xl flex gap-3 cursor-default ${chat.active ? 'bg-primary/5 border border-primary/10' : 'hover:bg-muted/50 border border-transparent'}`}>
                  <div className="relative">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold ${chat.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {chat.name.substring(0, 2).toUpperCase()}
                    </div>
                    {chat.active && <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background"></div>}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm truncate">{chat.name}</span>
                      <span className="text-[10px] text-muted-foreground">{chat.time}</span>
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{chat.msg}</span>
                      {chat.unread > 0 && <span className="h-4 min-w-[16px] px-1 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-bold">{chat.unread}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-background relative">
            <div className="h-16 border-b border-border/40 flex items-center justify-between px-6 bg-background/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">AF</div>
                <div>
                  <h3 className="font-semibold text-sm">Alice Freeman</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-muted-foreground">{t('status_online')}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"><Phone className="h-4 w-4 text-muted-foreground" /></div>
                <div className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"><MoreVertical className="h-4 w-4 text-muted-foreground" /></div>
              </div>
            </div>

            <div className="flex-1 p-6 space-y-6 overflow-hidden relative">
              <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.03] dark:opacity-[0.05]"></div>
              
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] text-sm text-foreground shadow-sm">
                  {t('demo_msg_1')}
                  <span className="block text-[10px] text-muted-foreground mt-1 text-right">10:20 AM</span>
                </div>
              </div>

              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] text-sm text-foreground shadow-sm">
                  {t('demo_msg_2')}
                  <span className="block text-[10px] text-muted-foreground mt-1 text-right">10:21 AM</span>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] text-sm shadow-sm relative group">
                  <div className="flex items-center gap-1.5 mb-2 text-primary font-medium text-xs uppercase tracking-wide">
                    <Bot className="h-3 w-3" /> {t('ai_badge')}
                  </div>
                  {t('demo_ai_response')}
                  <span className="block text-[10px] text-primary/60 mt-1 text-right">10:21 AM</span>
                </div>
              </div>

              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] text-sm text-foreground shadow-sm">
                  {t('demo_msg_3')}
                  <span className="block text-[10px] text-muted-foreground mt-1 text-right">10:23 AM</span>
                </div>
              </div>

              <div className="flex justify-center py-2">
                 <Badge variant="outline" className="bg-background/80 backdrop-blur text-xs text-muted-foreground font-normal shadow-sm">
                    {t('ai_typing')}
                 </Badge>
              </div>
            </div>

            <div className="p-4 border-t border-border/40 bg-background">
              <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-xl border border-border/50">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><Plus className="h-5 w-5" /></Button>
                <div className="h-6 w-[1px] bg-border" />
                <input className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground" placeholder="Type a message or / for commands..." />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><Paperclip className="h-4 w-4" /></Button>
                <Button size="icon" className="h-8 w-8 rounded-lg"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>

          <div className="w-72 border-l border-border/40 bg-muted/5 hidden lg:block p-5">
             <div className="flex flex-col items-center mb-6">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mb-3 flex items-center justify-center text-2xl font-bold text-primary">AF</div>
                <h3 className="font-bold text-lg">Alice Freeman</h3>
                <p className="text-sm text-muted-foreground">+1 (555) 012-3456</p>
             </div>

             <div className="space-y-6">
                <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t('crm_funnel')}</h4>
                    <div className="bg-background border border-border rounded-lg p-3 shadow-sm flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        <span className="text-sm font-medium">{t('crm_stage_negotiation')}</span>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t('crm_tags')}</h4>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{t('crm_tag_hot')}</Badge>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{t('crm_tag_api')}</Badge>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t('crm_actions')}</h4>
                    <div className="space-y-2">
                        <Button variant="outline" className="w-full justify-start h-9 text-sm"><Settings className="h-4 w-4 mr-2" /> {t('crm_action_assign')}</Button>
                        <Button variant="outline" className="w-full justify-start h-9 text-sm"><Bot className="h-4 w-4 mr-2" /> {t('crm_action_pause')}</Button>
                    </div>
                </div>
             </div>
          </div>

        </div>
      </div>
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/5 blur-[100px] -z-10 rounded-[50%]" />
    </div>
  );
}

function LogoCarousel() {
  const t = useTranslations('LandingPage.social_proof');
  const logos = ["TechCorp", "SalesFlow", "AutoChat", "MarketUp", "GrowFast", "NextLevel"];
  return (
    <div className="w-full py-12 border-y border-border/40 bg-muted/20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-sm font-medium text-muted-foreground mb-8 uppercase tracking-widest">
          {t('trusted_by')}
        </p>
        <div className="flex justify-between items-center gap-8 md:gap-20 opacity-50 grayscale hover:grayscale-0 transition-all duration-500 flex-wrap md:flex-nowrap justify-center">
          {logos.map((logo, i) => (
            <div key={i} className="text-xl font-bold font-mono tracking-tighter flex items-center gap-2 select-none">
               <div className="w-6 h-6 bg-foreground rounded-md opacity-20"></div>
               {logo}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, delay }: { icon: any, title: string, description: string, delay: string }) {
  return (
    <div className={`group p-6 rounded-2xl border border-border/50 bg-card hover:border-primary/20 hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${delay}`}>
      <div className="h-12 w-12 rounded-lg bg-primary/5 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}



export default async function HomePage() {
  
  const t = await getTranslations('LandingPage'); 
  
  const plans = await getPublishedPlans();
  const branding = await getBranding();
  const siteName = branding?.name || 'WhatSaaS';

  return (
    <main className="flex flex-col min-h-screen bg-background selection:bg-primary/20">
      
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 rounded-full text-sm border-primary/20 bg-primary/5 text-primary font-medium animate-in fade-in zoom-in duration-500">
            {t('hero.badge')}
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 leading-[1.1]">
            {t('hero.title_part1')} <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              {t('hero.title_part2')}
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            {t('hero.subtitle')}
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <Link href="/sign-up">
              <Button size="lg" className="rounded-full px-8 h-12 text-base shadow-primary/25 shadow-lg hover:shadow-primary/40 transition-all">
                {t('hero.cta_primary')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="rounded-full px-8 h-12 text-base backdrop-blur-sm bg-background/50">
                {t('hero.cta_secondary')}
              </Button>
            </Link>
          </div>

          <DashboardPreview />
        </div>
      </section>

      <LogoCarousel />

      <section id="features" className="py-24 bg-background relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('features.title')}</h2>
            <p className="text-muted-foreground text-lg">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={Zap} 
              title={t('features.card_flow_title')} 
              description={t('features.card_flow_desc')} 
              delay="delay-0"
            />
            <FeatureCard 
              icon={Bot} 
              title={t('features.card_ai_title')} 
              description={t('features.card_ai_desc')} 
              delay="delay-100"
            />
            <FeatureCard 
              icon={MessageSquare} 
              title={t('features.card_inbox_title')} 
              description={t('features.card_inbox_desc')} 
              delay="delay-200"
            />
            <FeatureCard 
              icon={Smartphone} 
              title={t('features.card_multi_title')} 
              description={t('features.card_multi_desc')} 
              delay="delay-300"
            />
            <FeatureCard 
              icon={Users} 
              title={t('features.card_team_title')} 
              description={t('features.card_team_desc')} 
              delay="delay-400"
            />
            <FeatureCard 
              icon={BarChart3} 
              title={t('features.card_campaigns_title')} 
              description={t('features.card_campaigns_desc')} 
              delay="delay-500"
            />
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 bg-muted/30 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('pricing.title')}</h2>
            <p className="text-muted-foreground text-lg">
              {t('pricing.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => {
              const isPopular = index === 1;
              return (
                <div 
                  key={plan.id} 
                  className={`relative flex flex-col p-8 rounded-2xl border bg-card transition-all duration-300 hover:shadow-xl ${isPopular ? 'border-primary shadow-lg shadow-primary/10 scale-105 z-10' : 'border-border'}`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                      {t('pricing.most_popular')}
                    </div>
                  )}
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold">${plan.amount / 100}</span>
                    <span className="text-muted-foreground">/{plan.interval === 'month' ? t('pricing.interval_month') : t('pricing.interval_year')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6 min-h-[40px]">{plan.description || "Perfect for getting started."}</p>
                  
                  <ul className="space-y-3 mb-8 flex-1">
                    <li className="flex items-center text-sm gap-3">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> {t('pricing.features.users', {count: plan.maxUsers})}
                    </li>
                    <li className="flex items-center text-sm gap-3">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> {t('pricing.features.connections', {count: plan.maxInstances})}
                    </li>
                    <li className="flex items-center text-sm gap-3">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> {t('pricing.features.contacts', {count: plan.maxContacts.toLocaleString()})}
                    </li>
                    {plan.isAiEnabled && (
                        <li className="flex items-center text-sm gap-3">
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> {t('pricing.features.ai')}
                        </li>
                    )}
                    {plan.isFlowBuilderEnabled && (
                        <li className="flex items-center text-sm gap-3">
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> {t('pricing.features.flow')}
                        </li>
                    )}
                  </ul>

                  <Link href={`/sign-up?priceId=${plan.stripePriceId}`}>
                    <Button 
                        className={`w-full rounded-full h-11 text-sm font-semibold ${isPopular ? 'bg-primary hover:bg-primary/90' : 'bg-secondary hover:bg-secondary/80 text-foreground'}`}
                    >
                      {t('pricing.get_started')}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
            {t('cta_final.title')}
          </h2>
          <p className="text-xl text-muted-foreground mb-10">
            {t('cta_final.subtitle')}
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="rounded-full px-10 h-14 text-lg shadow-xl shadow-primary/20">
              {t('cta_final.button')}
            </Button>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">{t('cta_final.disclaimer')}</p>
        </div>
      </section>

      <footer className="border-t border-border py-12 bg-muted/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <Logo />
          <div className="flex gap-8 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">{t('footer.terms')}</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">{t('footer.privacy')}</Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">{t('footer.docs')}</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">{t('footer.contact')}</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {siteName}. {t('footer.rights')}
          </p>
        </div>
      </footer>
    </main>
  );
}