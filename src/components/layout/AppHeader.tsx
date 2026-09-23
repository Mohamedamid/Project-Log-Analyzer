import { FolderCog, FolderTree, Moon, Sun } from "lucide-react";
import type { Theme } from "../../types/analysis";

interface AppHeaderProps {
  title: string;
  description: string;
  theme: Theme;
  showProjectButton?: boolean;
  onProjectButtonClick?: () => void;
  onToggleTheme: () => void;
}

export function AppHeader({ title, description, theme, showProjectButton = false, onProjectButtonClick, onToggleTheme }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__title">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="app-header__actions">
        {showProjectButton ? (
          <button className="header-project-button" type="button" onClick={onProjectButtonClick}>
            <FolderCog size={17} /> <span>Dossier projet</span>
          </button>
        ) : null}
        <span className="header-chip"><FolderTree size={17} /> Local XML</span>
        <button
          className="theme-button"
          type="button"
          onClick={onToggleTheme}
          aria-label={`Activer le mode ${theme === "dark" ? "clair" : "sombre"}`}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          <span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
      </div>
    </header>
  );
}
