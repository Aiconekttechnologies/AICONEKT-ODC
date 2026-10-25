Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $projectRoot "public\brand\aiconekt-official-logo.jpg"
$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)

$w = $bmp.Width
$h = $bmp.Height

Write-Host "Source image loaded: $w x $h"

# 1. Bounding box analysis for Emblem:
# In 1024x682:
# Center is ~512
# Emblem top: ~105, bottom: ~345
# Emblem left: ~310, right: ~715 (including flare)
# A square 380x380 centered at (512, 225) covers the entire emblem and flare perfectly!
$emblemCropSize = 400
$emblemX = [int](512 - ($emblemCropSize / 2))
$emblemY = 70

$emblemRect = New-Object System.Drawing.Rectangle($emblemX, $emblemY, $emblemCropSize, $emblemCropSize)
$emblemCrop = $bmp.Clone($emblemRect, $bmp.PixelFormat)

# Save standard emblem JPG and PNG
$emblemJpg = Join-Path $projectRoot "public\brand\aiconekt-emblem.jpg"
$emblemCrop.Save($emblemJpg, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$emblemPng = Join-Path $projectRoot "public\brand\aiconekt-emblem.png"
$emblemCrop.Save($emblemPng, [System.Drawing.Imaging.ImageFormat]::Png)

# 2. Transparent Emblem PNG (Alpha Keyed by luminance on dark background)
$transEmblem = New-Object System.Drawing.Bitmap($emblemCropSize, $emblemCropSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $emblemCropSize; $y++) {
    for ($x = 0; $x -lt $emblemCropSize; $x++) {
        $pixel = $emblemCrop.GetPixel($x, $y)
        $r = [int]$pixel.R
        $g = [int]$pixel.G
        $b = [int]$pixel.B
        $max = [Math]::Max($r, [Math]::Max($g, $b))
        
        # Soft alpha curve for glowing edges on black
        if ($max -lt 8) {
            $transEmblem.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($max -lt 40) {
            $alpha = [int](($max - 8) * (255 / 32))
            if ($alpha -gt 255) { $alpha = 255 }
            $transEmblem.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $r, $g, $b))
        } else {
            $transEmblem.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $g, $b))
        }
    }
}
$transEmblemPng = Join-Path $projectRoot "public\brand\aiconekt-emblem-transparent.png"
$transEmblem.Save($transEmblemPng, [System.Drawing.Imaging.ImageFormat]::Png)

# 3. Create high-res 128x128, 64x64, 32x32 Favicon
$fav128 = New-Object System.Drawing.Bitmap(128, 128, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g128 = [System.Drawing.Graphics]::FromImage($fav128)
$g128.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g128.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g128.DrawImage($transEmblem, 0, 0, 128, 128)
$g128.Dispose()
$fav128Png = Join-Path $projectRoot "public\favicon-128.png"
$fav128.Save($fav128Png, [System.Drawing.Imaging.ImageFormat]::Png)

$fav64 = New-Object System.Drawing.Bitmap(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g64 = [System.Drawing.Graphics]::FromImage($fav64)
$g64.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g64.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g64.DrawImage($transEmblem, 0, 0, 64, 64)
$g64.Dispose()
$fav64Png = Join-Path $projectRoot "public\favicon-64.png"
$fav64.Save($fav64Png, [System.Drawing.Imaging.ImageFormat]::Png)
$favPng = Join-Path $projectRoot "public\favicon.png"
$fav64.Save($favPng, [System.Drawing.Imaging.ImageFormat]::Png)

# 4. Transparent Full Logo PNG
$transLogo = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $pixel = $bmp.GetPixel($x, $y)
        $r = [int]$pixel.R
        $g = [int]$pixel.G
        $b = [int]$pixel.B
        $max = [Math]::Max($r, [Math]::Max($g, $b))
        
        if ($max -lt 8) {
            $transLogo.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($max -lt 40) {
            $alpha = [int](($max - 8) * (255 / 32))
            if ($alpha -gt 255) { $alpha = 255 }
            $transLogo.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $r, $g, $b))
        } else {
            $transLogo.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $g, $b))
        }
    }
}
$transLogoPng = Join-Path $projectRoot "public\brand\aiconekt-logo-transparent.png"
$transLogo.Save($transLogoPng, [System.Drawing.Imaging.ImageFormat]::Png)

# Also copy all to src/assets/brand
$brandSrc = Join-Path $projectRoot "public\brand\*"
$brandDest = Join-Path $projectRoot "src\assets\brand\"
Copy-Item -Path $brandSrc -Destination $brandDest -Force

$transLogo.Dispose()
$fav64.Dispose()
$fav128.Dispose()
$transEmblem.Dispose()
$emblemCrop.Dispose()
$bmp.Dispose()

Write-Host "All derivative brand assets generated with transparent alpha channels and high-fidelity crops!"
