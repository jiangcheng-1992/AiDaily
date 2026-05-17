[CmdletBinding()]
param(
  [string]$Remote = "origin",
  [string]$Branch = "",
  [switch]$LoginOnly,
  [switch]$ConfigureOnly,
  [switch]$SkipAuthCheck
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$gitDir = Join-Path $repoRoot "_git"

if (-not (Test-Path -LiteralPath $gitDir)) {
  $gitDir = Join-Path $repoRoot ".git"
}

if (-not (Test-Path -LiteralPath $gitDir)) {
  throw "No Git metadata directory found. Expected _git or .git under $repoRoot."
}

function Invoke-RepoGit {
  & git --git-dir="$gitDir" --work-tree="$repoRoot" @args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($args -join ' ') failed with exit code $LASTEXITCODE."
  }
}

function Find-GitHubCli {
  if ($env:GH_PATH -and (Test-Path -LiteralPath $env:GH_PATH)) {
    return (Resolve-Path -LiteralPath $env:GH_PATH).Path
  }

  $fromPath = Get-Command gh -ErrorAction SilentlyContinue
  if ($fromPath) {
    return $fromPath.Source
  }

  $candidates = @(
    (Join-Path $repoRoot ".tools\gh_2.92.0\bin\gh.exe"),
    (Join-Path $repoRoot "ai_information_nexus\.tools\gh_2.92.0\bin\gh.exe"),
    (Join-Path $env:LOCALAPPDATA "GitHub CLI\gh.exe"),
    (Join-Path $env:ProgramFiles "GitHub CLI\gh.exe")
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  return $null
}

function Invoke-Gh {
  & $script:ghPath @args
  return $LASTEXITCODE
}

$script:ghPath = Find-GitHubCli

if (-not $script:ghPath) {
  throw "GitHub CLI was not found. Install it, or set GH_PATH to the full path of gh.exe."
}

Write-Host "Using GitHub CLI: $script:ghPath"

& git --git-dir="$gitDir" --work-tree="$repoRoot" config --local --unset-all credential.https://github.com.helper 2>$null
& git --git-dir="$gitDir" --work-tree="$repoRoot" config --local --add credential.https://github.com.helper "!'$script:ghPath' auth git-credential"

if ($ConfigureOnly) {
  Write-Host "Configured this repository to use GitHub CLI credentials."
  exit 0
}

if (-not $SkipAuthCheck) {
  Invoke-Gh auth status -h github.com
  $authStatus = $LASTEXITCODE

  if ($authStatus -ne 0) {
    Write-Host ""
    Write-Host "GitHub login is missing or expired. Starting browser/device-code login..."
    Write-Host "If this runs inside a restricted agent sandbox, run the same command in a normal PowerShell window."
    Invoke-Gh auth login -h github.com --web --git-protocol https

    if ($LASTEXITCODE -ne 0) {
      throw "GitHub login failed. Re-run this script from a normal PowerShell window with network access."
    }
  }

  Invoke-Gh auth setup-git -h github.com
  if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI could not configure Git credentials."
  }
}

if ($LoginOnly) {
  Write-Host "GitHub login is ready."
  exit 0
}

if (-not $Branch) {
  $Branch = (Invoke-RepoGit branch --show-current | Select-Object -Last 1).Trim()
}

if (-not $Branch) {
  throw "Could not determine the current Git branch."
}

Write-Host "Repository: $repoRoot"
Write-Host "Branch: $Branch"
Invoke-RepoGit status -sb
Invoke-RepoGit push -u $Remote $Branch
Write-Host "Push complete."
