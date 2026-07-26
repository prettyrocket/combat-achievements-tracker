<#
.SYNOPSIS
  Local dev control for the Combat Achievements Tracker (Postgres + backend + frontend).

.DESCRIPTION
  One entry point to start / inspect / stop / restart the local stack. `start` opens a
  Windows Terminal window named "ca-dev" with a tab per piece (git, backend, frontend, db).

.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File scripts\dev.ps1 start
  pwsh -ExecutionPolicy Bypass -File scripts\dev.ps1 status
  pwsh -ExecutionPolicy Bypass -File scripts\dev.ps1 stop            # stops everything
  pwsh -ExecutionPolicy Bypass -File scripts\dev.ps1 stop backend
  pwsh -ExecutionPolicy Bypass -File scripts\dev.ps1 restart frontend
#>
[CmdletBinding()]
param(
  [ValidateSet('start', 'open', 'status', 'stop', 'restart')]
  [string]$Command = 'start',

  [ValidateSet('all', 'backend', 'frontend', 'db')]
  [string]$Target = 'all'
)

$ErrorActionPreference = 'Stop'

# --- Config (paths derived from this script's location, so it works anywhere) ---
$Repo         = Split-Path -Parent $PSScriptRoot
$Backend      = Join-Path $Repo 'backend'
$Frontend     = Join-Path $Repo 'frontend'
$PgService    = 'postgresql-x64-17'
$PgBin        = 'C:\Program Files\PostgreSQL\17\bin'
$Db           = 'combat_achievements'
$BackendPort  = 8080
$FrontendPort = 5173
$WtWindow     = 'ca-dev'
$PsqlScript   = Join-Path $PSScriptRoot 'psql.ps1'
$PgLogScript  = Join-Path $PSScriptRoot 'pglog.ps1'

# Distinct Windows Terminal tab colors (--tabColor).
$Colors = @{
  git      = '#A371F7'  # purple  (repo / git)
  backend  = '#6DB33F'  # green   (Spring Boot)
  frontend = '#41D1FF'  # cyan    (Vite)
  db       = '#336791'  # blue    (Postgres/psql)
  pglog    = '#F0AD4E'  # amber   (PG log tail)
}

# --- Helpers ---
function Get-PortProcess([int]$Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($conn) { Get-Process -Id ($conn.OwningProcess | Select-Object -First 1) -ErrorAction SilentlyContinue }
}

# Machine-service ops need admin; bounce through a UAC prompt.
function Invoke-Elevated([string]$PsCommand) {
  Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile', '-Command', $PsCommand
}

function Ensure-Postgres {
  $svc = Get-Service $PgService -ErrorAction SilentlyContinue
  if (-not $svc) { Write-Warning "Postgres service '$PgService' not found."; return }
  if ($svc.Status -ne 'Running') {
    Write-Host "Starting Postgres ($PgService) - approve the UAC prompt..." -ForegroundColor Cyan
    Invoke-Elevated "Start-Service $PgService"
    try { (Get-Service $PgService).WaitForStatus('Running', '00:00:15') } catch {}
  }
  Write-Host "Postgres ($PgService): $((Get-Service $PgService).Status)" -ForegroundColor Green
}

function Stop-Port([string]$Name, [int]$Port) {
  $p = Get-PortProcess $Port
  if ($p) {
    Stop-Process -Id $p.Id -Force
    Write-Host "$Name stopped ($($p.ProcessName) PID $($p.Id), :$Port)" -ForegroundColor Yellow
  } else {
    Write-Host "$Name already down (:$Port free)"
  }
}

function Show-Status {
  $pg = (Get-Service $PgService -ErrorAction SilentlyContinue).Status
  $b  = Get-PortProcess $BackendPort
  $f  = Get-PortProcess $FrontendPort
  Write-Host "--- ca-dev status ---" -ForegroundColor Cyan
  Write-Host ("Postgres ({0}) : {1}" -f $PgService, ($pg ?? 'not found'))
  Write-Host ("Backend  (:{0})       : {1}" -f $BackendPort,  ($(if ($b) { "UP   $($b.ProcessName) PID $($b.Id)" } else { 'down' })))
  Write-Host ("Frontend (:{0})       : {1}" -f $FrontendPort, ($(if ($f) { "UP   $($f.ProcessName) PID $($f.Id)" } else { 'down' })))
}

