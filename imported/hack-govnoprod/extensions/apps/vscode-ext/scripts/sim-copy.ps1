$ErrorActionPreference = 'Stop'
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('copy','paste','send','pasteAndSend')]
  [string] $Action,
  [switch] $logToFile
)

$shell = New-Object -ComObject WScript.Shell

function Write-Log {
  param([string]$msg)
  try {
    if ($logToFile) {
      $logPath = [System.IO.Path]::Combine($env:TEMP, "sim-copy-log.txt")
      Add-Content -Path $logPath -Value ("$(Get-Date -Format o) :: $msg") -Encoding UTF8
    } else {
      Write-Output $msg
    }
  } catch {}
}

function Set-ForegroundByTitle {
  param([string]$titlePart)
  try {
    Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class WinAPI {
      [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
      [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    }
"@
    try { [void][WinAPI]::FindWindow($null, $null) } catch {}
    return $false
  } catch { return $false }
}

if ($Action -eq 'copy') {
  # Try to gently activate a window that likely contains Cursor in the title
  try {
    # track whether AppActivate succeeded (kept for diagnostics)
    $activated = $false
    $titles = @("Cursor","cursor","Chat","chat","Chrome","Edge","Firefox")
    foreach ($t in $titles) {
      try {
        Write-Log ("Trying AppActivate: " + $t)
        if ($shell.AppActivate($t)) { Start-Sleep -Milliseconds 220; $activated = $true; Write-Log ("AppActivate succeeded: " + $t); break }
      } catch { Write-Log ("AppActivate error for " + $t + ": " + $_.ToString()) }
    }
    Write-Log ("AppActivate overall: " + $activated)
  } catch { Write-Log ("AppActivate outer error: " + $_.ToString()) }

  # Send select-all / copy with slightly longer pauses
  try {
    Write-Log 'Sending ^a'
    $shell.SendKeys('^a')
    Start-Sleep -Milliseconds 220
    Write-Log 'Sending ^c'
    $shell.SendKeys('^c')
    Start-Sleep -Milliseconds 320
    Write-Log 'Sent keys'
  } catch { Write-Log ("SendKeys failed: " + $_.ToString()); exit 1 }

} elseif ($Action -eq 'paste') {
  $shell.SendKeys('^v')
  Start-Sleep -Milliseconds 180
} elseif ($Action -eq 'send') {
  $shell.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 120
} elseif ($Action -eq 'pasteAndSend') {
  $shell.SendKeys('^v')
  Start-Sleep -Milliseconds 120
  $shell.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 120
}


