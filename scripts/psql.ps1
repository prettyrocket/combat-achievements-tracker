# Launches an interactive psql session against the local dev database.
# Used by the "db" tab in dev.ps1's Windows Terminal window. Dev-only credentials.
$env:PGPASSWORD = 'postgres'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
if (-not (Test-Path $psql)) { $psql = (Get-Command psql -ErrorAction SilentlyContinue).Source }
if (-not $psql) { Write-Error 'psql not found (expected C:\Program Files\PostgreSQL\17\bin).'; return }
& $psql -U postgres -h localhost -p 5432 -d combat_achievements
