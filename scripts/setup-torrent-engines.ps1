param([ValidateSet('TorrServer','CloudTorrent','Both')][string]$Engine='TorrServer')
$ErrorActionPreference='Stop'
$repoRoot=Split-Path -Parent $PSScriptRoot
$toolsDir=Join-Path $repoRoot '.tools/torrent-engines'
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
$releases=@(
    @{engine='TorrServer';file='TorrServer-MatriX.150-windows-amd64.exe';url='https://github.com/YouROK/TorrServer/releases/download/MatriX.150/TorrServer-windows-amd64.exe';sha256='3a96b97a24d86a90c0712a6ec47d4ed52edc7eabac1bce6a0d9bbc8fd30de5bb'},
    @{engine='CloudTorrent';file='cloud-torrent_0.10.0-rc.5_windows_amd64.gz';url='https://github.com/jpillora/cloud-torrent/releases/download/v0.10.0-rc.5/cloud-torrent_0.10.0-rc.5_windows_amd64.gz';sha256='edf8155d6aa8ebdbeafa4d1dada55a576e02eb1179e1ea5dec5f44f115791b90'}
)
foreach($release in $releases){
    if($Engine -ne 'Both' -and $release.engine -ne $Engine){continue}
    $target=Join-Path $toolsDir $release.file
    $valid=(Test-Path -LiteralPath $target) -and (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -eq $release.sha256
    if(-not $valid){
        & curl.exe -fL -C - --retry 2 --connect-timeout 15 --max-time 600 $release.url -o $target
        if($LASTEXITCODE -ne 0){throw 'Download incomplete. Run this script again to resume.'}
    }
    if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $release.sha256){throw ('Checksum mismatch: '+$release.file)}
    if($release.engine -eq 'CloudTorrent'){
        $inputFile=[IO.File]::OpenRead($target)
        $gzip=New-Object IO.Compression.GZipStream($inputFile,[IO.Compression.CompressionMode]::Decompress)
        $outputFile=[IO.File]::Create((Join-Path $toolsDir 'cloud-torrent_0.10.0-rc.5_windows_amd64.exe'))
        try{$gzip.CopyTo($outputFile)}finally{$outputFile.Dispose();$gzip.Dispose();$inputFile.Dispose()}
    }
    Write-Output ('Verified '+$release.engine+' in '+$toolsDir)
}
