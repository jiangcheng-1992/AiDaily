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

function Resolve-AndroidSdkPath {
  $candidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
    (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk")
  ) | Where-Object { $_ -and $_.Trim() }

  foreach ($candidate in $candidates) {
    $platformsDir = Join-Path $candidate "platforms"
    $platformToolsDir = Join-Path $candidate "platform-tools"
    if ((Test-Path $candidate) -and (Test-Path $platformsDir) -and (Test-Path $platformToolsDir)) {
      return (Resolve-Path $candidate).Path
    }
  }

  return $null
}

function Ensure-AndroidLocalProperties {
  $sdkPath = Resolve-AndroidSdkPath
  if (-not $sdkPath) {
    throw "Android SDK was not found. Install Android Studio, open SDK Manager, install Android SDK Platform + Build-Tools + Platform-Tools, then rerun this script."
  }

  $localPropertiesPath = Join-Path $androidDir "local.properties"
  $normalizedSdkPath = $sdkPath.Replace("\", "/")
  Set-Content -Path $localPropertiesPath -Value "sdk.dir=$normalizedSdkPath" -Encoding ASCII
  Write-Host "Android SDK: $sdkPath"
}

Push-Location $root
try {
  npm run apk:sync
  if ($LASTEXITCODE -ne 0) {
    throw "Capacitor sync failed with exit code $LASTEXITCODE."
  }

  Ensure-AndroidLocalProperties

  Push-Location $androidDir
  try {
    if ($Variant -eq "Release") {
      .\gradlew.bat assembleRelease
      if ($LASTEXITCODE -ne 0) {
        throw "Gradle assembleRelease failed with exit code $LASTEXITCODE."
      }
      Write-Host "Release APK: android\app\build\outputs\apk\release\app-release-unsigned.apk"
    } else {
      .\gradlew.bat assembleDebug
      if ($LASTEXITCODE -ne 0) {
        throw "Gradle assembleDebug failed with exit code $LASTEXITCODE."
      }
      Write-Host "Debug APK: android\app\build\outputs\apk\debug\app-debug.apk"
    }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}
