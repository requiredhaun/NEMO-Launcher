Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconPath = Join-Path $root 'build\icon.png'
$icon = [System.Drawing.Image]::FromFile($iconPath)

function New-Canvas($w, $h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Black)
  return @{ Bmp = $bmp; G = $g }
}

$fontBig = New-Object System.Drawing.Font('Consolas', 28, [System.Drawing.FontStyle]::Bold)
$fontSmall = New-Object System.Drawing.Font('Consolas', 11, [System.Drawing.FontStyle]::Bold)
$white = [System.Drawing.Brushes]::White
$red = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(215, 25, 32))
$gray = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 90, 90))

# --- header 150x57 ---
$c = New-Canvas 150 57
$c.G.DrawImage($icon, 4, 4, 49, 49)
$c.G.DrawString('NEMO', $fontBig, $white, 58, 2)
$c.G.FillRectangle($red, 60, 46, 80, 4)
$c.G.Dispose()
$c.Bmp.Save((Join-Path $root 'build\installerHeader.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
$c.Bmp.Dispose()

# --- sidebar 164x314 ---
$c = New-Canvas 164 314
$c.G.DrawImage($icon, 22, 30, 120, 120)
$c.G.DrawString('NEMO', $fontBig, $white, 38, 160)
$c.G.DrawString('MINECRAFT', $fontSmall, $gray, 42, 196)
$c.G.DrawString('LAUNCHER', $fontSmall, $gray, 46, 214)
$c.G.FillRectangle($red, 0, 300, 164, 14)
$c.G.Dispose()
$c.Bmp.Save((Join-Path $root 'build\installerSidebar.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
$c.Bmp.Dispose()

$icon.Dispose()
$fontBig.Dispose(); $fontSmall.Dispose(); $red.Dispose(); $gray.Dispose()
Write-Output 'installer images done'
