$projectRoot = "C:\Users\javil\Desktop\token"
$zipPath = "C:\Users\javil\Desktop\token\alpha_centauri_audit_sources.zip"
$artifactZipPath = "C:\Users\javil\.gemini\antigravity\brain\03022e08-efc5-40cb-9e90-72709dbd4c3d\alpha_centauri_audit_sources.zip"

if (Test-Path $zipPath) { 
    Remove-Item $zipPath -Force 
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

$excludedRegex = '(\\node_modules\\|\\\.git\\|contracts\\out\\|contracts\\cache\\|contracts\\broadcast\\|frontend\\dist\\|frontend\\\.vite\\|test-results\\|services\\[^\\]+\\dist\\|reports\\|\.log$|\.env$|\.env\.local$|\.zip$)'

$allFiles = Get-ChildItem -Path $projectRoot -Recurse -File | Where-Object {
    $relPath = $_.FullName.Substring($projectRoot.Length + 1)
    $_.FullName -notmatch $excludedRegex -and
    $_.Name -ne '.env' -and
    $_.Name -ne 'alpha_centauri_audit_sources.zip'
}

Write-Host "Files to archive: $($allFiles.Count)"

foreach ($file in $allFiles) {
    $relPath = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relPath, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
}

$zip.Dispose()

Copy-Item $zipPath $artifactZipPath -Force

$zipItem = Get-Item $zipPath
Write-Host "Archive created successfully!"
Write-Host "Archive Path: $($zipItem.FullName)"
Write-Host "Archive Size (KB): $([math]::Round($zipItem.Length / 1KB, 2))"
