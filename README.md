# Project Log Analyzer

Application React pour analyser localement les rapports Robot Framework XML (`output.xml`), suivre les echecs et consulter les resultats par module.

## Fonctionnalites

- Import des fichiers XML et dossiers complets par selection ou drag and drop; les autres formats sont ignores.
- Parsing 100% local dans le navigateur, sans envoyer les rapports vers un serveur.
- Dashboard avec KPI, progression, modules a surveiller et inventaire scrollable.
- Analyse avec navigation par module, recherche, filtres, tri, keywords et mode table focus.
- Detail d'un test avec timeline, erreur et screenshots disponibles.
- Historique local, statuts manuels `Corrige` et `Bloque`, themes clair et sombre.
- Relance Robot locale depuis les boutons Play quand l'application est lancee en local.
- Mise en page responsive pour ordinateur, tablette et mobile.

## Stack

- React 19
- TypeScript et TSX
- Vite 6
- Lucide React
- GitHub Actions et GitHub Pages

## Structure

```text
src/
  assets/              images utilisees par l'application
  app/                 orchestration et etat global
  components/
    common/            composants reutilisables
    layout/            header et navigation
  features/
    analysis/          import, filtres, tableau et detail
    dashboard/         indicateurs et inventaire
    history/           historique local
  hooks/               hooks partages
  services/            collecte et parsing des rapports
  styles/              design system et responsive
  types/               modeles TypeScript
  utils/               calculs et formatage
```

Le projet contient uniquement l'application React. L'entree Vite est `index.html` et tout le code applicatif se trouve dans `src/`.

## Developpement local

```powershell
npm install
npm run dev -- --host 127.0.0.1
```

Ouvrir ensuite l'URL affichee par Vite, normalement `http://127.0.0.1:5173/Project-Log-Analyzer/`.

Le mode local est obligatoire pour utiliser les boutons **Lancer**. Le serveur Vite expose une API locale qui execute `robot`, lit les rapports generes puis les reimporte dans l'analyse.

Avant de lancer un test depuis l'interface:

1. Installer Robot Framework et les libraries du projet de test.
2. Ouvrir l'application depuis `127.0.0.1` ou `localhost`.
3. Aller dans **Settings > Dossier projet**.
4. Indiquer le dossier racine local du projet Robot, par exemple `C:\Users\Youcode\Desktop\tietix-TNR`.
5. Cliquer sur Play dans une ligne de test ou dans le menu des modules.

Verification et build de production:

```powershell
npm run typecheck
npm run build
npm run preview
```

## GitHub Pages

Le fichier `vite.config.ts` utilise la base `/Project-Log-Analyzer/`, adaptee a l'URL du repository.

Dans `Settings > Pages`, choisir **GitHub Actions** comme source. Chaque push sur `master` lance `.github/workflows/deploy-pages.yml` et publie le contenu de `dist/`.

Site attendu: `https://mohamedamid.github.io/Project-Log-Analyzer/`

Sur GitHub Pages, l'application peut importer et analyser des rapports, mais elle ne peut pas executer `robot` sur le PC. Les navigateurs bloquent l'acces direct aux fichiers locaux et aux commandes systeme depuis une page web publique. Pour faire fonctionner **Lancer** depuis GitHub Pages, il faudrait ajouter un runner local/agent installe sur le PC et valide par l'IT.

Resume:

- `https://mohamedamid.github.io/Project-Log-Analyzer/`: import, analyse, comparaison, dashboard, historique.
- `http://127.0.0.1:5173/Project-Log-Analyzer/`: tout ce qui precede + execution locale Robot via les boutons Play.

## Donnees

Les analyses, l'historique, le theme et les statuts manuels sont conserves dans le navigateur. Les petits reglages utilisent `localStorage`; l'analyse courante utilise `IndexedDB` pour supporter les gros rapports Robot. Aucun backend n'est necessaire pour GitHub Pages.

Le bouton **Settings > Nettoyer donnees locales** supprime ces donnees du navigateur sans toucher aux fichiers du PC.

Plus de details: [TEST_RUNNER_GUIDE.md](./TEST_RUNNER_GUIDE.md).
