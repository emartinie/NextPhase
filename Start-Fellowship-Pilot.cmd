@echo off
setlocal
cd /d "%~dp0"
set "NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "FELLOWSHIP_FIREBASE_WEB_CONFIG=%USERPROFILE%\OneDrive\Desktop\firebaseConfig.txt"
if not exist "%FELLOWSHIP_FIREBASE_WEB_CONFIG%" set "FELLOWSHIP_FIREBASE_WEB_CONFIG=%USERPROFILE%\Desktop\firebaseConfig.txt"
set "FELLOWSHIP_FIREBASE_PORT=8770"
set "TEMP=%~dp0.pilot-tmp"
set "TMP=%TEMP%"
if not exist "%TEMP%" mkdir "%TEMP%"
if not exist "%NODE%" (
  echo The local Node runtime is missing.
  pause
  exit /b 1
)
if not exist "%FELLOWSHIP_FIREBASE_WEB_CONFIG%" (
  echo Keep the existing Firebase web configuration in firebaseConfig.txt on your Desktop.
  pause
  exit /b 1
)
"%NODE%" -e "fetch('http://localhost:8770/NextPhase/__fellowship-firebase/config',{signal:AbortSignal.timeout(1500)}).then(async r=>{if(!r.ok||(await r.json()).projectId!=='homegroups-fellowship')process.exitCode=1;}).catch(()=>{process.exitCode=1;});"
if not errorlevel 1 (
  echo Fellowship preview is already running.
  echo Open http://localhost:8770/NextPhase/?pilot=firebase^&face=fellowship^&week=7
  pause
  exit /b 0
)
echo Leave this window open while using Fellowship.
echo Open http://localhost:8770/NextPhase/?pilot=firebase^&face=fellowship^&week=7
"%NODE%" tests\fellowship-pilot\firebase-preview.cjs
if errorlevel 1 pause
