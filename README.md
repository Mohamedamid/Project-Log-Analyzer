# Log Analyzer

Dashboard local pour analyser les rapports Robot Framework (`output.xml`) et centraliser les echecs, modules, screenshots, historique et suivi manuel.

## Ce qui a ete fait

- Ajout du logo Cegedim dans `static/cegedim-logo.png`.
- Refonte du layout avec menu lateral, header fixe, pages Dashboard, Analyse, Historique et GitLab.
- Amelioration du drag & drop: fichiers multiples, dossiers complets, affichage des fichiers ajoutes, dossier source, taille et suppression fichier par fichier.
- Ajout de la lecture recursive des dossiers avec `output.xml` et screenshots.
- Ajout du detail d'un cas de test avec documentation, screenshots et timeline des steps.
- Correction de la timeline: apres le premier `FAIL`, les steps suivants ne sont plus affiches en vert; ils passent en gris avec `Non execute`.
- Nettoyage du dashboard: suppression des graphiques type donut/quality qui se repetaient, conservation des cartes statistiques et du tableau module/iteration.
- Amelioration responsive pour eviter que le contenu passe sous le menu lateral.
- Separation du code en pages, composants et fichiers JS dedies.

## Structure actuelle

```text
templates/
  index.html
  partials/
    layout/
      header.html
      sidebar.html
    pages/
      dashboard.html
      history.html
      gitlab.html
    components/
      dropzone.html
      loader.html
      results.html
      detail_panel.html

static/
  style.css
  css/
    app-layout.css
  js/
    app.js
    core/
      state.js
      shell.js
      theme.js
      utils.js
    components/
      detail-view.js
      dialogs.js
      results-tools.js
      upload-parser.js
    pages/
      analyse-results.js
      dashboard.js
      history.js
    services/
      analyzer.js
```

## Role des fichiers

- `templates/index.html`: shell principal Flask/Jinja, charge les partials, CSS et JS.
- `templates/partials/layout/`: header et menu lateral.
- `templates/partials/pages/`: contenu fixe des pages principales.
- `templates/partials/components/`: blocs reutilisables comme drag/drop, resultats, loader et panel detail.
- `static/style.css`: styles historiques/base du projet.
- `static/css/app-layout.css`: corrections finales du layout, responsive, empty states et polish visuel.
- `static/js/core/state.js`: etat global, localStorage et constantes.
- `static/js/core/shell.js`: navigation pages, sidebar, header.
- `static/js/components/upload-parser.js`: drag/drop, queue fichiers, parsing XML helpers.
- `static/js/services/analyzer.js`: analyse des fichiers et merge des resultats.
- `static/js/pages/analyse-results.js`: rendu table resultats, filtres, modules, statuts.
- `static/js/components/detail-view.js`: panel detail d'un cas de test.
- `static/js/pages/dashboard.js`: dashboard projet et statistiques.
- `static/js/pages/history.js`: historique local.
- `static/js/app.js`: initialisation de l'application.

## Lancer le projet

Depuis le dossier du projet:

```powershell
python app.py
```

Puis ouvrir:

```text
http://127.0.0.1:5000/
```

Pour le mode Flask, utiliser `http://127.0.0.1:5000/`. Il ne faut pas ouvrir directement `templates/index.html`, parce que cette page utilise des includes Jinja.

## GitHub Pages

Le projet peut aussi fonctionner en mode static sur GitHub Pages.

- `index.html` a la racine est la version static complete pour GitHub Pages.
- `templates/index.html` reste la version Flask/Jinja pour le lancement local avec `python app.py`.
- Les assets sont charges avec des chemins relatifs: `static/style.css`, `static/css/app-layout.css`, `static/js/...`.
- `.nojekyll` est ajoute pour que GitHub Pages serve les fichiers static sans traitement Jekyll.
- Si les partials changent, regenerer aussi le `index.html` racine pour garder la version GitHub Pages a jour.

Dans GitHub, configurer Pages avec:

```text
Source: Deploy from a branch
Branch: master
Folder: /root
```

## Verification faite

- Syntaxe JavaScript verifiee avec Node sur tous les fichiers `static/js/**/*.js`.
- Tous les handlers utilises dans les `onclick` HTML existent dans les fichiers JS.

Commande utilisee pour verifier les handlers:

```powershell
Get-ChildItem -Recurse -Path static\js -Filter *.js | ForEach-Object { node -c $_.FullName }
```

## Notes pour la suite

- Garder `static/css/app-layout.css` comme dernier fichier CSS charge, parce qu'il contient les overrides propres et definitifs.
- Pour modifier une page, commencer par `templates/partials/pages/`.
- Pour modifier un composant visuel, commencer par `templates/partials/components/` et `static/css/app-layout.css`.
- Pour modifier le parsing ou l'import fichier, commencer par `static/js/components/upload-parser.js` et `static/js/services/analyzer.js`.
- Pour ajouter une integration GitLab reelle, utiliser la page `templates/partials/pages/gitlab.html` et ajouter la logique JS/API separement.
