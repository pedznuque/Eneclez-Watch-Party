Add-Type -AssemblyName System.Drawing

$assetDir = Join-Path (Split-Path -Parent $PSScriptRoot) "client\src\assets"
$pngPath = Join-Path $assetDir "app-icon.png"
$icoPath = Join-Path $assetDir "app-icon.ico"
$pngTempPath = Join-Path $assetDir "app-icon.tmp.png"
$icoTempPath = Join-Path $assetDir "app-icon.tmp.ico"
$size = 256

function New-RoundRectPath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $Radius * 2
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-Pen {
    param(
        [System.Drawing.Color]$Color,
        [float]$Width
    )

    $pen = New-Object System.Drawing.Pen $Color, $Width
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    return $pen
}

$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::Transparent)

$outerPath = New-RoundRectPath 0 0 256 256 58
$graphics.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 8, 11, 16))), $outerPath)

$shellPath = New-RoundRectPath 14 14 228 228 52
$shellBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush `
    (New-Object System.Drawing.PointF 35, 20), `
    (New-Object System.Drawing.PointF 226, 236), `
    ([System.Drawing.Color]::FromArgb(255, 103, 224, 189)), `
    ([System.Drawing.Color]::FromArgb(255, 244, 185, 66))
$blend = New-Object System.Drawing.Drawing2D.ColorBlend 3
$blend.Positions = [float[]](0, .52, 1)
$blend.Colors = [System.Drawing.Color[]](
    [System.Drawing.Color]::FromArgb(255, 103, 224, 189),
    [System.Drawing.Color]::FromArgb(255, 67, 198, 172),
    [System.Drawing.Color]::FromArgb(255, 244, 185, 66)
)
$shellBrush.InterpolationColors = $blend
$graphics.FillPath($shellBrush, $shellPath)

$shadowPath = New-RoundRectPath 50 70 164 132 36
$graphics.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(58, 0, 0, 0))), $shadowPath)

$screenPath = New-RoundRectPath 46 52 164 141 36
$screenBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush `
    (New-Object System.Drawing.PointF 64, 54), `
    (New-Object System.Drawing.PointF 202, 184), `
    ([System.Drawing.Color]::FromArgb(255, 32, 40, 56)), `
    ([System.Drawing.Color]::FromArgb(255, 13, 18, 28))
$graphics.FillPath($screenBrush, $screenPath)

$innerPath = New-RoundRectPath 62 59 132 92 10
$graphics.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 18, 25, 35))), $innerPath)

$topPath = New-RoundRectPath 62 59 132 24 10
$graphics.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 31, 41, 56))), $topPath)

$dots = @(
    @(78, 72, 103, 224, 189),
    @(92, 72, 244, 185, 66),
    @(106, 72, 239, 71, 111)
)
foreach ($dot in $dots) {
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, $dot[2], $dot[3], $dot[4]))
    $graphics.FillEllipse($brush, $dot[0] - 4, $dot[1] - 4, 8, 8)
    $brush.Dispose()
}

$playPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$playPath.AddPolygon([System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF 113, 92),
    (New-Object System.Drawing.PointF 113, 146),
    (New-Object System.Drawing.PointF 164, 119)
))
$graphics.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 246, 250, 255))), $playPath)

$tealPen = New-Pen ([System.Drawing.Color]::FromArgb(230, 103, 224, 189)) 10
$goldPen = New-Pen ([System.Drawing.Color]::FromArgb(230, 244, 185, 66)) 10
$graphics.DrawLine($tealPen, 69, 168, 145, 168)
$graphics.DrawLine($goldPen, 160, 168, 186, 168)

$chatPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$chatPath.AddEllipse(139, 143, 62, 51)
$chatPath.AddPolygon([System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF 151, 184),
    (New-Object System.Drawing.PointF 138, 200),
    (New-Object System.Drawing.PointF 158, 192)
))
$graphics.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(205, 13, 18, 28))), $chatPath)

$whitePen = New-Pen ([System.Drawing.Color]::FromArgb(245, 246, 247, 251)) 7
$graphics.DrawLine($whitePen, 158, 167, 183, 167)
$graphics.DrawLine($whitePen, 158, 179, 174, 179)

$arcPen = New-Pen ([System.Drawing.Color]::FromArgb(82, 255, 255, 255)) 8
$graphics.DrawArc($arcPen, 142, 32, 84, 58, 204, 86)

$bitmap.Save($pngTempPath, [System.Drawing.Imaging.ImageFormat]::Png)
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$stream = [System.IO.File]::Open($icoTempPath, [System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Close()

$icon.Dispose()
$arcPen.Dispose()
$whitePen.Dispose()
$tealPen.Dispose()
$goldPen.Dispose()
$screenBrush.Dispose()
$shellBrush.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Move-Item -LiteralPath $pngTempPath -Destination $pngPath -Force
Move-Item -LiteralPath $icoTempPath -Destination $icoPath -Force

Write-Output "Wrote $pngPath"
Write-Output "Wrote $icoPath"
