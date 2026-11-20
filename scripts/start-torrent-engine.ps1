param(
    [ValidateSet('TorrServer','CloudTorrent')][string]$Engine='TorrServer',
    [ValidateRange(1024,65535)][int]$Port=8095,
    [switch]$VerifyOnly
)
$ErrorActionPreference='Stop'
$repoRoot=Split-Path -Parent $PSScriptRoot
$toolsDir=Join-Path $repoRoot '.tools/torrent-engines'
if($Engine -eq 'TorrServer'){
    $binary=Join-Path $toolsDir 'TorrServer-MatriX.150-windows-amd64.exe'
    if(-not(Test-Path -LiteralPath $binary)){throw 'Run scripts/setup-torrent-engines.ps1 first.'}
    if((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant() -ne '3a96b97a24d86a90c0712a6ec47d4ed52edc7eabac1bce6a0d9bbc8fd30de5bb'){throw 'TorrServer release checksum mismatch'}
}else{
    $archive=Join-Path $toolsDir 'cloud-torrent_0.10.0-rc.5_windows_amd64.gz'
    $binary=Join-Path $toolsDir 'cloud-torrent_0.10.0-rc.5_windows_amd64.exe'
    if(-not(Test-Path -LiteralPath $archive) -or -not(Test-Path -LiteralPath $binary)){throw 'Run scripts/setup-torrent-engines.ps1 -Engine CloudTorrent first.'}
    if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'edf8155d6aa8ebdbeafa4d1dada55a576e02eb1179e1ea5dec5f44f115791b90'){throw 'Cloud Torrent archive checksum mismatch'}
    $inputFile=[IO.File]::OpenRead($archive)
    $gzip=New-Object IO.Compression.GZipStream($inputFile,[IO.Compression.CompressionMode]::Decompress)
    $sha=[Security.Cryptography.SHA256]::Create()
    try{$expected=[BitConverter]::ToString($sha.ComputeHash($gzip)).Replace('-','')}finally{$sha.Dispose();$gzip.Dispose();$inputFile.Dispose()}
    if((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -ne $expected){throw 'Cloud Torrent executable does not match its verified release archive'}
}
if($VerifyOnly){Write-Output ('Verified '+$Engine);return}
$probe=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,$Port)
try{$probe.Start()}catch{throw ('Local port '+$Port+' is in use. Choose another -Port.')}
finally{$probe.Stop()}
$dataDir=Join-Path $toolsDir ('interactive/'+$Engine)
$stateDir=Join-Path $dataDir 'state'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
if($Engine -eq 'TorrServer'){
    $settingsPath=Join-Path $stateDir 'settings.json'
    if(-not(Test-Path -LiteralPath $settingsPath)){
        $settings=@{CacheSize=134217728;ReaderReadAHead=95;PreloadCache=10;UseDisk=$false;DisableUPNP=$true;EnableDLNA=$false;EnableBonjour=$false;EnableLPD=$false;DownloadRateLimit=0;UploadRateLimit=0;ConnectionsLimit=100;StoreSettingsInJson=$true;ResponsiveMode=$true}
        [IO.File]::WriteAllText($settingsPath,($settings|ConvertTo-Json))
    }
    $arguments=@('--ip','127.0.0.1','--port',[string]$Port,'--path',('"'+$stateDir+'"'),'--torrentaddr','127.0.0.1:0')
}else{
    $configPath=Join-Path $dataDir 'config.json'
    if(-not(Test-Path -LiteralPath $configPath)){
        $config=@{DownloadDirectory=(Join-Path $dataDir 'downloads');AutoStart=$true;IncomingPort=0;DownloadLimitKiB=0;UploadLimitKiB=0;EnableUpload=$true;EnableSeeding=$true}
        [IO.File]::WriteAllText($configPath,($config|ConvertTo-Json))
    }
    $arguments=@('--host','127.0.0.1','--port',[string]$Port,'--config-path',('"'+$configPath+'"'),'--state-directory',('"'+$stateDir+'"'))
}
$stdinPath=Join-Path $dataDir 'stdin.empty'
[IO.File]::WriteAllText($stdinPath,'')
$process=Start-Process -FilePath $binary -ArgumentList $arguments -WorkingDirectory $dataDir -WindowStyle Hidden -PassThru -RedirectStandardInput $stdinPath -RedirectStandardOutput (Join-Path $dataDir 'stdout.log') -RedirectStandardError (Join-Path $dataDir 'stderr.log')
Write-Output ($Engine+' started as process '+$process.Id+'. Open http://127.0.0.1:'+$Port)
Write-Output ('To stop this instance: Stop-Process -Id '+$process.Id)
Write-Output 'This standalone server is separate from Watch Party and is bound only to localhost.'
