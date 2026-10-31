# Membuat paket untuk Chrome Web Store: hanya file yang dibutuhkan extension.
# Jalankan dari folder proyek:  powershell -ExecutionPolicy Bypass -File store\build-zip.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$version = (Get-Content "$root\manifest.json" -Raw | ConvertFrom-Json).version
$out = "$root\store\lexarach-$version.zip"
if (Test-Path $out) { Remove-Item $out }
Compress-Archive -Path "$root\manifest.json", "$root\_locales", "$root\src", "$root\icons" -DestinationPath $out
Write-Host "Selesai: $out"
