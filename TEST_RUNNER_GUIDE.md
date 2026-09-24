# Test runner workflow

This file summarizes the local test-runner and log-analysis features added to the app.

## Project root

Open the analysis page and set **Dossier projet** once. Use the local root folder of the Robot project, for example:

```text
C:\Users\Youcode\Desktop\tietix-TNR
```

The app uses this root to find `.robot` files even when `output.xml` came from a GitLab pipeline with paths like `/builds/...`.

## Local runner availability

Launching Robot tests requires the local Vite runner API. It does not work from GitHub Pages because GitHub Pages is static and cannot execute commands on your PC.

Run the app locally before using the Play buttons:

```text
npm.cmd run dev -- --host 127.0.0.1
```

Then open the local URL shown by Vite.

## Launching tests

- Use the **Play** button in any table row to relaunch that test case.
- Use the **Play** button in the module/suite sidebar to relaunch a whole module, file, or subfolder.
- While a test is running, the clicked button shows a spinner and other launch buttons are disabled.

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
