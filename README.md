# Project Log Analyzer

Application React pour analyser localement les rapports Robot Framework XML (`output.xml`), suivre les echecs et consulter les resultats par module.

## Fonctionnalites

- Import des fichiers XML et dossiers complets par selection ou drag and drop; les autres formats sont ignores.
- Parsing 100% local dans le navigateur, sans envoyer les rapports vers un serveur.
- Dashboard avec KPI, progression, modules a surveiller et inventaire scrollable.
- Analyse avec navigation par module, recherche, filtres, tri, keywords et mode table focus.
- Detail d'un test avec timeline, erreur et screenshots disponibles.
- Historique local, statuts manuels `Corrige` et `Bloque`, themes clair et sombre.
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
    gitlab/            aide pipeline
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
npm run dev
```

Ouvrir ensuite l'URL affichee par Vite, normalement `http://localhost:5173/Project-Log-Analyzer/`.

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

## Donnees

Les analyses, l'historique, le theme et les statuts manuels sont conserves dans le `localStorage` du navigateur. Aucun backend n'est necessaire pour GitHub Pages.
