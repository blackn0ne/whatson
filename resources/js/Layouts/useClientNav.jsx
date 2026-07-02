import { usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { ChannelBrandIcon } from '@/Components/BrandIcons';
import {
    LayoutDashboard, CreditCard, Package, FileText, Users, Settings,
    Layers, Webhook, Key, BookOpen, Image, Radio, Inbox, Bot, Database,
    Zap, Share2, MapPin, Tag, LifeBuoy, ExternalLink, Mail, MessageSquare,
    ShoppingBag, BarChart3, Megaphone,
} from 'lucide-react';

const iconClass = 'h-4 w-4';
const whatsappNavIcon = <ChannelBrandIcon channel="whatsapp" className={iconClass} />;

function safeRoute(name, ...args) {
    try { return route(name, ...args); } catch { return '#'; }
}

/**
 * Client sidebar navigation — grouped into a compact mini-rail (see Sidebar.jsx).
 * Keep all nav changes here only.
 */
export default function useClientNav() {
    const { auth, branding } = usePage().props;
    const { t } = useTranslation();
    const user = auth?.user;
    const docsUrl = branding?.docs_url;
    const isClientAdmin = user?.client_role === 'administrator';

    const settingsItems = [
        { label: t('nav.workspaces'), href: safeRoute('client.workspaces.index'), icon: <Layers className={iconClass} />, activePattern: 'client.workspaces.*' },
        { label: t('nav.settings'), href: safeRoute('client.settings.index'), icon: <Settings className={iconClass} />, activePattern: 'client.settings.*' },
    ];

    if (isClientAdmin) {
        settingsItems.push(
            { label: t('nav.team'), href: safeRoute('client.team.index'), icon: <Users className={iconClass} />, activePattern: 'client.team.*' },
            { label: t('nav.audit_log'), href: safeRoute('client.audit-log.index'), icon: <FileText className={iconClass} />, activePattern: 'client.audit-log.*' },
        );
    }

    settingsItems.push(
        { label: t('nav.subscription'), href: safeRoute('client.subscription.show'), icon: <CreditCard className={iconClass} />, activePattern: 'client.subscription.*' },
        { label: t('nav.billing'), href: safeRoute('client.billing.index'), icon: <CreditCard className={iconClass} />, activePattern: 'client.billing.*' },
        { label: t('nav.plans'), href: safeRoute('client.pricing'), icon: <Package className={iconClass} />, activePattern: 'client.pricing' },
        { label: t('nav.api_tokens'), href: safeRoute('client.api-tokens.index'), icon: <Key className={iconClass} />, activePattern: 'client.api-tokens.*' },
        { label: t('nav.webhooks'), href: safeRoute('client.webhooks.index'), icon: <Webhook className={iconClass} />, activePattern: 'client.webhooks.*' },
        { label: t('nav.api_docs'), href: safeRoute('client.api-docs'), icon: <BookOpen className={iconClass} />, activePattern: 'client.api-docs' },
        { label: t('nav.media_library'), href: safeRoute('client.media.index'), icon: <Image className={iconClass} />, activePattern: 'client.media.*' },
        { label: t('nav.support_tickets'), href: safeRoute('client.support.index'), icon: <LifeBuoy className={iconClass} />, activePattern: 'client.support.*' },
    );

    if (docsUrl) {
        settingsItems.push({ label: t('nav.help_docs'), href: docsUrl, icon: <ExternalLink className={iconClass} />, external: true });
    }

    return [
        {
            type: 'group',
            label: t('nav.group_account'),
            icon: <LayoutDashboard className={iconClass} />,
            items: [
                { label: t('nav.dashboard'), href: safeRoute('client.dashboard'), icon: <LayoutDashboard className={iconClass} />, activePattern: 'client.dashboard' },
            ],
        },
        {
            type: 'group',
            label: t('nav.group_inbox'),
            icon: <Inbox className={iconClass} />,
            items: [
                { label: t('nav.inbox'), href: safeRoute('client.inbox.index'), icon: <Inbox className={iconClass} />, activePattern: 'client.inbox.index' },
                { label: t('nav.channel_setup'), href: safeRoute('client.inbox.setup'), icon: <Inbox className={iconClass} />, activePattern: 'client.inbox.setup' },
            ],
        },
        {
            type: 'group',
            label: t('nav.group_social_media'),
            icon: <Share2 className={iconClass} />,
            items: [
                { label: t('nav.post_composer'), href: safeRoute('client.social.composer'), icon: <FileText className={iconClass} />, activePattern: 'client.social.composer' },
                { label: t('nav.posts'), href: safeRoute('client.social.posts.index'), icon: <Radio className={iconClass} />, activePattern: 'client.social.posts.*' },
                { label: t('nav.calendar'), href: safeRoute('client.social.calendar'), icon: <LayoutDashboard className={iconClass} />, activePattern: 'client.social.calendar' },
                { label: t('nav.social_accounts'), href: safeRoute('client.social.accounts.index'), icon: <Share2 className={iconClass} />, activePattern: 'client.social.accounts.*' },
            ],
        },
        {
            type: 'group',
            label: t('nav.group_outreach', 'Outreach'),
            icon: <Megaphone className={iconClass} />,
            items: [
                { label: t('nav.templates'), href: safeRoute('client.whatsapp.templates.index'), icon: whatsappNavIcon, activePattern: 'client.whatsapp.templates.*' },
                { label: t('nav.auto_replies'), href: safeRoute('client.whatsapp.auto-replies.index'), icon: whatsappNavIcon, activePattern: 'client.whatsapp.auto-replies.*' },
                { label: t('nav.chat_widget'), href: safeRoute('client.whatsapp.widget.index'), icon: whatsappNavIcon, activePattern: 'client.whatsapp.widget.*' },
                { label: t('nav.campaigns'), href: safeRoute('client.campaigns.index'), icon: <Radio className={iconClass} />, activePattern: 'client.campaigns.*' },
                { label: t('nav.sms_gateways'), href: safeRoute('client.sms-gateways.index'), icon: <MessageSquare className={iconClass} />, activePattern: 'client.sms-gateways.*' },
                { label: t('nav.email_server'), href: safeRoute('client.email-server.index'), icon: <Mail className={iconClass} />, activePattern: 'client.email-server.*' },
            ],
        },
        {
            type: 'group',
            label: t('nav.group_audience', 'Audience'),
            icon: <Users className={iconClass} />,
            items: [
                { label: t('nav.contacts'), href: safeRoute('client.contacts.index'), icon: <Users className={iconClass} />, activePattern: 'client.contacts.*' },
                { label: t('nav.segments'), href: safeRoute('client.segments.index'), icon: <Tag className={iconClass} />, activePattern: 'client.segments.*' },
                { label: t('nav.lead_scraper'), href: safeRoute('client.leads.index'), icon: <MapPin className={iconClass} />, activePattern: 'client.leads.*' },
            ],
        },
        {
            type: 'group',
            label: t('nav.group_automate', 'Automate'),
            icon: <Zap className={iconClass} />,
            items: [
                { label: t('nav.automations'), href: safeRoute('client.automations.index'), icon: <Zap className={iconClass} />, activePattern: 'client.automations.*' },
                { label: t('nav.chatbots'), href: safeRoute('client.ai.chatbots.index'), icon: <Bot className={iconClass} />, activePattern: 'client.ai.chatbots.*' },
                { label: t('nav.knowledge_bases'), href: safeRoute('client.ai.knowledge-bases.index'), icon: <Database className={iconClass} />, activePattern: 'client.ai.knowledge-bases.*' },
                { label: t('nav.ai_providers'), href: safeRoute('client.ai.providers.index'), icon: <Bot className={iconClass} />, activePattern: 'client.ai.providers.*' },
            ],
        },
        {
            type: 'group',
            label: t('nav.group_ecommerce'),
            icon: <ShoppingBag className={iconClass} />,
            items: [
                { label: t('nav.orders'), href: safeRoute('client.ecommerce.orders.index'), icon: <Package className={iconClass} />, activePattern: 'client.ecommerce.orders.*' },
                { label: t('nav.products'), href: safeRoute('client.ecommerce.products.index'), icon: <Tag className={iconClass} />, activePattern: 'client.ecommerce.products.*' },
                { label: t('nav.stores'), href: safeRoute('client.ecommerce.stores.index'), icon: <ShoppingBag className={iconClass} />, activePattern: 'client.ecommerce.stores.*' },
            ],
        },
        {
            type: 'group',
            label: t('nav.group_reports'),
            icon: <BarChart3 className={iconClass} />,
            items: [
                { label: t('nav.reports_inbox'), href: safeRoute('client.reports.inbox.index'), icon: <Inbox className={iconClass} />, activePattern: 'client.reports.inbox.*' },
                { label: t('nav.campaigns'), href: safeRoute('client.reports.campaigns.index'), icon: <Radio className={iconClass} />, activePattern: 'client.reports.campaigns.*' },
                { label: t('nav.automations'), href: safeRoute('client.reports.automations.index'), icon: <Zap className={iconClass} />, activePattern: 'client.reports.automations.*' },
                { label: t('nav.ai_usage'), href: safeRoute('client.reports.ai.index'), icon: <Bot className={iconClass} />, activePattern: 'client.reports.ai.*' },
                { label: t('nav.social'), href: safeRoute('client.reports.social.index'), icon: <Share2 className={iconClass} />, activePattern: 'client.reports.social.*' },
            ],
        },
        {
            type: 'group',
            label: t('nav.group_settings', 'Settings'),
            icon: <Settings className={iconClass} />,
            items: settingsItems,
        },
    ];
}
