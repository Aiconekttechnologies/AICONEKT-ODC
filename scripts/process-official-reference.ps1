Add-Type -AssemblyName System.Drawing

$refPath = "C:\Users\Ravi\.gemini\antigravity\brain\7d952f17-5e81-46eb-b4e2-abbbe152bc85\.user_uploaded\media_1793110734221_88df683d.jpg"
$bmp = [System.Drawing.Bitmap]::FromFile($refPath)
Write-Host "Reference image dimensions: $($bmp.Width) x $($bmp.Height)"

$projectRoot = "C:\Users\Ravi\antigravity\AICONEKT-ODC"
$publicBrand = Join-Path $projectRoot "public\brand"
$srcBrand = Join-Path $projectRoot "src\assets\brand"

# 1. Save Master Official Logo JPG
$bmp.Save((Join-Path $publicBrand "aiconekt-official-logo.jpg"), [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Save((Join-Path $srcBrand "aiconekt-official-logo.jpg"), [System.Drawing.Imaging.ImageFormat]::Jpeg)

# 2. Extract Emblem Square Crop
$w = $bmp.Width
$h = $bmp.Height

# Emblem is centered horizontally in top half
$cropSize = [int]($w * 0.46)
$cropX = [int](($w / 2) - ($cropSize / 2))
$cropY = [int]($h * 0.08)

Write-Host "Cropping emblem at ($cropX, $cropY) with size $cropSize x $cropSize"
$rect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropSize, $cropSize)
$emblemCrop = $bmp.Clone($rect, $bmp.PixelFormat)

$emblemCrop.Save((Join-Path $publicBrand "aiconekt-emblem.jpg"), [System.Drawing.Imaging.ImageFormat]::Jpeg)
$emblemCrop.Save((Join-Path $publicBrand "aiconekt-emblem.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$emblemCrop.Save((Join-Path $srcBrand "aiconekt-emblem.jpg"), [System.Drawing.Imaging.ImageFormat]::Jpeg)
$emblemCrop.Save((Join-Path $srcBrand "aiconekt-emblem.png"), [System.Drawing.Imaging.ImageFormat]::Png)

# 3. Transparent Alpha Keyed Emblem PNG
$transEmblem = New-Object System.Drawing.Bitmap($cropSize, $cropSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $cropSize; $y++) {
    for ($x = 0; $x -lt $cropSize; $x++) {
        $pixel = $emblemCrop.GetPixel($x, $y)
        $r = [int]$pixel.R
        $g = [int]$pixel.G
        $b = [int]$pixel.B
        $max = [Math]::Max($r, [Math]::Max($g, $b))
        
        if ($max -lt 12) {
            $transEmblem.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($max -lt 45) {
            $alpha = [int](($max - 12) * (255 / 33))
            if ($alpha -gt 255) { $alpha = 255 }
            $transEmblem.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $r, $g, $b))
        } else {
            $transEmblem.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $g, $b))
        }
    }
}
$transEmblem.Save((Join-Path $publicBrand "aiconekt-emblem-transparent.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$transEmblem.Save((Join-Path $srcBrand "aiconekt-emblem-transparent.png"), [System.Drawing.Imaging.ImageFormat]::Png)

# 4. Transparent Alpha Keyed Full Logo PNG
$transLogo = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $pixel = $bmp.GetPixel($x, $y)
        $r = [int]$pixel.R
        $g = [int]$pixel.G
        $b = [int]$pixel.B
        $max = [Math]::Max($r, [Math]::Max($g, $b))
        
        if ($max -lt 12) {
            $transLogo.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($max -lt 45) {
            $alpha = [int](($max - 12) * (255 / 33))
            if ($alpha -gt 255) { $alpha = 255 }
            $transLogo.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $r, $g, $b))
        } else {
            $transLogo.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $g, $b))
        }
    }
}
$transLogo.Save((Join-Path $publicBrand "aiconekt-logo-transparent.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$transLogo.Save((Join-Path $srcBrand "aiconekt-logo-transparent.png"), [System.Drawing.Imaging.ImageFormat]::Png)

# 5. High-Resolution Favicons (128x128, 64x64, 32x32)
$fav128 = New-Object System.Drawing.Bitmap(128, 128, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g128 = [System.Drawing.Graphics]::FromImage($fav128)
$g128.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g128.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g128.DrawImage($transEmblem, 0, 0, 128, 128)
$g128.Dispose()
$fav128.Save((Join-Path $projectRoot "public\favicon-128.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$fav128.Dispose()

$fav64 = New-Object System.Drawing.Bitmap(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g64 = [System.Drawing.Graphics]::FromImage($fav64)
$g64.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g64.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g64.DrawImage($transEmblem, 0, 0, 64, 64)
$g64.Dispose()
$fav64.Save((Join-Path $projectRoot "public\favicon-64.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$fav64.Save((Join-Path $projectRoot "public\favicon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$fav64.Dispose()

$transLogo.Dispose()
$transEmblem.Dispose()
$emblemCrop.Dispose()
$bmp.Dispose()

Write-Host "SUCCESS: Brand assets and favicons successfully processed and saved."
