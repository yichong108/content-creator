# 释放 8000 端口，供 VS Code 调试 API 使用。
# uvicorn --reload 会起父进程 + 子进程；只杀子进程时父进程会立刻重启，导致调试绑定失败。

param(
    [int]$Port = 8000,
    [int]$MaxAttempts = 20
)

function Get-ListenerPids([int]$ListenPort) {
    Get-NetTCPConnection -LocalPort $ListenPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
}

function Stop-UvicornProcesses() {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and (
                $_.CommandLine -like '*uvicorn*app.main:app*' -or
                $_.CommandLine -like '*debugpy*uvicorn*app.main:app*'
            )
        } |
        ForEach-Object {
            Write-Host "Stopping uvicorn PID $($_.ProcessId)"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
}

function Stop-ProcessTree([int]$ProcessId) {
    if ($ProcessId -le 0) {
        return
    }

    $visited = New-Object 'System.Collections.Generic.HashSet[int]'
    $queue = New-Object 'System.Collections.Generic.Queue[int]'
    $queue.Enqueue($ProcessId)

    while ($queue.Count -gt 0) {
        $current = $queue.Dequeue()
        if (-not $visited.Add($current)) {
            continue
        }

        Get-CimInstance Win32_Process -Filter "ParentProcessId=$current" -ErrorAction SilentlyContinue |
            ForEach-Object { $queue.Enqueue($_.ProcessId) }

        $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$current" -ErrorAction SilentlyContinue).ParentProcessId
        if ($parent -and $parent -gt 0) {
            $queue.Enqueue($parent)
        }

        Write-Host "Stopping PID $current"
        Stop-Process -Id $current -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Freeing port $Port ..."

for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    Stop-UvicornProcesses

    $pids = @(Get-ListenerPids -ListenPort $Port)
    foreach ($listenerPid in $pids) {
        Stop-ProcessTree -ProcessId $listenerPid
    }

    Start-Sleep -Milliseconds 300

    $remaining = @(Get-ListenerPids -ListenPort $Port)
    if ($remaining.Count -eq 0) {
        Write-Host "Port $Port is free."
        exit 0
    }

    Write-Host "Attempt ${attempt}/${MaxAttempts}: port $Port still used by $($remaining -join ', ')"
}

Write-Host "Failed to free port $Port. Stop pnpm dev manually, then retry F5."
exit 1
