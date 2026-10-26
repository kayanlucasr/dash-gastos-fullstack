$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$iconDirectory = Join-Path $projectRoot 'assets/icons'
[System.IO.Directory]::CreateDirectory($iconDirectory) | Out-Null
$background = [System.Drawing.Drawing2D.GraphicsPath]::new()
$background.AddArc(8, 8, 104, 104, 180, 90)
$background.AddArc(144, 8, 104, 104, 270, 90)
$background.AddArc(144, 144, 104, 104, 0, 90)
$background.AddArc(8, 144, 104, 104, 90, 90)
$background.CloseFigure()
$glyph = [System.Drawing.Drawing2D.GraphicsPath]::new()
$font = [System.Drawing.FontFamily]::new('Segoe UI')
$glyph.AddString('$', $font, [int][System.Drawing.FontStyle]::Bold, 210, [System.Drawing.PointF]::new(0, 0), [System.Drawing.StringFormat]::GenericDefault)
$bounds = $glyph.GetBounds()
$scale = [Math]::Min(140 / $bounds.Width, 178 / $bounds.Height)
$matrix = [System.Drawing.Drawing2D.Matrix]::new($scale, 0, 0, $scale, 128 - ($bounds.X + $bounds.Width / 2) * $scale, 128 - ($bounds.Y + $bounds.Height / 2) * $scale)
$glyph.Transform($matrix)

# Persist the outlined glyph: the SVG and ICO do not depend on installed fonts.
$culture = [System.Globalization.CultureInfo]::InvariantCulture
function Point-Text($point) { return $point.X.ToString('0.###', $culture) + ',' + $point.Y.ToString('0.###', $culture) }
$commands = [System.Collections.Generic.List[string]]::new()
$points = $glyph.PathPoints
$types = $glyph.PathTypes
for ($index = 0; $index -lt $points.Length; $index++) {
  $kind = $types[$index] -band 7
  if ($kind -eq 0) { $commands.Add('M' + (Point-Text $points[$index])) }
  elseif ($kind -eq 1) { $commands.Add('L' + (Point-Text $points[$index])) }
  elseif ($kind -eq 3) {
    $commands.Add('C' + (Point-Text $points[$index]) + ' ' + (Point-Text $points[$index + 1]) + ' ' + (Point-Text $points[$index + 2]))
    $index += 2
  } else { throw 'Unexpected glyph path point' }
  if (($types[$index] -band 128) -ne 0) { $commands.Add('Z') }
}
$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect x="8" y="8" width="240" height="240" rx="52" fill="#047857"/><path fill="white" d="' + ($commands -join ' ') + '"/></svg>'
[System.IO.File]::WriteAllText((Join-Path $iconDirectory 'financeiro.svg'), $svg, [System.Text.UTF8Encoding]::new($false))

$master = [System.Drawing.Bitmap]::new(1024, 1024)
$graphics = [System.Drawing.Graphics]::FromImage($master)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.ScaleTransform(4, 4)
$green = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#047857'))
$graphics.FillPath($green, $background)
$graphics.FillPath([System.Drawing.Brushes]::White, $glyph)
$graphics.Dispose()
$images = [System.Collections.Generic.List[byte[]]]::new()
$sizes = @(16, 32, 48, 64, 128, 256)
foreach ($size in (@($sizes) + @(512))) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $canvas = [System.Drawing.Graphics]::FromImage($bitmap)
  $canvas.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $canvas.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $canvas.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $canvas.DrawImage($master, 0, 0, $size, $size)
  $stream = [System.IO.MemoryStream]::new()
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  [System.IO.File]::WriteAllBytes((Join-Path $iconDirectory "financeiro-$size.png"), $stream.ToArray())
  if ($size -ne 512) { $images.Add($stream.ToArray()) }
  $stream.Dispose(); $canvas.Dispose(); $bitmap.Dispose()
}
$output = [System.IO.MemoryStream]::new()
$writer = [System.IO.BinaryWriter]::new($output)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($index = 0; $index -lt $sizes.Count; $index++) {
  $dimension = $sizes[$index] % 256
  $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
  $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$images[$index].Length); $writer.Write([uint32]$offset)
  $offset += $images[$index].Length
}
foreach ($bytes in $images) { $writer.Write([byte[]]$bytes) }
[System.IO.File]::WriteAllBytes((Join-Path $iconDirectory 'financeiro.ico'), $output.ToArray())
$writer.Dispose(); $output.Dispose(); $master.Dispose(); $green.Dispose(); $glyph.Dispose(); $background.Dispose(); $font.Dispose(); $matrix.Dispose()
Write-Output 'Generated outlined SVG, PNG previews and six-resolution Windows ICO.'
