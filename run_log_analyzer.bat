@echo off
setlocal

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    where py >nul 2>nul
    if errorlevel 1 (
        echo Python ma kaynach f PATH.
        echo Install Python w 3awd jarrab.
        pause
        exit /b 1
    )
    set "PY_CMD=py -3"
) else (
    set "PY_CMD=python"
)

start "Log Analyzer Backend" cmd /k %PY_CMD% app.py
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:5000

exit /b 0
