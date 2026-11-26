param(
    [Parameter(Mandatory=$true)][string]$OutputApk,
    [string]$SdkPath = $env:ANDROID_HOME,
    [string]$JavaPath = $env:JAVA_HOME,
    [string]$SigningKey = (Join-Path $PSScriptRoot '.sign/maredelinha.p12')
)

$ErrorActionPreference = 'Stop'
if (!$SdkPath -or !$JavaPath) { throw 'Informe -SdkPath e -JavaPath ou configure ANDROID_HOME e JAVA_HOME.' }
$env:JAVA_HOME = (Resolve-Path -LiteralPath $JavaPath).Path
$buildTools = Join-Path $SdkPath 'build-tools/35.0.0'
$platform = Join-Path $SdkPath 'platforms/android-35/android.jar'
$java = Join-Path $env:JAVA_HOME 'bin'
$android = Join-Path $PSScriptRoot 'android'
$workspace = Join-Path $PSScriptRoot 'android-build'
$outputPath = [IO.Path]::GetFullPath($OutputApk, (Get-Location).Path)
$keyPath = [IO.Path]::GetFullPath($SigningKey, (Get-Location).Path)

function Invoke-Tool($Tool, [string[]]$Arguments) {
    & $Tool @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Tool retornou código $LASTEXITCODE." }
}

New-Item -ItemType Directory -Force "$workspace/classes", "$workspace/dex", (Split-Path $outputPath -Parent), (Split-Path $keyPath -Parent) | Out-Null
Invoke-Tool 'node' @((Join-Path $PSScriptRoot 'build-web.mjs'))
Invoke-Tool "$buildTools/aapt2.exe" @('compile','--dir',"$android/res",'-o',"$workspace/resources.zip")
Invoke-Tool "$buildTools/aapt2.exe" @('link','-o',"$workspace/unsigned.apk",'-I',$platform,'--manifest',"$android/AndroidManifest.xml","$workspace/resources.zip")
$sources = @(Get-ChildItem "$android/src" -Recurse -Filter '*.java' | ForEach-Object FullName)
Invoke-Tool "$java/javac.exe" (@('--release','8','-encoding','UTF-8','-cp',$platform,'-d',"$workspace/classes") + $sources)
$classes = @(Get-ChildItem "$workspace/classes" -Recurse -Filter '*.class' | ForEach-Object FullName)
Invoke-Tool "$buildTools/d8.bat" (@('--lib',$platform,'--min-api','24','--release','--output',"$workspace/dex") + $classes)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open("$workspace/unsigned.apk",[IO.Compression.ZipArchiveMode]::Update)
try {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,"$workspace/dex/classes.dex",'classes.dex') | Out-Null
    $web = Join-Path $PSScriptRoot 'web'
    foreach ($file in Get-ChildItem -LiteralPath $web -File -Recurse) {
        $assetName = [IO.Path]::GetRelativePath($web,$file.FullName).Replace('\','/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,"assets/$assetName") | Out-Null
    }
}
finally { $zip.Dispose() }
Invoke-Tool "$buildTools/zipalign.exe" @('-f','4',"$workspace/unsigned.apk","$workspace/aligned.apk")

$generatedPassword = "$keyPath.password"
if (!$env:MARE_KEY_PASSWORD) {
    if (!(Test-Path -LiteralPath $generatedPassword) -and !(Test-Path -LiteralPath $keyPath)) {
        $secret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
        [IO.File]::WriteAllText($generatedPassword,$secret)
    }
    if (!(Test-Path -LiteralPath $generatedPassword)) { throw 'Defina MARE_KEY_PASSWORD para a chave informada.' }
    $env:MARE_KEY_PASSWORD = [IO.File]::ReadAllText($generatedPassword).Trim()
}
if (!(Test-Path -LiteralPath $keyPath)) {
    Invoke-Tool "$java/keytool.exe" @('-genkeypair','-keystore',$keyPath,'-storetype','PKCS12','-storepass:env','MARE_KEY_PASSWORD','-alias','maredelinha','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Mare de Linha, O=Mare de Linha, C=BR','-noprompt')
}
Invoke-Tool "$buildTools/apksigner.bat" @('sign','--ks',$keyPath,'--ks-key-alias','maredelinha','--ks-pass','env:MARE_KEY_PASSWORD','--v4-signing-enabled','false','--out',$outputPath,"$workspace/aligned.apk")
Invoke-Tool "$buildTools/apksigner.bat" @('verify','--verbose',$outputPath)
Get-Item -LiteralPath $outputPath | Select-Object FullName, Length
