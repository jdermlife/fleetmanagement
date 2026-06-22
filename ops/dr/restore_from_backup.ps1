param(
    [Parameter(Mandatory=$true)]
    [string]$BackupRunPath
)

$ErrorActionPreference = 'Stop'
$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")

if (-not (Test-Path $BackupRunPath)) {
    Write-Error "Backup run directory does not exist: $BackupRunPath"
}

Write-Host "[restore] restoring from $BackupRunPath"

$DatabaseDump = Join-Path $BackupRunPath "database.dump"
if ((Test-Path $DatabaseDump) -and $env:DATABASE_URL) {
    Write-Host "[restore] restoring database"
    & pg_restore --clean --if-exists --no-owner --no-privileges -d $env:DATABASE_URL $DatabaseDump
} else {
    Write-Host "[restore] skipping database restore (missing dump or DATABASE_URL)"
}

$DocumentsZip = Join-Path $BackupRunPath "documents.zip"
if (Test-Path $DocumentsZip) {
    Write-Host "[restore] restoring documents"
    $DocumentsDir = Join-Path $RootDir "documents"
    if (Test-Path $DocumentsDir) {
        Remove-Item -Recurse -Force $DocumentsDir
    }
    Expand-Archive -Path $DocumentsZip -DestinationPath $RootDir -Force
} else {
    Write-Host "[restore] skipping documents restore"
}

$ConfigZip = Join-Path $BackupRunPath "config.zip"
if (Test-Path $ConfigZip) {
    Write-Host "[restore] restoring config package under restore_output"
    $RestoreOutput = Join-Path $RootDir "restore_output"
    New-Item -ItemType Directory -Path $RestoreOutput -Force | Out-Null
    Expand-Archive -Path $ConfigZip -DestinationPath $RestoreOutput -Force
} else {
    Write-Host "[restore] skipping config restore"
}

Write-Host "[restore] completed"
