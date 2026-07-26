<#
.SYNOPSIS
  Local dev control for the Combat Achievements Tracker (Vite frontend).

.DESCRIPTION
  One entry point to start / inspect / stop / restart local dev. The app is a static
  SPA with no server and no database, so "the stack" is a single Vite process.
  `start` opens a Windows Terminal window named "ca-dev" with a branch-named git tab
  and a frontend tab.

.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File scripts\dev.ps1 start
  pwsh -ExecutionPolicy Bypass -File scripts\dev.ps1 status
  pwsh -ExecutionPolicy Bypass -File scripts\dev.ps1 stop
  pwsh -ExecutionPolicy Bypass -File scripts\dev.ps1 restart
#>
[CmdletBinding()]
param(
  [ValidateSet('start', 'open', 'status', 'stop', 'restart')]
  [string]$Command = 'start'
)

$ErrorActionPreference = 'Stop'

# --- Config (paths derived from this script's location, so it works anywhere) ---
$Repo         = Split-Path -Parent $PSScriptRoot
$Frontend     = Join-Path $Repo 'frontend'
$FrontendPort = 5173
$WtWindow     = 'ca-dev'

# Distinct Windows Terminal tab colors (--tabColor).
$Colors = @{
  git      = '#A371F7'  # purple  (repo / git)
  frontend = '#41D1FF'  # cyan    (Vite)
}

# --- Helpers ---
function Get-PortProcess([int]$Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($conn) { Get-Process -Id ($conn.OwningProcess | Select-Object -First 1) -ErrorAction SilentlyContinue }
}

function Stop-Frontend {
  $p = Get-PortProcess $FrontendPort
  if ($p) {
    Stop-Process -Id $p.Id -Force
    Write-Host "Frontend stopped ($($p.ProcessName) PID $($p.Id), :$FrontendPort)" -ForegroundColor Yellow
  } else {
    Write-Host "Frontend already down (:$FrontendPort free)"
  }
}

function Show-Status {
  $f = Get-PortProcess $FrontendPort
  Write-Host "--- ca-dev status ---" -ForegroundColor Cyan
  Write-Host ("Frontend (:{0}) : {1}" -f $FrontendPort, ($(if ($f) { "UP   $($f.ProcessName) PID $($f.Id)" } else { 'down' })))
}

# Open a fresh Windows Terminal window: a git tab at the repo root plus the Vite tab.
# --suppressApplicationTitle makes our --title stick (otherwise Vite/npm overwrite it).
function Open-Window {
  $branch = git -C $Repo rev-parse --abbrev-ref HEAD 2>$null
  if (-not $branch) { $branch = 'git' }

  $a = @('-w', $WtWindow,
    'new-tab', '--title', $branch, '--tabColor', $Colors.git, '--suppressApplicationTitle', '-d', $Repo)

  $a += @(';', 'new-tab', '--title', 'frontend', '--tabColor', $Colors.frontend, '--suppressApplicationTitle',
    '-d', $Frontend, 'pwsh', '-NoExit', '-Command', 'npm run dev')

  Start-Process wt -ArgumentList $a
  Write-Host "Opened Windows Terminal window '$WtWindow' (tabs: $branch, frontend)." -ForegroundColor Green
}

# Add a single tab to the existing ca-dev window (used by restart).
function Open-Tab([string]$Title, [string]$Color, [string]$Dir, [string]$RunCommand) {
  Start-Process wt -ArgumentList @('-w', $WtWindow, 'new-tab', '--title', $Title, '--tabColor', $Color,
    '--suppressApplicationTitle', '-d', $Dir, 'pwsh', '-NoExit', '-Command', $RunCommand)
}

# --- Command dispatch ---
switch ($Command) {

  'start' {
    Open-Window
    Write-Host "`nTip: 'dev.ps1 status' to check, 'dev.ps1 restart' to bounce Vite." -ForegroundColor DarkGray
  }

  'open' { Open-Window }

  'status' { Show-Status }

  'stop' { Stop-Frontend }

  'restart' {
    Stop-Frontend
    Start-Sleep 1
    Open-Tab 'frontend' $Colors.frontend $Frontend 'npm run dev'
  }
}
