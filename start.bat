@echo off
title CarFinder
cd /d "C:\Berat\Repos\CarFinder"

echo ============================================
echo            CarFinder wird gestartet
echo ============================================
echo.

REM --- Alle alten Next.js-Server beenden (Port 3000 + evtl. Reste) ---
echo Beende alte Server...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul

REM --- Build-Cache loeschen: verhindert, dass ein veralteter Build die aktuelle
REM     next.config.js ueberschreibt (Ursache des "Executable doesn't exist"-Fehlers) ---
echo Loesche Build-Cache (.next)...
if exist ".next" rmdir /s /q ".next"

REM --- Browser in PROJEKT-Ordner sicherstellen (reiner ASCII-Pfad ohne Sonderzeichen).
REM     Umgeht den Windows-Bug mit Sonderzeichen im Benutzerpfad
REM     (C:\Users\Berat Bogazkoey\...). npx playwright install ist idempotent:
REM     ist der Browser schon da, ueberspringt es den Download in 1-2 Sekunden. ---
set "PLAYWRIGHT_BROWSERS_PATH=%CD%\browsers"
echo Pruefe/Installiere Browser im Projektordner...
call npx playwright install chromium-headless-shell

REM --- Warnen, falls kein Gemini-Key eingetragen ist ---
findstr /R "GEMINI_API_KEY=..*" .env.local >nul 2>&1
if errorlevel 1 goto nokey
goto run

:nokey
echo WARNUNG: Kein gueltiger GEMINI_API_KEY in .env.local gefunden!
echo Hol dir einen kostenlosen Key: https://aistudio.google.com/apikey
echo und trage ihn in der Datei .env.local ein.
echo Ohne Key startet die App, aber die Suche schlaegt fehl.
echo.

:run
REM --- Browser nach kurzer Wartezeit oeffnen ---
start "" cmd /c "timeout /t 9 /nobreak >nul & start http://localhost:3000"

echo Starte Server auf http://localhost:3000 ...
echo (Zum Beenden Strg+C druecken oder Fenster schliessen)
echo.
call npm run dev -- -p 3000

echo.
echo Server wurde beendet.
pause
