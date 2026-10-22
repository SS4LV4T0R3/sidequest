$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$temporaryRoot = Join-Path $projectRoot 'tmp'
$staging = Join-Path $temporaryRoot ('azure-package-' + [guid]::NewGuid().ToString('N'))
$archive = Join-Path $temporaryRoot 'sidequest-azure.zip'

foreach ($project in @('frontend', 'backend')) {
    Push-Location (Join-Path $projectRoot $project)
    try {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw "Build non riuscita: $project" }
    } finally { Pop-Location }
}
New-Item -ItemType Directory -Path $staging -Force | Out-Null
try {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'azure-web.config') -Destination (Join-Path $staging 'web.config')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'backend/dist') -Destination $staging -Recurse
    # tsc lascia i compilati dei sorgenti eliminati: escluderli dal pacchetto.
    Get-ChildItem -LiteralPath (Join-Path $staging 'dist') -Recurse -File | ForEach-Object {
        $relative = ($_.FullName.Substring((Join-Path $staging 'dist').Length + 1))
        $source = Join-Path (Join-Path $projectRoot 'backend/src') ([IO.Path]::ChangeExtension($relative, '.ts'))
        if (!(Test-Path -LiteralPath $source)) { Remove-Item -LiteralPath $_.FullName }
    }
    $public = New-Item -ItemType Directory -Path (Join-Path $staging 'public')
    Copy-Item -Path (Join-Path $projectRoot 'frontend/dist/sidequest-frontend/browser/*') -Destination $public.FullName -Recurse
    Copy-Item -LiteralPath (Join-Path $projectRoot 'frontend/dist/sidequest-frontend/3rdpartylicenses.txt') -Destination $public.FullName
    # Azure Windows F1 richiede il driver SQLite a 32 bit.
    $prepareManifests = @'
const fs = require('node:fs');
const path = require('node:path');
const source = process.argv[1], target = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(source, 'package-lock.json'), 'utf8'));
manifest.scripts = { build: 'node --check dist/server.js', start: 'node dist/server.js',
  'db:init': 'node dist/scripts/initDatabase.js' };
delete manifest.devDependencies;
delete lock.packages[''].devDependencies;
for (const [name, content] of [['package.json', manifest], ['package-lock.json', lock]])
  fs.writeFileSync(path.join(target, name), JSON.stringify(content, null, 2));
'@
    & node -e $prepareManifests (Join-Path $projectRoot 'backend') $staging
    if ($LASTEXITCODE -ne 0) { throw 'Preparazione dei manifest non riuscita.' }
    $previousTargetArchitecture = $env:npm_config_arch
    Push-Location $staging
    try {
        $env:npm_config_arch = 'ia32'
        & npm.cmd ci --omit=dev --ignore-scripts --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Installazione delle dipendenze runtime non riuscita.' }
        & npm.cmd rebuild sqlite3 --foreground-scripts
        if ($LASTEXITCODE -ne 0) { throw 'Preparazione di SQLite Windows 32 bit non riuscita.' }
        $verifySqliteArchitecture = @'
const fs = require('node:fs');
const binary = fs.readFileSync('node_modules/sqlite3/build/Release/node_sqlite3.node');
// Il formato PE di Windows identifica l'architettura del modulo nativo.
const peHeaderPointerOffset = 0x3c;
const peSignatureSize = 4;
const machineI386 = 0x014c;
const peHeaderOffset = binary.readUInt32LE(peHeaderPointerOffset);
const machine = binary.readUInt16LE(peHeaderOffset + peSignatureSize);
if (machine !== machineI386) throw new Error('SQLite deve essere Windows 32 bit');
'@
        & node -e $verifySqliteArchitecture
        if ($LASTEXITCODE -ne 0) { throw 'Architettura del driver SQLite non valida.' }
    } finally {
        $env:npm_config_arch = $previousTargetArchitecture
        Pop-Location
    }
    Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $archive -Force
    Write-Output "Pacchetto Azure: $archive"
    Get-Item -LiteralPath $archive | Select-Object Name, Length
} finally {
    $resolved = [System.IO.Path]::GetFullPath($staging)
    $allowedRoot = [System.IO.Path]::GetFullPath($temporaryRoot) + [System.IO.Path]::DirectorySeparatorChar
    if (!$resolved.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Percorso temporaneo non valido: pulizia interrotta.'
    }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
