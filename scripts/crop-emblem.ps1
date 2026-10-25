Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $projectRoot "public\brand\aiconekt-official-logo.jpg"
$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)

Write-Host "Image dimensions: $($bmp.Width) x $($bmp.Height)"

# Crop emblem: roughly centered horizontally, in the top half
# Bounding box around emblem:
# Center X is around 512
# The emblem spans approximately Y from 100 to 350, X from 300 to 720
$emblemSize = 340
$cropX = [int](512 - ($emblemSize / 2))
$cropY = 85

$rect = New-Object System.Drawing.Rectangle($cropX, $cropY, $emblemSize, $emblemSize)
$emblemBmp = $bmp.Clone($rect, $bmp.PixelFormat)

$destPath = Join-Path $projectRoot "public\brand\aiconekt-emblem.jpg"
$emblemBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)

# Also save PNG for transparency / high quality
$destPng = Join-Path $projectRoot "public\brand\aiconekt-emblem.png"
$emblemBmp.Save($destPng, [System.Drawing.Imaging.ImageFormat]::Png)

# Also create a 64x64 and 32x32 favicon
$favBmp = New-Object System.Drawing.Bitmap(64, 64)
$g = [System.Drawing.Graphics]::FromImage($favBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($emblemBmp, 0, 0, 64, 64)
$g.Dispose()
$favPath = Join-Path $projectRoot "public\favicon.png"
$favBmp.Save($favPath, [System.Drawing.Imaging.ImageFormat]::Png)
$favBmp.Dispose()

$emblemBmp.Dispose()
$bmp.Dispose()

Write-Host "Emblem and favicon crops created successfully!"
