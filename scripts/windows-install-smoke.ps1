$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'dist-installer'))
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
$installer = Join-Path $outputRoot "Financeiro-Setup-$version.exe"
$testId = [guid]::NewGuid().ToString()
$installDirectory = [System.IO.Path]::GetFullPath((Join-Path $outputRoot "installation-test-$testId"))
$testProfile = [System.IO.Path]::GetFullPath((Join-Path ([System.IO.Path]::GetTempPath()) "financeiro-install-data-$testId"))
if (-not $installDirectory.StartsWith($outputRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Installation path outside test output' }
if ([System.IO.Path]::GetDirectoryName($testProfile) -ne [System.IO.Path]::GetTempPath().TrimEnd('\')) { throw 'Profile outside temp directory' }
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Financeiro.lnk'
$menuLink = Join-Path ([Environment]::GetFolderPath('Programs')) 'Financeiro.lnk'
$uninstallRegistry = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
$existing = @(Get-ChildItem $uninstallRegistry -ErrorAction SilentlyContinue | Get-ItemProperty | Where-Object DisplayName -eq 'Financeiro')
if ($existing.Count -gt 0 -or (Test-Path -LiteralPath $desktopLink) -or (Test-Path -LiteralPath $menuLink)) { throw 'An existing Financeiro installation or shortcut must be preserved; installation smoke was not started.' }
$report = [ordered]@{installed=$false;shortcuts=$false;executableTested=$false;reinstalled=$false;uninstalled=$false;profilePreserved=$false;windows=[Environment]::OSVersion.VersionString}
$oldProfile = $env:DESKTOP_SMOKE_PERSISTENT_PROFILE
$node = (Get-Command node).Source
function Get-TestDataHash($file) {
  $stream = [System.IO.File]::OpenRead($file)
  $hash = [System.Security.Cryptography.SHA256]::Create()
  try { return [System.BitConverter]::ToString($hash.ComputeHash($stream)) }
  finally { $hash.Dispose(); $stream.Dispose() }
}
function Install-TestApp {
  $process = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installDirectory") -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
  if (-not (Test-Path -LiteralPath (Join-Path $installDirectory 'Financeiro.exe'))) { throw 'Installed executable missing' }
}
function Uninstall-TestApp {
  $uninstaller = Join-Path $installDirectory 'Uninstall Financeiro.exe'
  if (-not (Test-Path -LiteralPath $uninstaller)) { throw 'Test uninstaller missing' }
  # Only execute the uninstaller in our verified isolated installation directory.
  $process = Start-Process -FilePath $uninstaller -ArgumentList @('/S') -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Uninstaller failed: $($process.ExitCode)" }
  $deadline = [DateTime]::UtcNow.AddSeconds(20)
  while ((Test-Path -LiteralPath (Join-Path $installDirectory 'Financeiro.exe')) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 200 }
  if (Test-Path -LiteralPath (Join-Path $installDirectory 'Financeiro.exe')) { throw 'Uninstallation did not remove the test executable' }
}
try {
  Install-TestApp
  $report.installed = $true
  $shell = New-Object -ComObject WScript.Shell
  foreach ($link in @($desktopLink, $menuLink)) {
    if (-not (Test-Path -LiteralPath $link)) { throw 'Installer shortcut missing' }
    $shortcut = $shell.CreateShortcut($link)
    if ($shortcut.TargetPath -ne (Join-Path $installDirectory 'Financeiro.exe')) { throw 'Shortcut points outside the isolated test installation' }
  }
  $report.shortcuts = $true
  $env:DESKTOP_SMOKE_PERSISTENT_PROFILE = $testProfile
  & $node (Join-Path $PSScriptRoot 'packaged-smoke.cjs') (Join-Path $installDirectory 'Financeiro.exe')
  if ($LASTEXITCODE -ne 0) { throw 'Installed executable smoke failed' }
  $report.executableTested = $true
  Install-TestApp
  & $node (Join-Path $PSScriptRoot 'packaged-smoke.cjs') (Join-Path $installDirectory 'Financeiro.exe')
  if ($LASTEXITCODE -ne 0) { throw 'Reinstalled executable smoke failed' }
  $report.reinstalled = $true
  $database = Join-Path $testProfile 'data/dash-gastos.sqlite'
  $before = Get-TestDataHash $database
  Uninstall-TestApp
  if ((Test-Path -LiteralPath $desktopLink) -or (Test-Path -LiteralPath $menuLink)) { throw 'Test shortcuts remained after uninstall' }
  $remaining = @(Get-ChildItem $uninstallRegistry -ErrorAction SilentlyContinue | Get-ItemProperty | Where-Object DisplayName -eq 'Financeiro')
  if ($remaining.Count -gt 0) { throw 'Test uninstall entry remained' }
  $report.uninstalled = $true
  if (-not (Test-Path -LiteralPath $database) -or (Get-TestDataHash $database) -ne $before) { throw 'Uninstaller changed the isolated persistent data' }
  $report.profilePreserved = $true
} finally {
  $env:DESKTOP_SMOKE_PERSISTENT_PROFILE = $oldProfile
  $report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputRoot 'windows-install-smoke.json') -Encoding UTF8
  # Failed installations are left in place for diagnosis, never broadly deleted.
  if ($report.uninstalled -and $report.profilePreserved) {
    if ([System.IO.Path]::GetDirectoryName($installDirectory) -ne $outputRoot -or -not [System.IO.Path]::GetFileName($installDirectory).StartsWith('installation-test-')) { throw 'Invalid installation cleanup target' }
    if ([System.IO.Path]::GetDirectoryName($testProfile) -ne [System.IO.Path]::GetTempPath().TrimEnd('\') -or -not [System.IO.Path]::GetFileName($testProfile).StartsWith('financeiro-install-data-')) { throw 'Invalid profile cleanup target' }
    if (Test-Path -LiteralPath $installDirectory) { Remove-Item -LiteralPath $installDirectory -Recurse -Force }
    Remove-Item -LiteralPath $testProfile -Recurse -Force
  }
}
$report | ConvertTo-Json
