# Renders the original Reset66 icon (open progress ring + check) to PNG.
# Geometry matches icons/icon.svg (512 unit canvas). Windows PowerShell 5.1, no external deps.
# Usage: powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1

Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $outDir | Out-Null

$bg     = [System.Drawing.ColorTranslator]::FromHtml('#12151c')
$ring   = [System.Drawing.ColorTranslator]::FromHtml('#8b7bff')
$check  = [System.Drawing.ColorTranslator]::FromHtml('#4fd1a5')

function New-Icon {
  param(
    [int]$Size,
    [string]$Name,
    [double]$Scale = 1.0,      # artwork scale around centre (maskable uses < 1)
    [bool]$Rounded = $false    # rounded-corner background for "any" icons
  )

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $u = $Size / 512.0
  $bgBrush = New-Object System.Drawing.SolidBrush $bg

  if ($Rounded) {
    $r = 112 * $u; $d = 2 * $r
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($Size - $d, 0, $d, $d, 270, 90)
    $path.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
    $path.AddArc(0, $Size - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath($bgBrush, $path)
  } else {
    $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
  }

  # Map 512-unit artwork coordinates to pixels, scaled around the centre.
  $k = $u * $Scale
  $c = $Size / 2.0
  function P([double]$x, [double]$y) {
    New-Object System.Drawing.PointF ([single]($c + ($x - 256) * $k)), ([single]($c + ($y - 256) * $k))
  }

  $stroke = [single](36 * $k)

  $ringPen = New-Object System.Drawing.Pen $ring, $stroke
  $ringPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $ringPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $rad = 154 * $k
  # GDI+ angles are clockwise from 3 o'clock; gap of 60deg centred at 12 o'clock.
  $g.DrawArc($ringPen, [single]($c - $rad), [single]($c - $rad), [single](2 * $rad), [single](2 * $rad), -60, 300)

  $checkPen = New-Object System.Drawing.Pen $check, $stroke
  $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  [System.Drawing.PointF[]]$pts = @((P 192 262), (P 238 308), (P 324 212))
  $g.DrawLines($checkPen, $pts)

  $file = Join-Path $outDir $Name
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $ringPen.Dispose(); $checkPen.Dispose(); $bgBrush.Dispose()
  Write-Output "wrote $file"
}

New-Icon -Size 192 -Name 'icon-192.png' -Rounded $true
New-Icon -Size 512 -Name 'icon-512.png' -Rounded $true
# Maskable: full-bleed background, artwork kept inside the 80% safe zone.
New-Icon -Size 512 -Name 'icon-maskable-512.png' -Scale 0.8
# iOS applies its own corner mask; must be opaque and full-bleed.
New-Icon -Size 180 -Name 'apple-touch-icon.png'
