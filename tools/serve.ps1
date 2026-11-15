param([string]$Root, [int]$Port = 8000)
$Root = (Resolve-Path $Root).Path
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.webmanifest'='application/manifest+json'; '.json'='application/json'; '.png'='image/png'; '.svg'='image/svg+xml'; '.md'='text/plain; charset=utf-8' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Output "Serving $Root on http://localhost:$Port/"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
  if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
  $path = [IO.Path]::GetFullPath((Join-Path $Root $rel))
  $res = $ctx.Response
  if ($path.StartsWith($Root) -and (Test-Path $path -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($path)
    $ext = [IO.Path]::GetExtension($path).ToLower()
    $res.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
    $res.Headers.Add('Cache-Control', 'no-cache')
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $res.StatusCode = 404 }
  Write-Output "$($ctx.Request.HttpMethod) /$rel $($res.StatusCode)"
  $res.Close()
}
