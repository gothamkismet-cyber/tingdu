$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$tingduIconDirectory=Join-Path $PSScriptRoot '../desktop/assets'
[IO.Directory]::CreateDirectory($tingduIconDirectory) | Out-Null
$tingduFrames=New-Object 'System.Collections.Generic.List[byte[]]'
$tingduSizes=@(16,32,48,64,128,256)
foreach($tingduSize in $tingduSizes){
  $tingduBitmap=New-Object Drawing.Bitmap($tingduSize,$tingduSize)
  $tingduGraphics=[Drawing.Graphics]::FromImage($tingduBitmap)
  $tingduGraphics.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $tingduGraphics.Clear([Drawing.Color]::Transparent)
  $tingduPath=New-Object Drawing.Drawing2D.GraphicsPath
  $tingduRadius=[single]($tingduSize*.4)
  $tingduEdge=[single]($tingduSize-1)
  $tingduPath.AddArc(0,0,$tingduRadius,$tingduRadius,180,90)
  $tingduPath.AddArc($tingduEdge-$tingduRadius,0,$tingduRadius,$tingduRadius,270,90)
  $tingduPath.AddArc($tingduEdge-$tingduRadius,$tingduEdge-$tingduRadius,$tingduRadius,$tingduRadius,0,90)
  $tingduPath.AddArc(0,$tingduEdge-$tingduRadius,$tingduRadius,$tingduRadius,90,90)
  $tingduPath.CloseFigure()
  $tingduBrush=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(49,89,234))
  $tingduGraphics.FillPath($tingduBrush,$tingduPath)
  $tingduPen=New-Object Drawing.Pen([Drawing.Color]::White,([single]($tingduSize*.075)))
  $tingduPen.StartCap=[Drawing.Drawing2D.LineCap]::Round
  $tingduPen.EndCap=[Drawing.Drawing2D.LineCap]::Round
  $tingduHeights=@(.24,.54,.35,.63)
  for($tingduIndex=0;$tingduIndex -lt 4;$tingduIndex++){
    $tingduX=[single]($tingduSize*(.25+.17*$tingduIndex))
    $tingduHalf=[single]($tingduSize*$tingduHeights[$tingduIndex]/2)
    $tingduGraphics.DrawLine($tingduPen,$tingduX,[single]($tingduSize/2-$tingduHalf),$tingduX,[single]($tingduSize/2+$tingduHalf))
  }
  $tingduMemory=New-Object IO.MemoryStream
  $tingduBitmap.Save($tingduMemory,[Drawing.Imaging.ImageFormat]::Png)
  $tingduFrames.Add($tingduMemory.ToArray())
  if($tingduSize -eq 256){[IO.File]::WriteAllBytes((Join-Path $tingduIconDirectory 'icon.png'),$tingduMemory.ToArray())}
  $tingduMemory.Dispose();$tingduGraphics.Dispose();$tingduBitmap.Dispose();$tingduBrush.Dispose();$tingduPen.Dispose();$tingduPath.Dispose()
}
$tingduFile=[IO.File]::Create((Join-Path $tingduIconDirectory 'icon.ico'))
$tingduWriter=New-Object IO.BinaryWriter($tingduFile)
$tingduWriter.Write([uint16]0);$tingduWriter.Write([uint16]1);$tingduWriter.Write([uint16]$tingduFrames.Count)
$tingduOffset=6+16*$tingduFrames.Count
for($tingduIndex=0;$tingduIndex -lt $tingduFrames.Count;$tingduIndex++){
  $tingduDimension=if($tingduSizes[$tingduIndex] -eq 256){0}else{$tingduSizes[$tingduIndex]}
  $tingduWriter.Write([byte]$tingduDimension);$tingduWriter.Write([byte]$tingduDimension);$tingduWriter.Write([byte]0);$tingduWriter.Write([byte]0)
  $tingduWriter.Write([uint16]1);$tingduWriter.Write([uint16]32);$tingduWriter.Write([uint32]$tingduFrames[$tingduIndex].Length);$tingduWriter.Write([uint32]$tingduOffset)
  $tingduOffset+=$tingduFrames[$tingduIndex].Length
}
foreach($tingduFrame in $tingduFrames){$tingduWriter.Write($tingduFrame)}
$tingduWriter.Dispose();$tingduFile.Dispose()
Write-Output 'Tingdu icon generated.'
