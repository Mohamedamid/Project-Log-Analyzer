# Test runner workflow

This file summarizes the local test-runner and log-analysis features added to the app.

## What works where

### GitHub Pages

URL:

```text
https://mohamedamid.github.io/Project-Log-Analyzer/
```

Works:

- Import `output.xml`, `log.html`, or a folder selected by the user.
- Analyze results, modules, keywords, screenshots, dashboard, history, comparison.
- Mark tests as `Corrige` or `Bloque`.
- Keep the current analysis after refresh with browser storage.

Does not work:

- Running `robot`.
- Reading `C:\...` project folders automatically.
- Launching a single test from the Play button.

Reason: GitHub Pages is a static website. The browser is not allowed to execute local commands on the PC.

### Local mode

URL example:

```text
http://127.0.0.1:5173/Project-Log-Analyzer/
```

Works:

- Everything from GitHub Pages.
- Play button on a single test row.
- Play button on a module, file, or folder.
- Automatic import of the new `output.xml` and `log.html` after execution.

Use this mode when you want **Lancer** to execute Robot tests from the PC.

## Quick local setup

Run this on the PC that contains the Robot project:

```powershell
git clone https://github.com/Mohamedamid/Project-Log-Analyzer.git
cd Project-Log-Analyzer
npm install
npm run dev -- --host 127.0.0.1
```

After the last command:

1. Keep the terminal open.
2. Find the line that starts with `Local:`.
3. Open the URL, usually `http://127.0.0.1:5173/Project-Log-Analyzer/`.
4. In **Settings > Dossier projet**, enter the root folder of the Robot project.
5. Click Play on a test row. The button should show a spinner while the test is running.

Check Robot:

```powershell
robot --version
```

If Robot is missing:

```powershell
pip install robotframework
```

The Robot project dependencies must also be installed on the same PC.

## Project root

Open the analysis page and set **Dossier projet** once. Use the local root folder of the Robot project, for example:

```text
D:\Projets\tietix-TNR
```

The app uses this root to find `.robot` files even when `output.xml` came from a GitLab pipeline with paths like `/builds/...`.

Do not put the path of one `.robot` file as project root. Put the big root folder of the test project. The app will search inside it.

## Local runner availability

Launching Robot tests requires the local Vite runner API. It does not work from GitHub Pages because GitHub Pages is static and cannot execute commands on your PC.

Run the app locally before using the Play buttons:

```text
npm.cmd run dev -- --host 127.0.0.1
```

Then open the local URL shown by Vite.

If you open the GitHub Pages URL and click Play, the app can show the UI but it cannot execute the test unless a separate local runner/agent is installed and approved by IT.

## Launching tests

- Use the **Play** button in any table row to relaunch that test case.
- Use the **Play** button in the module/suite sidebar to relaunch a whole module, file, or subfolder.
- While a test is running, the clicked button changes to **Stop**.
- Click **Stop**, then confirm with **Oui**, to ask the local runner to stop the Robot process.
- Other launch buttons stay disabled until the current execution stops or finishes.

## Result merge

When a relaunched test, file, or module finishes, the new `output.xml`/`log.html` is imported automatically.

- A single test relaunch updates that same row in the current table.
- A module or suite relaunch updates matching rows without replacing the whole analysis.
- If a case was `FAIL` and becomes `PASS`, the row stays visible and shows `Corrige apres relance`.

## Details drawer

Click a test row to open the side drawer. It shows the nested Robot keyword tree with expandable details, arguments, messages, status, elapsed time, documentation, screenshots, and errors.

## Module cleanup

In the module sidebar:

- Select multiple modules with the checkboxes.
- Use **Supprimer** in the bulk bar to delete selected modules from the current analysis.
- The single-module delete button is still available.

## Local storage cleanup

The app stores local UI state in the browser:

- Current analysis in `IndexedDB`.
- Settings, history, theme, fixed/blocked marks in `localStorage`.

Use **Settings > Nettoyer donnees locales** to clear this browser state. This does not delete any file from the PC.
