@echo off
chcp 65001 >nul
cd /d "%~dp0"
title RR CARS - Servidor local

where node >nul 2>nul
if %errorlevel%==0 (
  echo Iniciando RR CARS con Node.js...
  node server.mjs --open
  if errorlevel 1 pause
  exit /b
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo Node.js no encontrado. Iniciando con Python...
  start "" http://127.0.0.1:8080/
  py -m http.server 8080 --bind 127.0.0.1
  pause
  exit /b
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Node.js no encontrado. Iniciando con Python...
  start "" http://127.0.0.1:8080/
  python -m http.server 8080 --bind 127.0.0.1
  pause
  exit /b
)

echo.
echo No se encontro Node.js ni Python para iniciar el servidor local.
echo.
echo Opcion 1: instala Node.js desde https://nodejs.org/ y vuelve a ejecutar este archivo.
echo Opcion 2: instala Python desde https://www.python.org/downloads/
echo.
echo La aplicacion NO debe abrirse haciendo doble clic en index.html:
echo necesita http://127.0.0.1:8080/ para funcionar como PWA.
echo.
pause