# Open a fresh Windows Terminal window with a tab per piece. Missing app dirs are skipped
# so this still works on a branch that doesn't have both apps yet.
# --suppressApplicationTitle makes our --title stick (otherwise Vite/npm/psql overwrite it).
function Open-Window {
  $branch = git -C $Repo rev-parse --abbrev-ref HEAD 2>$null
  if (-not $branch) { $branch = 'git' }

  # git tab: plain shell at the repo root, titled with the current branch/worktree.
  $a = @('-w', $WtWindow,
    'new-tab', '--title', $branch, '--tabColor', $Colors.git, '--suppressApplicationTitle', '-d', $Repo)

  if (Test-Path $Backend) {
    $a += @(';', 'new-tab', '--title', 'backend', '--tabColor', $Colors.backend, '--suppressApplicationTitle',
      '-d', $Backend, 'pwsh', '-NoExit', '-Command', '.\gradlew.bat bootRun')
  }
  if (Test-Path $Frontend) {
    $a += @(';', 'new-tab', '--title', 'frontend', '--tabColor', $Colors.frontend, '--suppressApplicationTitle',
      '-d', $Frontend, 'pwsh', '-NoExit', '-Command', 'npm run dev')
  }
  $a += @(';', 'new-tab', '--title', 'db', '--tabColor', $Colors.db, '--suppressApplicationTitle',
    '-d', $Repo, 'pwsh', '-NoExit', '-File', $PsqlScript)
  $a += @(';', 'new-tab', '--title', 'pg-logs', '--tabColor', $Colors.pglog, '--suppressApplicationTitle',
    '-d', $Repo, 'pwsh', '-NoExit', '-File', $PgLogScript)

  Start-Process wt -ArgumentList $a
  Write-Host "Opened Windows Terminal window '$WtWindow' (tabs: $branch, backend, frontend, db, pg-logs)." -ForegroundColor Green
}

# Add a single tab to the existing ca-dev window (used by restart).
function Open-Tab([string]$Title, [string]$Color, [string]$Dir, [string]$RunCommand) {
  Start-Process wt -ArgumentList @('-w', $WtWindow, 'new-tab', '--title', $Title, '--tabColor', $Color,
    '--suppressApplicationTitle', '-d', $Dir, 'pwsh', '-NoExit', '-Command', $RunCommand)
}

# --- Command dispatch ---
switch ($Command) {

  'start' {
    Ensure-Postgres
    Open-Window
    Write-Host "`nTip: 'dev.ps1 status' to check, 'dev.ps1 restart backend|frontend' to bounce one." -ForegroundColor DarkGray
  }

  'open' { Open-Window }   # like start, but does NOT touch Postgres

  'status' { Show-Status }

  'stop' {
    switch ($Target) {
      'backend'  { Stop-Port 'Backend'  $BackendPort }
      'frontend' { Stop-Port 'Frontend' $FrontendPort }
      'db'       { Write-Host "Stopping Postgres - approve UAC..." -ForegroundColor Cyan; Invoke-Elevated "Stop-Service $PgService" }
      'all'      {
        Stop-Port 'Backend'  $BackendPort
        Stop-Port 'Frontend' $FrontendPort
        Write-Host "Stopping Postgres - approve UAC..." -ForegroundColor Cyan
        Invoke-Elevated "Stop-Service $PgService"
      }
    }
  }

  'restart' {
    switch ($Target) {
      'backend'  { Stop-Port 'Backend'  $BackendPort;  Start-Sleep 1; Open-Tab 'backend' $Colors.backend $Backend '.\gradlew.bat bootRun' }
      'frontend' { Stop-Port 'Frontend' $FrontendPort; Start-Sleep 1; Open-Tab 'frontend' $Colors.frontend $Frontend 'npm run dev' }
      'db'       { Write-Host "Restarting Postgres - approve UAC..." -ForegroundColor Cyan; Invoke-Elevated "Restart-Service $PgService" }
      'all'      {
        Ensure-Postgres
        Stop-Port 'Backend'  $BackendPort;  Start-Sleep 1; Open-Tab 'backend' $Colors.backend $Backend '.\gradlew.bat bootRun'
        Stop-Port 'Frontend' $FrontendPort; Start-Sleep 1; Open-Tab 'frontend' $Colors.frontend $Frontend 'npm run dev'
      }
    }
  }
}
