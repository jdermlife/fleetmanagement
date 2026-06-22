$ErrorActionPreference = 'Stop'

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $RootDir "backups\daily" }
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$RunDir = Join-Path $BackupDir $Timestamp

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null
Write-Host "[backup] run directory: $RunDir"

if ($env:DATABASE_URL) {
    Write-Host "[backup] creating database dump"
    & pg_dump $env:DATABASE_URL -Fc -f (Join-Path $RunDir "database.dump")
} else {
    Write-Host "[backup] DATABASE_URL not set, skipping database backup"
}

$DocumentsDir = Join-Path $RootDir "documents"
if (Test-Path $DocumentsDir) {
    Write-Host "[backup] archiving documents"
    Compress-Archive -Path $DocumentsDir -DestinationPath (Join-Path $RunDir "documents.zip") -Force
} else {
    Write-Host "[backup] documents directory not found, skipping"
}

Write-Host "[backup] archiving configuration files"
$ConfigDir = Join-Path $RunDir "config"
New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null

$ConfigCandidates = @(
    "README.md",
    "render.yaml.txt",
    "docker-compose.yml.txt",
    ".env.example"
)

foreach ($file in $ConfigCandidates) {
    $source = Join-Path $RootDir $file
    if (Test-Path $source) {
        Copy-Item $source (Join-Path $ConfigDir $file) -Force
    }
}

Compress-Archive -Path $ConfigDir -DestinationPath (Join-Path $RunDir "config.zip") -Force

if (Test-Path (Join-Path $RunDir "database.dump")) {
    Get-FileHash (Join-Path $RunDir "database.dump") -Algorithm SHA256 | Format-List | Out-File (Join-Path $RunDir "database.dump.sha256")
}
if (Test-Path (Join-Path $RunDir "documents.zip")) {
    Get-FileHash (Join-Path $RunDir "documents.zip") -Algorithm SHA256 | Format-List | Out-File (Join-Path $RunDir "documents.zip.sha256")
}
if (Test-Path (Join-Path $RunDir "config.zip")) {
    Get-FileHash (Join-Path $RunDir "config.zip") -Algorithm SHA256 | Format-List | Out-File (Join-Path $RunDir "config.zip.sha256")
}

Write-Host "[backup] completed successfully"
