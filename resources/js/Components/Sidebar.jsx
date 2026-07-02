import { Link, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';

export const SIDEBAR_MINI_WIDTH = '4rem'; // w-16
export const SIDEBAR_EXPANDED_WIDTH = '16rem'; // w-64

function resolveItemHref(item) {
    if (item.href) return item.href;
    if (item.route) {
        try {
            return route(item.route);
        } catch {
            return '#';
        }
    }
    return '#';
}

function isItemActive(item) {
    if (typeof item.active === 'function') return item.active();
    if (item.route) {
        try {
            return route().current(item.route);
        } catch {
            return false;
        }
    }
    return Boolean(item.active);
}

function isGroupActive(items = []) {
    return items.some((item) => isItemActive(item));
}

function NavLink({ item, onClose, showLabel = true, compact = false, className = '' }) {
    const isActive = isItemActive(item);
    const href = resolveItemHref(item);
    const classes = [
        'group flex items-center rounded-lg text-sm font-medium transition-all duration-150',
        compact ? 'h-10 w-10 justify-center shrink-0 lg:group-hover/sidebar:h-auto lg:group-hover/sidebar:w-full lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-2.5 lg:group-hover/sidebar:px-3 lg:group-hover/sidebar:py-2' : 'gap-2.5 px-3 py-2',
        isActive
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-white/80 hover:bg-white/10 hover:text-white',
        className,
    ].join(' ');

    const content = (
        <>
            {item.icon && (
                <span
                    className={[
                        'shrink-0 transition-colors duration-150',
                        isActive ? 'text-white' : 'text-white/65 group-hover:text-white',
                    ].join(' ')}
                >
                    {item.icon}
                </span>
            )}
            {showLabel && (
                <span className={[
                    'truncate',
                    compact ? 'hidden lg:group-hover/sidebar:inline' : '',
                ].join(' ')}>
                    {item.label}
                </span>
            )}
            {showLabel && isActive && (
                <span className={[
                    'ml-auto h-1.5 w-1.5 rounded-full bg-white/70 shrink-0',
                    compact ? 'hidden lg:group-hover/sidebar:block' : '',
                ].join(' ')} />
            )}
        </>
    );

    if (item.external) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className={classes}
                title={compact ? item.label : undefined}
            >
                {content}
            </a>
        );
    }

    return (
        <Link
            href={href}
            onClick={onClose}
            className={classes}
            title={compact ? item.label : undefined}
        >
            {content}
        </Link>
    );
}

function NavRailIcon({ group, onClose }) {
    const items = group.items ?? [];
    const activeItem = items.find((item) => isItemActive(item));
    const targetItem = activeItem ?? items[0];
    if (!targetItem) return null;

    const isActive = isGroupActive(items);
    const href = resolveItemHref(targetItem);
    const icon = group.icon ?? targetItem.icon;
    const classes = [
        'group flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150',
        isActive
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-white/75 hover:bg-white/10 hover:text-white',
    ].join(' ');

    const inner = (
        <span className={isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}>
            {icon}
        </span>
    );

    if (targetItem.external) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className={classes}
                title={group.label}
                aria-label={group.label}
            >
                {inner}
            </a>
        );
    }

    return (
        <Link
            href={href}
            onClick={onClose}
            className={classes}
            title={group.label}
            aria-label={group.label}
        >
            {inner}
        </Link>
    );
}

function NavGroupExpanded({ label, items, onClose }) {
    return (
        <div className="mb-1">
            <div className="px-3 py-1.5 mt-2 text-[10px] font-bold uppercase tracking-widest text-white/55 select-none truncate">
                {label}
            </div>
            <div className="mt-0.5 space-y-0.5">
                {items.map((item, i) => (
                    <NavLink
                        key={item.key ?? item.route ?? item.href ?? i}
                        item={item}
                        onClose={onClose}
                    />
                ))}
            </div>
        </div>
    );
}

function SidebarBrand({ logo, logoUrl, appName }) {
    if (logo) {
        return (
            <div className="flex h-14 shrink-0 items-center border-b border-white/8 px-4">
                {logo}
            </div>
        );
    }

    return (
        <div className="flex h-14 shrink-0 items-center border-b border-white/8 px-3 lg:justify-center lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:px-4">
            {logoUrl ? (
                <>
                    <img
                        src={logoUrl}
                        alt={appName}
                        className="hidden h-7 max-w-[140px] object-contain lg:group-hover/sidebar:block"
                    />
                    <img
                        src={logoUrl}
                        alt={appName}
                        className="h-8 w-8 rounded-md object-contain lg:group-hover/sidebar:hidden"
                    />
                </>
            ) : logo ? (
                logo
            ) : (
                <>
                    <img
                        src="/whatsmine-logo.png"
                        alt={appName}
                        className="hidden h-10 w-auto max-w-[200px] object-contain lg:group-hover/sidebar:block"
                    />
                    <img
                        src="/whatsmine-logo.png"
                        alt={appName}
                        className="h-9 w-9 object-contain lg:group-hover/sidebar:hidden"
                    />
                </>
            )}
        </div>
    );
}

