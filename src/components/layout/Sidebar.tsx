import {
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Gauge,
  History,
} from "lucide-react";
import type { PageId } from "../../types/analysis";

interface SidebarProps {
  activePage: PageId;
  collapsed: boolean;
  onNavigate: (page: PageId) => void;
  onToggle: () => void;
}

const navigation = [
  { id: "dashboard" as const, label: "Dashboard", icon: Gauge },
  { id: "analysis" as const, label: "Analyse", icon: ChartNoAxesCombined },
  { id: "history" as const, label: "Historique", icon: History },
];

export function Sidebar({ activePage, collapsed, onNavigate, onToggle }: SidebarProps) {
  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true">
          <ChartNoAxesCombined size={26} strokeWidth={2.4} />
        </span>
        <span className="sidebar__brand-text">Log Analyzer</span>
      </div>

      <button
        className="icon-button sidebar__toggle"
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Afficher le menu" : "Reduire le menu"}
        title={collapsed ? "Afficher le menu" : "Reduire le menu"}
      >
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      <nav className="sidebar__nav" aria-label="Navigation principale">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-button ${activePage === id ? "nav-button--active" : ""}`}
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={activePage === id ? "page" : undefined}
            title={collapsed ? label : undefined}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
