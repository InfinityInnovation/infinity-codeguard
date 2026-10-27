'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  CONFIGURATION_NAVIGATION,
  SECURITY_NAVIGATION,
  WORKSPACE_NAVIGATION,
} from '../model/navigation';
import type { NavigationItem, WorkspaceView } from '../model/navigation';

type SidebarProps = {
  activeView: WorkspaceView;
  organization?: { name: string; role: string };
  onSelect: (view: WorkspaceView) => void;
};

export function Sidebar({ activeView, organization, onSelect }: SidebarProps) {
  const t = useTranslations('dashboard');
  return (
    <aside className="cg-sidebar">
      <div className="cg-brand">
        <span>∞</span>
        <div>
          <strong>Infinity CodeGuard</strong>
          <small>Open Source DevSecOps</small>
        </div>
      </div>
      <nav aria-label={t('mainNavigation')}>
        <NavigationGroup
          heading={t('workspace')}
          items={WORKSPACE_NAVIGATION}
          activeView={activeView}
          onSelect={onSelect}
        />
        <NavigationGroup
          heading={t('security')}
          items={SECURITY_NAVIGATION}
          activeView={activeView}
          onSelect={onSelect}
        />
        <NavigationGroup
          heading={t('configuration')}
          items={CONFIGURATION_NAVIGATION}
          activeView={activeView}
          onSelect={onSelect}
        />
      </nav>
      <div className="cg-sidebar-footer">
        <span>{organization?.name.slice(0, 2).toUpperCase()}</span>
        <div>
          <strong>{organization?.name}</strong>
          <small>{organization?.role}</small>
        </div>
      </div>
    </aside>
  );
}

function NavigationGroup({
  heading,
  items,
  activeView,
  onSelect,
}: {
  heading: string;
  items: NavigationItem[];
  activeView: WorkspaceView;
  onSelect: (view: WorkspaceView) => void;
}) {
  const t = useTranslations('dashboard');
  return (
    <>
      <small className="cg-nav-heading security">{heading}</small>
      {items.map((item) => (
        <button
          className={
            item.view === activeView || (item.view === 'projects' && activeView === 'project')
              ? 'active'
              : ''
          }
          key={item.view}
          onClick={() => onSelect(item.view)}
        >
          <NavigationIcon name={item.icon} />
          <span>{t(item.labelKey)}</span>
        </button>
      ))}
    </>
  );
}

function NavigationIcon({ name }: { name: NavigationItem['icon'] }) {
  const paths: Record<NavigationItem['icon'], ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    projects: (
      <>
        <path d="M3 7.5h7l2 2h9v10.5H3z" />
        <path d="M3 7.5V5h7l2 2.5" />
      </>
    ),
    analyses: (
      <>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19H2" />
      </>
    ),
    vulnerabilities: (
      <>
        <path d="M12 3 2.8 19h18.4z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    quality: (
      <>
        <path d="M12 3 4 6v6c0 4.5 3 7.5 8 9 5-1.5 8-4.5 8-9V6z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
    reports: (
      <>
        <path d="M6 2h9l4 4v16H6z" />
        <path d="M14 2v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </>
    ),
    integrations: (
      <>
        <path d="M8 12h8" />
        <path d="M12 8v8" />
        <path d="M7 3v4H3" />
        <path d="M17 21v-4h4" />
        <path d="M5.5 17.5A8 8 0 0 1 7 5" />
        <path d="M18.5 6.5A8 8 0 0 1 17 19" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
