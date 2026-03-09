# Download all Box files referenced in process-data.json
# READ ONLY - downloads only, touches nothing on Box

$ErrorActionPreference = "Continue"
$dataFile = "$PSScriptRoot\..\src\data\process-data.json"
$outDir = "$PSScriptRoot\..\..\box-downloads"

# Extract all unique Box URLs
$json = Get-Content $dataFile -Raw
$matches = [regex]::Matches($json, 'https://rescue(?:\.app)?\.box\.com/[^"]+')
$urls = $matches | ForEach-Object { $_.Value } | Sort-Object -Unique

Write-Host "Found $($urls.Count) unique Box URLs"
$downloaded = 0
$failed = 0
$skipped = 0

foreach ($url in $urls) {
    # Extract shared link hash or file ID
    if ($url -match '/s/([a-z0-9]+)') {
        $hash = $Matches[1]
        $filename = $hash
    } elseif ($url -match '/file/(\d+)') {
        $fileId = $Matches[1]
        $filename = $fileId
    } else {
        Write-Host "  SKIP (not a file link): $url" -ForegroundColor Yellow
        $skipped++
        continue
    }
    
    # Check if already downloaded (any extension)
    $existing = Get-ChildItem "$outDir\$filename.*" -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  EXISTS: $($existing.Name)" -ForegroundColor Gray
        $skipped++
        continue
    }

    # Try to download using box CLI shared-links
    try {
        if ($url -match '/file/(\d+)') {
            $fileId = $Matches[1]
            Write-Host "  Downloading file ID $fileId..." -ForegroundColor Cyan
            $info = box files:get $fileId --json 2>&1 | ConvertFrom-Json
            if ($info.name) {
                $ext = [System.IO.Path]::GetExtension($info.name)
                $outPath = "$outDir\$fileId$ext"
                box files:download $fileId --destination $outDir 2>&1 | Out-Null
                if (Test-Path "$outDir\$($info.name)") {
                    Write-Host "  OK: $($info.name)" -ForegroundColor Green
                    $downloaded++
                } else {
                    Write-Host "  FAIL: $fileId" -ForegroundColor Red
                    $failed++
                }
            }
        } else {
            Write-Host "  Shared link: $hash - trying via API..." -ForegroundColor Cyan
            # For shared links, we need to resolve them first
            $result = box shared-links:get $url --json 2>&1
            if ($result -match '"id"') {
                $obj = $result | ConvertFrom-Json
                if ($obj.type -eq 'file') {
                    $ext = [System.IO.Path]::GetExtension($obj.name)
                    box files:download $obj.id --destination $outDir 2>&1 | Out-Null
                    if (Test-Path "$outDir\$($obj.name)") {
                        Write-Host "  OK: $($obj.name)" -ForegroundColor Green
                        $downloaded++
                    } else {
                        Write-Host "  FAIL: $($obj.name)" -ForegroundColor Red  
                        $failed++
                    }
                } elseif ($obj.type -eq 'folder') {
                    Write-Host "  SKIP (folder): $($obj.name)" -ForegroundColor Yellow
                    $skipped++
                }
            } else {
                Write-Host "  FAIL (can't resolve): $hash" -ForegroundColor Red
                $failed++
            }
        }
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`nDone: $downloaded downloaded, $skipped skipped, $failed failed"
