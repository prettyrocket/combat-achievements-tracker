# Tails the newest PostgreSQL log file (used by the "pg-logs" tab in dev.ps1).
$logDir = 'C:\Program Files\PostgreSQL\17\data\log'
if (-not (Test-Path $logDir)) { Write-Error "PG log dir not found: $logDir"; return }
$latest = Get-ChildItem $logDir -Filter *.log | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latest) { Write-Error "No .log files in $logDir"; return }
Write-Host "Tailing $($latest.Name)  (newest PG log; Ctrl+C to stop)" -ForegroundColor Cyan
Write-Host "Note: on a PG restart a new log file is created - re-run this tab to follow it." -ForegroundColor DarkGray
Get-Content -Path $latest.FullName -Wait -Tail 50
