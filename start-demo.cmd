@echo off
rem Double-click to start the demo with the project's own database copies (.env.private.example).
cd /d "%~dp0"
call bun run db:up || goto :failed
start "" http://localhost:3000
call bun run start
:failed
pause
