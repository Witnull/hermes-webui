<#
.SYNOPSIS
    Native Windows stopper for Hermes WebUI.

.DESCRIPTION
    Stops a running Hermes WebUI instance on Windows. Locates the process
    by inspecting the configured TCP port (default 8787 or HERMES_WEBUI_PORT / .env)
    and any recorded PID files. Gracefully requests process termination,
    polling until the port is released, and forces termination if needed.

.PARAMETER Port
    TCP port of the WebUI to stop. Overrides HERMES_WEBUI_PORT env.
    Default: 8787.

.PARAMETER Force
    Immediately force-kill the WebUI process without waiting for graceful exit.

.EXAMPLE
    .\stop.ps1
    # Stop Hermes WebUI on default port (8787)

.EXAMPLE
    .\stop.ps1 -Port 9000
    # Stop Hermes WebUI on port 9000

.EXAMPLE
    .\stop.ps1 -Force
    # Force-kill immediately
#>

[CmdletBinding()]
param(
    [int]$Port = 0,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSCommandPath

# === Load .env for port default if not explicitly provided =============
$envFile = Join-Path $RepoRoot '.env'
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile -Encoding UTF8) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#') -or -not $trimmed.Contains('=')) { continue }
        $kv = $trimmed -split '=', 2
        $key = ($kv[0].Trim() -replace '^export\s+', '')
        if ($key -in @('UID', 'GID', 'EUID', 'EGID', 'PPID')) { continue }
        if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { continue }
        if ($null -ne [Environment]::GetEnvironmentVariable($key)) { continue }
        $val = $kv[1]
        if ($val -match '^"(.*)"$') { $val = $Matches[1] }
        elseif ($val -match "^'(.*)'$") { $val = $Matches[1] }
        [Environment]::SetEnvironmentVariable($key, $val)
    }
}

# === Resolve target port ===============================================
$TargetPort = if ($Port -gt 0) {
    $Port
} elseif ($env:HERMES_WEBUI_PORT) {
    $p = 0
    if ([int]::TryParse($env:HERMES_WEBUI_PORT, [ref]$p) -and $p -ge 1 -and $p -le 65535) { $p } else { 8787 }
} else {
    8787
}

# === Resolve Hermes Home & PID File ====================================
$HomeDir = if ($env:HERMES_HOME) {
    $env:HERMES_HOME
} elseif ($env:LOCALAPPDATA) {
    Join-Path $env:LOCALAPPDATA 'hermes'
} else {
    Join-Path $env:USERPROFILE '.hermes'
}

$PidFile = if ($env:HERMES_WEBUI_PID_FILE) {
    $env:HERMES_WEBUI_PID_FILE
} else {
    Join-Path $HomeDir 'webui.pid'
}

# === Discover target processes =========================================
$pidsToStop = [System.Collections.Generic.HashSet[int]]::new()

# 1. From PID file if present
if (Test-Path $PidFile) {
    try {
        $rawPid = (Get-Content $PidFile -Raw -ErrorAction SilentlyContinue).Trim()
        $parsedPid = 0
        if ([int]::TryParse($rawPid, [ref]$parsedPid) -and $parsedPid -gt 0) {
            $proc = Get-Process -Id $parsedPid -ErrorAction SilentlyContinue
            if ($proc) {
                [void]$pidsToStop.Add($parsedPid)
            }
        }
    } catch {}
}

# 2. From TCP listener on $TargetPort
try {
    $connections = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $owningPid = $conn.OwningProcess
            if ($owningPid -and $owningPid -gt 0) {
                [void]$pidsToStop.Add($owningPid)
            }
        }
    }
} catch {}

if ($pidsToStop.Count -eq 0) {
    Write-Host "[stop.ps1] Hermes WebUI is not running (port $TargetPort is free)." -ForegroundColor Green
    if (Test-Path $PidFile) {
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }
    exit 0
}

# === Terminate identified processes ====================================
$stoppedAny = $false

foreach ($procId in $pidsToStop) {
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if (-not $proc) { continue }

    Write-Host "[stop.ps1] Stopping Hermes WebUI (PID $procId, port $TargetPort)..." -ForegroundColor Cyan

    if ($Force) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        $stoppedAny = $true
        continue
    }

    # Graceful stop: request process termination
    Stop-Process -Id $procId -ErrorAction SilentlyContinue

    # Poll up to 5 seconds (50 x 100ms) for clean exit
    $exited = $false
    for ($i = 0; $i -lt 50; $i++) {
        Start-Sleep -Milliseconds 100
        $check = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if (-not $check -or $check.HasExited) {
            $exited = $true
            break
        }
    }

    if (-not $exited) {
        Write-Host "[stop.ps1] Process $procId did not exit cleanly; forcing termination..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 200
    }

    $stoppedAny = $true
}

# === Clean up PID file =================================================
if (Test-Path $PidFile) {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

# === Verify port release ===============================================
$stillListening = $false
try {
    $remaining = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
    if ($remaining) { $stillListening = $true }
} catch {}

if ($stillListening) {
    Write-Host "[stop.ps1] Warning: port $TargetPort still has an active listener." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "[stop.ps1] Hermes WebUI stopped successfully (port $TargetPort freed)." -ForegroundColor Green
}
