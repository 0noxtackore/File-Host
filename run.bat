@echo off
REM File Host - launch the local server and open the app in the browser.
REM The frontend talks to Firebase directly, so this just serves the static files.

start "" cmd /k "npm start"
timeout /t 3 >nul
start http://localhost:3000
