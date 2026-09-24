import { useEffect, useRef, useState } from "react";
import { FolderCog, FolderTree, Maximize2, Minimize2, Moon, Settings, Sun, Trash2 } from "lucide-react";
import type { Theme } from "../../types/analysis";

interface AppHeaderProps {
  title: string;
  description: string;
  theme: Theme;
  showProjectButton?: boolean;
  fullscreen?: boolean;
  onProjectButtonClick?: () => void;
  onClearStorage: () => void;
  onToggleFullscreen: () => void;
  onToggleTheme: () => void;
}

export function AppHeader({ title, description, theme, showProjectButton = false, fullscreen = false, onProjectButtonClick, onClearStorage, onToggleFullscreen, onToggleTheme }: AppHeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [settingsOpen]);

  const runAction = (action?: () => void) => {
    setSettingsOpen(false);
    action?.();
  };

  return (
    <header className="app-header">
      <div className="app-header__title">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="app-header__actions">
        <div className="header-settings" ref={menuRef}>
          <button
            className={`theme-button header-settings__trigger ${settingsOpen ? "active" : ""}`}
            type="button"
            onClick={() => setSettingsOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            aria-label="Parametres"
            title="Parametres"
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          {settingsOpen ? (
            <div className="header-settings__menu" role="menu">
              <span className="header-settings__status"><FolderTree size={16} /> Local XML</span>
              {showProjectButton ? (
                <button type="button" role="menuitem" onClick={() => runAction(onProjectButtonClick)}>
                  <FolderCog size={17} /> <span>Dossier projet</span>
                </button>
              ) : null}
              <button type="button" role="menuitem" onClick={() => runAction(onToggleFullscreen)}>
                {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                <span>{fullscreen ? "Quitter plein ecran" : "Plein ecran"}</span>
              </button>
              <button type="button" role="menuitem" onClick={() => runAction(onToggleTheme)}>
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                <span>{theme === "dark" ? "Mode clair" : "Mode sombre"}</span>
              </button>
              <button className="header-settings__danger" type="button" role="menuitem" onClick={() => runAction(onClearStorage)}>
                <Trash2 size={17} /> <span>Nettoyer donnees locales</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
