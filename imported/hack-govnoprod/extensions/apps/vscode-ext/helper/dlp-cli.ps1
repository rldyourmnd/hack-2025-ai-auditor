param([String[]]$args)

# Simple stub DLP CLI:
# - Usage: dlp-cli.ps1 scan --in <path> --out <path>
# - Exit 0: success, wrote cleaned text to --out
# - Exit >0: blocked or error

$in = $null; $out = $null
for ($i=0; $i -lt $args.Length; $i++) {
  if ($args[$i] -eq 'scan') { continue }
  elseif ($args[$i] -eq '--in'  -and $i+1 -lt $args.Length) { $in  = $args[$i+1]; $i++ }
  elseif ($args[$i] -eq '--out' -and $i+1 -lt $args.Length) { $out = $args[$i+1]; $i++ }
}
if (-not $in -or -not $out) { exit 2 }

try {
  $text = Get-Content -Raw -Encoding UTF8 $in
  # Block if contains sentinel word
  if ($text -match 'BLOCKME') { Write-Output 'Blocked by policy'; exit 3 }

  # Simple cleaning example: trim trailing spaces, normalize newlines
  $clean = ($text -replace "\r\n", "`n").TrimEnd()
  Set-Content -Encoding UTF8 -NoNewline -Path $out -Value $clean
  exit 0
} catch {
  exit 4
}


