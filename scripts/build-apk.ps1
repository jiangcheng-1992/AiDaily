param(
  [ValidateSet("Debug", "Release")]
  [string]$Variant = "Debug"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $root "android"

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Java/JDK is not installed or not in PATH. Install JDK 17+ first, then rerun this script."
}

Push-Location $root
try {
  npm run apk:sync
  Push-Location $androidDir
  try {
    if ($Variant -eq "Release") {
      .\gradlew.bat assembleRelease
      Write-Host "Release APK: android\app\build\outputs\apk\release\app-release-unsigned.apk"
    } else {
      .\gradlew.bat assembleDebug
      Write-Host "Debug APK: android\app\build\outputs\apk\debug\app-debug.apk"
    }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}
