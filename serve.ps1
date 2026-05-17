param(
  [int]$Port = 8080,
  [string]$BindAddress = "0.0.0.0",
  [string]$Root = (Get-Location).Path
)

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif" = "image/gif"
  ".svg" = "image/svg+xml"
  ".webp" = "image/webp"
  ".mp3" = "audio/mpeg"
  ".wav" = "audio/wav"
  ".ico" = "image/x-icon"
}

$rootPath = [System.IO.Path]::GetFullPath($Root)

if ($BindAddress -eq "0.0.0.0" -or $BindAddress -eq "*" -or $BindAddress -eq "any") {
  $listenAddress = [System.Net.IPAddress]::Any
  $displayAddress = "0.0.0.0"
}
elseif ($BindAddress -eq "localhost") {
  $listenAddress = [System.Net.IPAddress]::Loopback
  $displayAddress = "localhost"
}
else {
  $listenAddress = [System.Net.IPAddress]::Parse($BindAddress)
  $displayAddress = $BindAddress
}

$listener = [System.Net.Sockets.TcpListener]::new($listenAddress, $Port)
$listener.Start()

Write-Output "Serving $rootPath at http://${displayAddress}:${Port}/"
if ($listenAddress.Equals([System.Net.IPAddress]::Any)) {
  Write-Output "Network access enabled for devices on the same Wi-Fi."
}

function Send-Bytes {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [byte[]]$Bytes
  )

  $Stream.Write($Bytes, 0, $Bytes.Length)
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$ContentType,
    [byte[]]$Body
  )

  $header = @(
    "HTTP/1.1 $StatusCode $StatusText"
    "Content-Type: $ContentType"
    "Content-Length: $($Body.Length)"
    "Connection: close"
    ""
    ""
  ) -join "`r`n"

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  Send-Bytes -Stream $Stream -Bytes $headerBytes
  Send-Bytes -Stream $Stream -Bytes $Body
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()

    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        $emptyBody = [System.Text.Encoding]::UTF8.GetBytes("Bad Request")
        Send-Response -Stream $stream -StatusCode 400 -StatusText "Bad Request" -ContentType "text/plain; charset=utf-8" -Body $emptyBody
        continue
      }

      while ($true) {
        $headerLine = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($headerLine)) {
          break
        }
      }

      $parts = $requestLine.Split(" ")
      $method = $parts[0]
      $rawPath = if ($parts.Length -ge 2) { $parts[1] } else { "/" }

      if ($method -ne "GET" -and $method -ne "HEAD") {
        $methodBody = [System.Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
        Send-Response -Stream $stream -StatusCode 405 -StatusText "Method Not Allowed" -ContentType "text/plain; charset=utf-8" -Body $methodBody
        continue
      }

      $cleanPath = $rawPath.Split("?")[0].TrimStart("/")
      if ([string]::IsNullOrWhiteSpace($cleanPath)) {
        $cleanPath = "index.html"
      }

      $cleanPath = [System.Uri]::UnescapeDataString($cleanPath) -replace "/", "\"
      $fullPath = [System.IO.Path]::GetFullPath((Join-Path $rootPath $cleanPath))

      if (-not $fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        $notFoundBody = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        Send-Response -Stream $stream -StatusCode 404 -StatusText "Not Found" -ContentType "text/plain; charset=utf-8" -Body $notFoundBody
        continue
      }

      $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
      $contentType = if ($contentTypes.ContainsKey($extension)) { $contentTypes[$extension] } else { "application/octet-stream" }
      $body = [System.IO.File]::ReadAllBytes($fullPath)

      if ($method -eq "HEAD") {
        Send-Response -Stream $stream -StatusCode 200 -StatusText "OK" -ContentType $contentType -Body ([byte[]]::new(0))
      }
      else {
        Send-Response -Stream $stream -StatusCode 200 -StatusText "OK" -ContentType $contentType -Body $body
      }
    }
    finally {
      if ($reader) {
        $reader.Dispose()
      }
      if ($stream) {
        $stream.Dispose()
      }
      $client.Dispose()
    }
  }
}
finally {
  $listener.Stop()
}
