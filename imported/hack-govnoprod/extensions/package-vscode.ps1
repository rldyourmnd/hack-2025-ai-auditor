param(
    [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Info($msg) { Write-Host "[vscode-pack] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[vscode-pack] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[vscode-pack] $msg" -ForegroundColor Red }

# Paths
$extensionsRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$extDir = Join-Path $extensionsRoot 'apps/vscode-ext'
$packDir = Join-Path $extDir '.pack'
${ioDir} = Join-Path $extensionsRoot 'packages/io'

if (-not (Test-Path $extDir)) {
    Write-Err "VS Code extension directory not found: $extDir"
    exit 1
}

Write-Info "Using extensions root: $extensionsRoot"
Write-Info "VS Code extension dir: $extDir"

# Ensure pnpm exists
try {
    $pnpmVersion = (pnpm --version) 2>$null
    Write-Info "pnpm: $pnpmVersion"
} catch {
    Write-Warn 'pnpm not found. Installing globally via npm...'
    npm i -g pnpm | Out-Null
}

# 1) Install workspace deps (extensions workspace)
Write-Info 'Installing workspace dependencies (extensions/)...'
Push-Location $extensionsRoot
pnpm install
Pop-Location

# 2) Build shared packages needed at runtime (e.g., @ai-auditor/io)
Write-Info 'Building runtime shared package @ai-auditor/io...'
if (Test-Path $ioDir) {
    Push-Location $ioDir
    pnpm install
    pnpm run build
    # pack to a local tarball for deterministic install into .pack
    $packed = (npm pack) | Select-Object -Last 1
    $ioTgz = Join-Path $ioDir $packed
    Pop-Location
    Write-Info ("Packed @ai-auditor/io -> {0}" -f $ioTgz)
} else {
    Write-Warn 'packages/io not found; continuing without local IO package. Upload features may fail if IO is required.'
}

# 3) Build the VS Code extension
Write-Info 'Building VS Code extension (tsc)...'
Push-Location $extDir
pnpm install
pnpm run build
Pop-Location

# 4) Prepare clean .pack directory
Write-Info 'Preparing clean .pack directory...'
if (Test-Path $packDir) { Remove-Item -Recurse -Force $packDir }
New-Item -ItemType Directory -Path $packDir | Out-Null

Copy-Item -Recurse -Force (Join-Path $extDir 'out') (Join-Path $packDir 'out')
Copy-Item -Recurse -Force (Join-Path $extDir 'scripts') (Join-Path $packDir 'scripts')
if (Test-Path (Join-Path $extDir 'helper')) { Copy-Item -Recurse -Force (Join-Path $extDir 'helper') (Join-Path $packDir 'helper') }
Copy-Item -Force (Join-Path $extDir 'package.json') (Join-Path $packDir 'package.json')
# Ensure assets are included in the .pack so vsce sees them (package.json files patterns expect assets/**/**)
if (Test-Path (Join-Path $extDir 'assets')) {
    Write-Info "Copying assets into .pack"
    Copy-Item -Recurse -Force (Join-Path $extDir 'assets') (Join-Path $packDir 'assets')
}

# Vendored IO (copy compiled lib into .pack/vendor/io for zero-install fallback)
if (Test-Path (Join-Path $ioDir 'lib')) {
    $vendIo = Join-Path $packDir 'vendor/io'
    Write-Info "Vendoring IO helpers into $vendIo"
    New-Item -ItemType Directory -Path $vendIo -Force | Out-Null
    Copy-Item -Recurse -Force (Join-Path $ioDir 'lib') (Join-Path $vendIo 'lib')
    # create a tiny index.js that re-exports lib/index.js
    Set-Content -Path (Join-Path $vendIo 'package.json') -Encoding UTF8 -Value '{"name":"vendor-io","main":"./lib/index.js"}'
    Set-Content -Path (Join-Path $vendIo 'index.js') -Encoding UTF8 -Value 'module.exports = require("./lib/index.js");'
    # Copy io package node_modules so runtime deps (e.g., undici) are available to vendored IO
    if (Test-Path (Join-Path $ioDir 'node_modules')) {
        $vendIoNode = Join-Path $vendIo 'node_modules'
        Write-Info "Copying @ai-auditor/io node_modules into $vendIoNode"
        Copy-Item -Recurse -Force (Join-Path $ioDir 'node_modules') $vendIoNode
    }
}

# We no longer mutate .pack/package.json dependencies (vsce dislikes file: deps).
# IO is vendored in .pack/vendor/io and loaded directly by the extension.

# Install a clean npm-style production node_modules inside .pack so `npm list` passes
$maxAttempts = 3
$attempt = 0
$installExit = 1
while ($attempt -lt $maxAttempts) {
    $attempt++
    Write-Info "Installing production dependencies into .pack via npm (attempt $attempt/$maxAttempts)..."
    Push-Location $packDir
    try {
        if (Test-Path package-lock.json) { Remove-Item package-lock.json -Force }
    } catch {}
    # run npm and capture exit code
    & npm install --omit=dev --no-audit --no-fund
    $installExit = $LASTEXITCODE
    Pop-Location
    if ($installExit -eq 0) {
        Write-Info 'npm install succeeded'
        break
    } else {
        Write-Warn "npm install failed with exit code $installExit"
        if ($attempt -lt $maxAttempts) { Start-Sleep -Seconds (2 * $attempt) }
    }
}
if ($installExit -ne 0) {
    Write-Err "Failed to install production dependencies into .pack after $maxAttempts attempts (exit $installExit). Aborting packaging."
    exit 1
}

# Verify required runtime modules exist in .pack/node_modules to avoid producing broken VSIX
$req1 = Join-Path $packDir 'node_modules\repomix'
$req2 = Join-Path $packDir 'node_modules\fast-glob'
$req3 = Join-Path $packDir 'node_modules\yazl'
if (-not (Test-Path $req1) -or -not (Test-Path $req2) -or -not (Test-Path $req3)) {
    $missing = @()
    if (-not (Test-Path $req1)) { $missing += 'repomix' }
    if (-not (Test-Path $req2)) { $missing += 'fast-glob' }
    if (-not (Test-Path $req3)) { $missing += 'yazl' }
    Write-Err "Required modules missing in .pack: $($missing -join ', ')"
    Write-Err 'VSIX will not be produced because runtime dependencies are missing in .pack. Re-run packaging or check network.'
    exit 1
}

$readmePath  = Join-Path $packDir 'README.md'
$licensePath = Join-Path $packDir 'LICENSE'
if (-not (Test-Path $readmePath))  { Set-Content -Path $readmePath  -Value '# AI Auditor VS Code Extension' -Encoding UTF8 }
if (-not (Test-Path $licensePath)) { Set-Content -Path $licensePath -Value 'UNLICENSED' -Encoding UTF8 }

# 5) Package via vsce (dlx)
Write-Info 'Packaging VSIX via @vscode/vsce...'
Push-Location $packDir
pnpm dlx @vscode/vsce package --allow-missing-repository
Pop-Location

# 6) Locate VSIX
$vsix = Get-ChildItem -Path $packDir -Filter '*.vsix' -File | Select-Object -First 1
if (-not $vsix) {
    Write-Err 'VSIX not produced.'
    exit 1
}

Write-Info ("VSIX produced: {0}" -f $vsix.FullName)

# 7) Install into VS Code (if code CLI is available and not disabled)
if (-not $NoInstall) {
    try {
        $codeVersion = (code --version)[0]
        Write-Info "Installing into VS Code (code $codeVersion)..."
        code --install-extension $vsix.FullName | Out-Null
        Write-Info 'Installed successfully. Restart VS Code if needed.'
    } catch {
        Write-Warn "VS Code CLI (code) not found in PATH. Install manually via VS Code: Extensions -> Install from VSIX..."
    }
} else {
    Write-Info 'Skipping installation (NoInstall switch).'
}

Write-Info 'Done.'


