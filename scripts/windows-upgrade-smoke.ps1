$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'backups/phase8/validation-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.id -notmatch '^[a-f0-9-]{36}$') { throw 'Invalid validation identity' }
$validationRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot "dist-installer/validation-$($manifest.id)"))
if ([System.IO.Path]::GetFullPath($manifest.folder) -ne $validationRoot) { throw 'Validation output mismatch' }
$name = 'Financeiro Validacao ' + $manifest.id.Substring(0, 8)
if ($manifest.name -ne $name) { throw 'Validation identity mismatch' }
$installDirectory = [System.IO.Path]::GetFullPath((Join-Path $validationRoot 'installed'))
$testProfile = [System.IO.Path]::GetFullPath((Join-Path ([System.IO.Path]::GetTempPath()) "financeiro-install-data-$($manifest.id)"))
if ([System.IO.Path]::GetDirectoryName($installDirectory) -ne $validationRoot -or [System.IO.Path]::GetDirectoryName($testProfile) -ne [System.IO.Path]::GetTempPath().TrimEnd('\')) { throw 'Invalid isolated paths' }
$registry = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
$desktop = [Environment]::GetFolderPath('Desktop')
$programs = [Environment]::GetFolderPath('Programs')
$links = @((Join-Path $desktop "$name.lnk"), (Join-Path $programs "$name.lnk"))
function Hash-File($file) {
  $stream = [System.IO.File]::OpenRead($file); $hash = [System.Security.Cryptography.SHA256]::Create()
  try { return [System.BitConverter]::ToString($hash.ComputeHash($stream)) } finally { $hash.Dispose(); $stream.Dispose() }
}
function Installation-Entries($displayName) {
  return @(Get-ChildItem $registry -ErrorAction SilentlyContinue | Get-ItemProperty | Where-Object DisplayName -eq $displayName)
}
function Personal-State {
  $entries = @(Installation-Entries 'Financeiro' | Sort-Object PSChildName | Select-Object PSChildName, DisplayVersion, UninstallString)
  $shortcuts = @((Join-Path $desktop 'Financeiro.lnk'), (Join-Path $programs 'Financeiro.lnk')) | ForEach-Object { if (Test-Path -LiteralPath $_) { Hash-File $_ } else { 'absent' } }
  return ([ordered]@{entries=$entries;shortcuts=$shortcuts} | ConvertTo-Json -Depth 4 -Compress)
}
if ((Installation-Entries $name).Count -gt 0 -or (Test-Path -LiteralPath $links[0]) -or (Test-Path -LiteralPath $links[1]) -or (Test-Path -LiteralPath $installDirectory) -or (Test-Path -LiteralPath $testProfile)) { throw 'An isolated test target already exists; preserved for inspection' }
$personalBefore = Personal-State
$oldProfile = $env:DESKTOP_SMOKE_PERSISTENT_PROFILE
$node = (Get-Command node).Source
$executable = Join-Path $installDirectory 'Financeiro.exe'
$database = Join-Path $testProfile 'data/dash-gastos.sqlite'
$report = [ordered]@{oldVersion='0.9.9';newVersion='1.0.0';baseline=$manifest.baseline;installed=$false;upgraded=$false;dataUnchangedBeforeNewLaunch=$false;financialSmokeAfterUpgrade=$false;shortcuts=$false;uninstalled=$false;dataPreservedAfterUninstall=$false;personalInstallationPreserved=$false;noTestProcesses=$false;windows=[Environment]::OSVersion.VersionString}
function Install-Version($version) {
  $installer = [System.IO.Path]::GetFullPath((Join-Path $validationRoot "$version/Financeiro-Validation-$version.exe"))
  if ([System.IO.Path]::GetDirectoryName([System.IO.Path]::GetDirectoryName($installer)) -ne $validationRoot) { throw 'Installer outside validation root' }
  $process = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installDirectory") -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Validation installer failed: $($process.ExitCode)" }
  $entry = @(Installation-Entries $name)
  if ($entry.Count -ne 1 -or $entry[0].DisplayVersion -ne $version -or -not $entry[0].UninstallString.Contains($installDirectory)) { throw 'Installed version/identity mismatch' }
}
function Smoke-Version($version) {
  & $node (Join-Path $PSScriptRoot 'packaged-smoke.cjs') $executable
  if ($LASTEXITCODE -ne 0) { throw 'Isolated executable smoke failed' }
  $runtime = Get-Content -LiteralPath (Join-Path $projectRoot 'backups/electron-smoke-success.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($runtime.appVersion -ne $version -or -not $runtime.databasePath.StartsWith($testProfile + '\')) { throw 'Runtime version/profile mismatch' }
  $processes = @(Get-Process -Name 'Financeiro' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $executable })
  if ($processes.Count -ne 0) { throw 'Isolated application processes remain after shutdown' }
}
try {
  $env:DESKTOP_SMOKE_PERSISTENT_PROFILE = $testProfile
  Install-Version '0.9.9'; $report.installed = $true
  $shell = New-Object -ComObject WScript.Shell
  foreach ($link in $links) { if (-not (Test-Path -LiteralPath $link) -or $shell.CreateShortcut($link).TargetPath -ne $executable) { throw 'Validation shortcut mismatch' } }
  $report.shortcuts = $true
  Smoke-Version '0.9.9'
  & $node (Join-Path $PSScriptRoot 'upgrade-fixture.cjs') $testProfile
  if ($LASTEXITCODE -ne 0) { throw 'Upgrade fixture failed' }
  $beforeUpgrade = Hash-File $database
  Install-Version '1.0.0'; $report.upgraded = $true
  if ((Hash-File $database) -ne $beforeUpgrade) { throw 'Installer changed the test database' }
  $report.dataUnchangedBeforeNewLaunch = $true
  Smoke-Version '1.0.0'; $report.financialSmokeAfterUpgrade = $true; $report.noTestProcesses = $true
  $beforeUninstall = Hash-File $database
  $uninstallers = @(Get-ChildItem -LiteralPath $installDirectory -Filter 'Uninstall *.exe' -File)
  if ($uninstallers.Count -ne 1 -or [System.IO.Path]::GetDirectoryName($uninstallers[0].FullName) -ne $installDirectory) { throw 'Uninstaller outside test installation' }
  $process = Start-Process -FilePath $uninstallers[0].FullName -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw 'Validation uninstaller failed' }
  $deadline = [DateTime]::UtcNow.AddSeconds(20)
  while ((Test-Path -LiteralPath $executable) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 200 }
  if ((Test-Path -LiteralPath $executable) -or (Test-Path -LiteralPath $links[0]) -or (Test-Path -LiteralPath $links[1]) -or (Installation-Entries $name).Count -ne 0) { throw 'Validation installation was not removed' }
  $report.uninstalled = $true
  if ((Hash-File $database) -ne $beforeUninstall) { throw 'Uninstaller changed test data' }
  $report.dataPreservedAfterUninstall = $true
  if ((Personal-State) -ne $personalBefore) { throw 'Personal installation metadata changed' }
  $report.personalInstallationPreserved = $true
} finally {
  $env:DESKTOP_SMOKE_PERSISTENT_PROFILE = $oldProfile
  $report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectRoot 'backups/phase8/windows-upgrade.json') -Encoding UTF8
  if ($report.uninstalled -and $report.dataPreservedAfterUninstall -and $report.personalInstallationPreserved) {
    if ([System.IO.Path]::GetDirectoryName($installDirectory) -ne $validationRoot -or [System.IO.Path]::GetDirectoryName($testProfile) -ne [System.IO.Path]::GetTempPath().TrimEnd('\')) { throw 'Invalid cleanup paths' }
    if (Test-Path -LiteralPath $installDirectory) { Remove-Item -LiteralPath $installDirectory -Recurse -Force }
    Remove-Item -LiteralPath $testProfile -Recurse -Force
  }
}
$report | ConvertTo-Json
