# Reads the current ngrok URL from ngrok's local API and writes it into
# config.php. Run it after every ngrok restart - free-tier URLs change each time,
# and a stale one means payments hang forever waiting for a callback that can
# never arrive.
#
#   powershell -ExecutionPolicy Bypass -File update-callback.ps1

$ErrorActionPreference = 'Stop'

$config = Join-Path $PSScriptRoot 'public\api\config.php'

if (-not (Test-Path $config)) {
    Write-Host "config.php not found at $config" -ForegroundColor Red
    Write-Host "Copy public\api\config.example.php to config.php first." -ForegroundColor Yellow
    exit 1
}

# ngrok serves a local API on 4040 while it's running.
try {
    $tunnels = (Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 5).tunnels
} catch {
    Write-Host "Can't reach ngrok on 127.0.0.1:4040." -ForegroundColor Red
    Write-Host "Is it running? Start it in another terminal with:  ngrok http 80" -ForegroundColor Yellow
    exit 1
}

$https = $tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1
if (-not $https) {
    Write-Host "ngrok is running but has no https tunnel. Use: ngrok http 80" -ForegroundColor Red
    exit 1
}

# Work out the URL path from where this folder sits under htdocs, so the
# callback resolves to this api folder rather than the web root.
$marker = '\htdocs\'
$idx = $PSScriptRoot.ToLower().IndexOf($marker)
if ($idx -lt 0) {
    Write-Host "This project isn't under xampp\htdocs, so I can't work out the URL path." -ForegroundColor Red
    Write-Host "Set callback_base by hand: <ngrok-url>/<path-to>/public/api" -ForegroundColor Yellow
    exit 1
}
$relative = $PSScriptRoot.Substring($idx + $marker.Length).Replace('\', '/')
$base = "$($https.public_url)/$relative/public/api"

$content = Get-Content $config -Raw
$updated = [regex]::Replace($content, "'callback_base'\s*=>\s*'[^']*'", "'callback_base' => '$base'")

if ($updated -eq $content) {
    Write-Host "Nothing changed - is there a callback_base line in config.php?" -ForegroundColor Yellow
    exit 1
}

Set-Content -Path $config -Value $updated -NoNewline -Encoding UTF8

Write-Host ""
Write-Host "  callback_base updated" -ForegroundColor Green
Write-Host "  $base"
Write-Host ""
Write-Host "  Check it:  http://localhost/$relative/public/api/setup_check.php"
Write-Host "  Store:     http://localhost/$relative/public/"
Write-Host ""
