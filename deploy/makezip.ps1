# Build a ZIP with forward-slash paths (WordPress requirement).
# PowerShell's Compress-Archive writes backslashes, which WP rejects with
# "Plugin file does not exist."

$src = Join-Path $PSScriptRoot 'demonfall'
$dst = Join-Path $PSScriptRoot 'demonfall.zip'

if (Test-Path $dst) { Remove-Item $dst -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($dst, [System.IO.Compression.ZipArchiveMode]::Create)

Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length + 1).Replace('\', '/')
    $entryName = "demonfall/$rel"
    $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $stream = $entry.Open()
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
}

$zip.Dispose()
Write-Host "Wrote $dst"