function SidebarPanel({
    navItems = [],
    navGroups = [],
    onClose,
    footer,
    logo,
    showCreateButton = true,
    miniRail = true,
    mobile = false,
}) {
    const { t } = useTranslation();
    const appName = import.meta.env.VITE_APP_NAME || 'WhatsMine';
    const { branding } = usePage().props;
    const logoUrl = branding?.logo_url;
    const useMiniRail = miniRail && !mobile && navGroups.length > 0;

    return (
        <aside className="flex h-full w-full flex-col bg-secondary-900 dark:bg-neutral-900">
            <SidebarBrand logo={logo} logoUrl={logoUrl} appName={appName} />

            {showCreateButton && (
                <div className="shrink-0 border-b border-white/8 p-2 lg:px-2 lg:group-hover/sidebar:p-3 lg:group-hover/sidebar:pb-2">
                    <button
                        type="button"
                        className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 transition duration-150 lg:h-10 lg:w-10 lg:p-0 lg:group-hover/sidebar:h-auto lg:group-hover/sidebar:w-full lg:group-hover/sidebar:px-3 lg:group-hover/sidebar:py-2"
                        title={t('common.create')}
                    >
                        <Plus className="h-4 w-4 shrink-0" />
                        <span className={miniRail && !mobile ? 'hidden lg:group-hover/sidebar:inline' : ''}>
                            {t('common.create')}
                        </span>
                    </button>
                </div>
            )}

            <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                {useMiniRail && (
                    <div className="flex flex-col items-center gap-1 px-2 lg:group-hover/sidebar:hidden">
                        {navGroups.map((group, gi) => (
                            <NavRailIcon
                                key={`rail-${gi}-${group.label ?? ''}`}
                                group={group}
                                onClose={onClose}
                            />
                        ))}
                    </div>
                )}

                {(navGroups.length > 0 && (!useMiniRail || mobile)) && (
                    <div className="px-2">
                        {navGroups.map((group, gi) => (
                            <NavGroupExpanded
                                key={`${gi}-${group.key ?? group.label ?? ''}`}
                                label={group.label}
                                items={group.items ?? []}
                                onClose={onClose}
                            />
                        ))}
                    </div>
                )}

                {useMiniRail && (
                    <div className="hidden px-2 lg:group-hover/sidebar:block">
                        {navGroups.map((group, gi) => (
                            <NavGroupExpanded
                                key={`expanded-${gi}-${group.key ?? group.label ?? ''}`}
                                label={group.label}
                                items={group.items ?? []}
                                onClose={onClose}
                            />
                        ))}
                    </div>
                )}

                {navGroups.length === 0 && (
                    <div className={`px-2 ${miniRail && !mobile ? 'lg:flex lg:flex-col lg:items-center lg:gap-1 lg:group-hover/sidebar:items-stretch' : ''}`}>
                        {navItems.map((item, i) => {
                            if (item.type === 'divider') {
                                return <hr key={`div-${i}`} className="my-2 w-full border-white/10" />;
                            }
                            return (
                                <NavLink
                                    key={item.key ?? item.route ?? item.href ?? i}
                                    item={item}
                                    onClose={onClose}
                                    compact={miniRail && !mobile}
                                />
                            );
                        })}
                    </div>
                )}
            </nav>

            {footer && (
                <div className="shrink-0 border-t border-white/8 p-2 lg:px-2 lg:group-hover/sidebar:p-3">
                    <div className="text-white/55 lg:hidden lg:group-hover/sidebar:block">
                        {footer}
                    </div>
                </div>
            )}
        </aside>
    );
}

export default function Sidebar({
    navItems = [],
    navGroups = [],
    open = false,
    onClose,
    footer,
    logo,
    showCreateButton = true,
    miniRail = true,
}) {
    const { t } = useTranslation();

    return (
        <>
            {/* Desktop: mini rail, expands on hover */}
            <div
                className={[
                    'hidden lg:fixed lg:inset-y-0 lg:z-30 lg:left-0 rtl:lg:left-auto rtl:lg:right-0',
                    miniRail ? 'group/sidebar lg:w-16 lg:hover:w-64 lg:transition-[width] lg:duration-200 lg:ease-out lg:overflow-hidden lg:hover:shadow-2xl' : 'lg:w-64 lg:flex lg:flex-col',
                ].join(' ')}
            >
                <SidebarPanel
                    navItems={navItems}
                    navGroups={navGroups}
                    onClose={onClose}
                    footer={footer}
                    logo={logo}
                    showCreateButton={showCreateButton}
                    miniRail={miniRail}
                    mobile={false}
                />
            </div>

            {/* Mobile: overlay + drawer */}
            {open && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
                    <div className="fixed inset-y-0 left-0 w-64 shadow-2xl rtl:left-auto rtl:right-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition"
                            aria-label={t('ui.close_menu')}
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <SidebarPanel
                            navItems={navItems}
                            navGroups={navGroups}
                            onClose={onClose}
                            footer={footer}
                            logo={logo}
                            showCreateButton={showCreateButton}
                            miniRail={false}
                            mobile
                        />
                    </div>
                </div>
            )}
        </>
    );
}
