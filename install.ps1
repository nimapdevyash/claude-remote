# claude-remote runner installer (Windows PowerShell)
#
#   iwr https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.ps1 -useb | iex
#
# Checks for Node.js, fetches the runner CLI, and puts a claude-remote-runner
# command on your PATH. Only touches %USERPROFILE%\.claude-remote and
# %USERPROFILE%\.local\bin (plus your User PATH, with a message telling you so).

$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/nimapdevyash/claude-remote.git"
$ArchiveUrl = "https://github.com/nimapdevyash/claude-remote/archive/refs/heads/main.zip"
$InstallDir = Join-Path $env:USERPROFILE ".claude-remote"
$AppDir = Join-Path $InstallDir "app"
$BinDir = Join-Path $env:USERPROFILE ".local\bin"
$WrapperPath = Join-Path $BinDir "claude-remote-runner.cmd"

function Info($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "!! $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "Error: $msg" -ForegroundColor Red; exit 1 }

function Test-NodeVersion {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Fail "Node.js 18+ is required but wasn't found. Install it from https://nodejs.org, or `winget install OpenJS.NodeJS`, then re-run this installer."
  }
  $major = [int]((node -e "console.log(process.versions.node.split('.')[0])").Trim())
  if ($major -lt 18) {
    Fail "Node.js 18+ is required (found $(node -v)). Please upgrade and re-run this installer."
  }
}

function Get-App {
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

  if (Test-Path (Join-Path $AppDir ".git")) {
    Info "Updating existing install in $AppDir"
    git -C $AppDir fetch --depth=1 origin main
    git -C $AppDir reset --hard origin/main
    return
  }

  if (Test-Path $AppDir) { Remove-Item -Recurse -Force $AppDir }

  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($git) {
    Info "Cloning claude-remote into $AppDir"
    git clone --depth=1 $RepoUrl $AppDir
  } else {
    Info "git not found - downloading a source archive instead"
    $zipPath = Join-Path $InstallDir "source.zip"
    Invoke-WebRequest -Uri $ArchiveUrl -OutFile $zipPath -UseBasicParsing
    $extractDir = Join-Path $InstallDir "extract"
    Remove-Item -Recurse -Force $extractDir -ErrorAction SilentlyContinue
    Expand-Archive -Path $zipPath -DestinationPath $extractDir
    $inner = Get-ChildItem $extractDir | Select-Object -First 1
    Move-Item $inner.FullName $AppDir
    Remove-Item -Recurse -Force $extractDir, $zipPath
  }
}

function Install-RunnerDeps {
  Info "Installing runner dependencies"
  Push-Location (Join-Path $AppDir "runner")
  try {
    npm install --omit=dev --no-audit --no-fund --silent
  } finally {
    Pop-Location
  }
}

function Write-Wrapper {
  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  $runnerEntry = Join-Path $AppDir "runner\src\index.js"
  Set-Content -Path $WrapperPath -Value "@echo off`r`nnode `"$runnerEntry`" %*"
}

function Ensure-Path {
  $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
  if ($userPath -notlike "*$BinDir*") {
    Warn "Adding $BinDir to your User PATH (new terminals will pick it up)."
    [Environment]::SetEnvironmentVariable("PATH", "$userPath;$BinDir", "User")
    return $false
  }
  return $true
}

Info "Detected OS: Windows"
Test-NodeVersion
Get-App
Install-RunnerDeps
Write-Wrapper
$alreadyOnPath = Ensure-Path

Write-Host ""
Info "Installed: $WrapperPath"
Write-Host ""
if ($alreadyOnPath) {
  Info "Run it with: claude-remote-runner"
} else {
  Info "Open a new terminal, then run: claude-remote-runner"
}
Write-Host ""
Info "First run will walk you through server URL, folder, name, and sign-in."
