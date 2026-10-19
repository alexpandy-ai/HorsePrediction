# After the agent stops, commit relevant project changes, push the current
# branch, and dispatch the Harvis publish workflow. The flag file is written
# only after that sequence succeeds, and it is gitignored so it cannot be
# committed and start another pass.
param(
    [switch]$DryRun,
    [switch]$SelfTest
)

$ErrorActionPreference = 'Continue'
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'Never'
$env:GH_PROMPT_DISABLED = '1'

$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:FlagPath = Join-Path $script:RepoRoot '.cursor\publish-state.json'
$script:LockPath = Join-Path $script:RepoRoot '.cursor\publish-hook.lock'
$script:WorkflowFile = 'publish-racecards.yml'
$script:LockHeld = $false
$script:AllowDispatch = $false

function Write-SafeLog {
    param([string]$Message)
    if ([string]::IsNullOrWhiteSpace($Message)) { return }
    $clean = $Message -replace '(?i)(token|secret|password|authorization|api[_-]?key)[=:]\s*\S+', '$1=[redacted]'
    $line = ($clean -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    if ($line.Length -gt 300) { $line = $line.Substring(0, 300) }
    [Console]::Error.WriteLine("publish-hook: $line")
}

function Format-Arguments {
    param([string[]]$Parts)
    $quoted = foreach ($part in $Parts) {
        if ($null -eq $part) { continue }
        if ($part -match '[\s"]') { '"' + ($part -replace '"', '\"') + '"' } else { $part }
    }
    return ($quoted -join ' ')
}

function Invoke-Captured {
    param(
        [Parameter(Mandatory = $true)][string]$FileName,
        [string[]]$ArgumentList
    )
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FileName
    $psi.Arguments = (Format-Arguments $ArgumentList)
    $psi.WorkingDirectory = $script:RepoRoot
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    [void]$process.Start()
    $process.StandardInput.Close()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    [void]$process.WaitForExit()
    return @{
        Code   = $process.ExitCode
        Stdout = $stdoutTask.Result
        Stderr = $stderrTask.Result
    }
}

function Resolve-Tool {
    param([string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $cmd) { return $null }
    return $cmd.Source
}

function Test-DeniedPath {
    param([string]$RelativePath)
    if ([string]::IsNullOrWhiteSpace($RelativePath)) { return $true }
    $normalized = ($RelativePath.Replace('\', '/').Trim() -replace '^\./', '').Trim('"')
    $lower = $normalized.ToLowerInvariant()
    $leaf = [System.IO.Path]::GetFileName($lower)

    if ($leaf -eq '.env' -or $leaf.StartsWith('.env.') -or $leaf.EndsWith('.env')) { return $true }
    if ($leaf -like '*credential*') { return $true }
    if ($lower -eq '.cursor/publish-state.json' -or $lower -eq '.cursor/publish-hook.lock') { return $true }
    if ($lower -eq 'backend/.env' -or $lower.StartsWith('backend/.env.') -or $lower.StartsWith('backend/.env/')) { return $true }
    if ($lower -eq 'backend/target' -or $lower.StartsWith('backend/target/')) { return $true }
    if ($lower -eq 'server/data' -or $lower.StartsWith('server/data/')) { return $true }

    foreach ($segment in $lower.Split('/')) {
        if ($segment -in @('node_modules', 'dist', 'cache', '.cache', 'credentials')) { return $true }
    }
    return $false
}

function New-CommitMessage {
    param([string[]]$Files)
    $norm = @($Files | ForEach-Object { $_.Replace('\', '/') })
    $hookOnly = $true
    foreach ($file in $norm) {
        if ($file -notlike '.cursor/*' -and $file -ne '.gitignore') {
            $hookOnly = $false
            break
        }
    }
    if ($hookOnly) {
        return 'Add a stop hook so finished agent changes are committed, pushed, and published.'
    }

    $bits = New-Object System.Collections.Generic.List[string]
    foreach ($file in $norm) {
        $name = $file.ToLowerInvariant()
        $bit = 'the project'
        if ($name -like 'src/stride/formfav/*' -or $name -like '*formfav*') { $bit = 'international meetings' }
        elseif ($name -like '*handicap*' -or $name -like 'src/engine/*' -or $name -like 'backend/*') { $bit = 'race scoring' }
        elseif ($name -like 'src/meetings/*' -or $name -like 'src/components/*' -or $name -like 'src/stride/*') { $bit = 'the meetings board' }
        elseif ($name -like '.github/workflows/*') { $bit = 'publishing' }
        elseif ($name -like 'src/*') { $bit = 'the racecard site' }
        if (-not $bits.Contains($bit)) { $bits.Add($bit) }
    }

    if ($bits.Count -eq 1) {
        switch ($bits[0]) {
            'international meetings' { return 'Update international meetings so country cards stay current on the published site.' }
            'race scoring' { return 'Update race scoring so the published site uses the latest handicap rules.' }
            'the meetings board' { return 'Update the meetings board so the published site shows the latest cards.' }
            'publishing' { return 'Update publishing so the static racecard site picks up the latest snapshot.' }
            'the racecard site' { return 'Update the racecard site so the latest changes are what visitors see.' }
            default { return 'Update the project so the published site matches the latest changes.' }
        }
    }

    $rest = ($bits | Select-Object -Skip 1) -join ' and '
    return "Update $($bits[0]) and $rest so the published site matches the latest changes."
}

function Get-WorktreeChanges {
    param([string]$GitExe)
    $result = Invoke-Captured -FileName $GitExe -ArgumentList @('-c', 'core.quotepath=false', 'status', '--porcelain=v1', '-uall')
    if ($result.Code -ne 0) {
        throw "git status failed"
    }
    $changes = New-Object System.Collections.Generic.List[object]
    foreach ($line in ($result.Stdout -split "`r?`n")) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.Length -lt 4) { continue }
        $status = $line.Substring(0, 2)
        $path = $line.Substring(3)
        if ($path -like '* -> *') {
            $pieces = $path -split ' -> ', 2
            $changes.Add([pscustomobject]@{ Status = 'D '; Path = $pieces[0] })
            $changes.Add([pscustomobject]@{ Status = 'A '; Path = $pieces[1] })
        }
        else {
            $changes.Add([pscustomobject]@{ Status = $status; Path = $path })
        }
    }
    return ,$changes.ToArray()
}

function Test-DirectoryPath {
    param([string]$RelativePath)
    $full = Join-Path $script:RepoRoot ($RelativePath.Replace('/', '\'))
    return (Test-Path -LiteralPath $full -PathType Container)
}

function Read-PublishFlag {
    if (-not (Test-Path -LiteralPath $script:FlagPath)) { return $null }
    try {
        return (Get-Content -LiteralPath $script:FlagPath -Raw | ConvertFrom-Json)
    }
    catch {
        return $null
    }
}

function Write-PublishFlag {
    param(
        [string]$CommitSha,
        [string]$RunId,
        [string]$Status
    )
    $payload = [ordered]@{
        lastSuccessfulCommitSha = $CommitSha
        timestamp               = (Get-Date).ToUniversalTime().ToString('o')
        deployRunId             = $RunId
        deployStatus            = $Status
    }
    $json = ($payload | ConvertTo-Json -Compress) + "`n"
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($script:FlagPath, $json, $utf8)
}

function Test-LockActive {
    param($Lock)
    if (-not $Lock -or -not $Lock.pid -or -not $Lock.timestamp) { return $false }
    try {
        $started = [datetimeoffset]::Parse([string]$Lock.timestamp)
    }
    catch {
        return $false
    }
    $age = [datetimeoffset]::UtcNow - $started
    if ($age.TotalMinutes -ge 8) { return $false }
    if ([int]$Lock.pid -eq $PID) { return $false }
    $proc = Get-Process -Id ([int]$Lock.pid) -ErrorAction SilentlyContinue
    return ($null -ne $proc)
}

function Enter-PublishLock {
    if (Test-Path -LiteralPath $script:LockPath) {
        try {
            $existing = Get-Content -LiteralPath $script:LockPath -Raw | ConvertFrom-Json
            if (Test-LockActive $existing) { return $false }
        }
        catch {
            # Unreadable lock is stale; replace it.
        }
    }
    $payload = [ordered]@{
        pid       = $PID
        timestamp = (Get-Date).ToUniversalTime().ToString('o')
    }
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($script:LockPath, (($payload | ConvertTo-Json -Compress) + "`n"), $utf8)
    $script:LockHeld = $true
    return $true
}

function Exit-PublishLock {
    if (-not $script:LockHeld) { return }
    Remove-Item -LiteralPath $script:LockPath -Force -ErrorAction SilentlyContinue
    $script:LockHeld = $false
}

function Wait-GitIndex {
    $indexLock = Join-Path $script:RepoRoot '.git\index.lock'
    $deadline = (Get-Date).AddSeconds(15)
    while (Test-Path -LiteralPath $indexLock) {
        if ((Get-Date) -gt $deadline) { return $false }
        Start-Sleep -Seconds 1
    }
    return $true
}

function Get-GitOutput {
    param(
        [string]$GitExe,
        [string[]]$ArgumentList
    )
    $result = Invoke-Captured -FileName $GitExe -ArgumentList $ArgumentList
    if ($result.Code -ne 0) { return $null }
    return ($result.Stdout.Trim())
}

function Get-PublishRuns {
    param([string]$GhExe)
    $result = Invoke-Captured -FileName $GhExe -ArgumentList @(
        'run', 'list',
        '--workflow', $script:WorkflowFile,
        '--limit', '20',
        '--json', 'databaseId,status,conclusion,headSha,headBranch,url'
    )
    if ($result.Code -ne 0) {
        throw "could not list publish runs"
    }
    $text = [string]$result.Stdout
    if ([string]::IsNullOrWhiteSpace($text)) { return }
    $parsed = $text | ConvertFrom-Json
    foreach ($item in @($parsed)) {
        Write-Output $item
    }
}

function Expand-Runs {
    param($Runs)
    foreach ($run in @($Runs)) {
        if ($null -eq $run) { continue }
        if ($run.databaseId -is [System.Array]) {
            $ids = @($run.databaseId)
            $statuses = @($run.status)
            $conclusions = @($run.conclusion)
            $shas = @($run.headSha)
            $branches = @($run.headBranch)
            for ($i = 0; $i -lt $ids.Count; $i++) {
                Write-Output ([pscustomobject]@{
                    databaseId = $ids[$i]
                    status     = $statuses[$i]
                    conclusion = $conclusions[$i]
                    headSha    = $shas[$i]
                    headBranch = $branches[$i]
                })
            }
        }
        else {
            Write-Output $run
        }
    }
}

function Get-DeployDecision {
    param(
        [string]$Head,
        [array]$Runs
    )
    $list = @(Expand-Runs $Runs)
    $activeOther = @($list | Where-Object { $_.headSha -ne $Head -and $_.status -ne 'completed' })
    if ($activeOther.Count -gt 0) {
        return @{
            Action = 'defer'
            RunId  = [string]$activeOther[0].databaseId
            Status = [string]$activeOther[0].status
            Reason = 'another publish run is already in progress'
        }
    }
    $forHead = @($list | Where-Object { $_.headSha -eq $Head })
    $active = @($forHead | Where-Object { $_.status -ne 'completed' })
    if ($active.Count -gt 0) {
        return @{
            Action = 'confirm'
            RunId  = [string]$active[0].databaseId
            Status = [string]$active[0].status
            Reason = 'this commit already has a publish run in progress'
        }
    }
    $succeeded = @($forHead | Where-Object { $_.conclusion -eq 'success' })
    if ($succeeded.Count -gt 0) {
        return @{
            Action = 'confirm'
            RunId  = [string]$succeeded[0].databaseId
            Status = 'completed'
            Reason = 'this commit was already published'
        }
    }
    return @{
        Action = 'trigger'
        RunId  = ''
        Status = ''
        Reason = 'this commit has no successful or active publish run'
    }
}

function Invoke-WorkflowDispatch {
    param(
        [string]$GhExe,
        [string]$Branch
    )
    if (-not $script:AllowDispatch) { throw 'workflow dispatch is blocked' }
    $result = Invoke-Captured -FileName $GhExe -ArgumentList @(
        'workflow', 'run', $script:WorkflowFile,
        '--ref', $Branch
    )
    if ($result.Code -ne 0) {
        Write-SafeLog $result.Stderr
        throw "workflow dispatch failed"
    }
    $combined = "$($result.Stdout)`n$($result.Stderr)"
    $runId = ''
    if ($combined -match '/runs/(\d+)') { $runId = $Matches[1] }
    if ($runId) {
        return @{ RunId = $runId; Status = 'triggered' }
    }

    $deadline = (Get-Date).AddSeconds(20)
    do {
        Start-Sleep -Seconds 2
        $runs = @(Expand-Runs (Get-PublishRuns -GhExe $GhExe))
        $match = @($runs | Where-Object { $_.headBranch -eq $Branch -and $_.status -ne 'completed' } | Select-Object -First 1)
        if ($match.Count -gt 0) {
            return @{ RunId = [string]$match[0].databaseId; Status = 'triggered' }
        }
    } while ((Get-Date) -lt $deadline)

    return @{ RunId = ''; Status = 'triggered' }
}

function Read-HookPayload {
    $info = @{ Status = ''; LoopCount = 0 }
    if (-not [Console]::IsInputRedirected) { return $info }
    try {
        $raw = [Console]::In.ReadToEnd()
        if ([string]::IsNullOrWhiteSpace($raw)) { return $info }
        $payload = $raw | ConvertFrom-Json
        if ($payload.status) { $info.Status = [string]$payload.status }
        if ($null -ne $payload.loop_count) { $info.LoopCount = [int]$payload.loop_count }
    }
    catch {
        Write-SafeLog 'ignored unreadable hook input'
    }
    return $info
}

function Invoke-PublishPipeline {
    param([switch]$DryRun)

    $payload = Read-HookPayload
    if ($payload.LoopCount -ge 1) {
        Write-SafeLog "skip automatic follow-up $($payload.LoopCount)"
        return
    }

    $git = Resolve-Tool 'git'
    $gh = Resolve-Tool 'gh'
    if (-not $git -or -not $gh) {
        Write-SafeLog 'git or gh is not available'
        return
    }

    if (-not (Enter-PublishLock)) {
        Write-SafeLog 'already running'
        return
    }

    try {
        if (-not (Wait-GitIndex)) {
            Write-SafeLog 'git index is locked; leaving the other git process alone'
            return
        }

        $branch = Get-GitOutput -GitExe $git -ArgumentList @('rev-parse', '--abbrev-ref', 'HEAD')
        $head = Get-GitOutput -GitExe $git -ArgumentList @('rev-parse', 'HEAD')
        if ([string]::IsNullOrWhiteSpace($branch) -or $branch -eq 'HEAD' -or [string]::IsNullOrWhiteSpace($head)) {
            Write-SafeLog 'detached HEAD; nothing was published'
            return
        }

        $changes = Get-WorktreeChanges -GitExe $git
        if ($null -eq $changes) { $changes = @() }
        $stage = @()
        foreach ($change in $changes) {
            if (Test-DeniedPath $change.Path) {
                Write-SafeLog "excluded $($change.Path)"
                continue
            }
            $untracked = $change.Status.Trim() -eq '??'
            if ($untracked -and (Test-DirectoryPath $change.Path)) {
                Write-SafeLog "skipped directory $($change.Path)"
                continue
            }
            $stage += $change.Path
        }

        $flag = Read-PublishFlag
        $flagSha = if ($flag) { [string]$flag.lastSuccessfulCommitSha } else { '' }
        $cleanOfWork = ($stage.Count -eq 0)

        if ($cleanOfWork -and $flagSha -eq $head) {
            Write-SafeLog "already published $head"
            return
        }

        if ($stage.Count -gt 0) {
            if ($DryRun) {
                Write-SafeLog ("would commit " + ($stage -join ', '))
            }
            else {
                foreach ($path in $stage) {
                    $added = Invoke-Captured -FileName $git -ArgumentList @('add', '--', $path)
                    if ($added.Code -ne 0) { throw "git add failed for $path" }
                }
                $cached = Invoke-Captured -FileName $git -ArgumentList @('-c', 'core.quotepath=false', 'diff', '--cached', '--name-only')
                if ($cached.Code -ne 0) { throw 'git diff --cached failed' }
                $staged = @($cached.Stdout -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
                foreach ($path in @($staged)) {
                    if (Test-DeniedPath $path) {
                        $restored = Invoke-Captured -FileName $git -ArgumentList @('restore', '--staged', '--', $path)
                        if ($restored.Code -ne 0) { throw "could not unstage excluded path $path" }
                        Write-SafeLog "unstaged $path"
                    }
                }
                $cached = Invoke-Captured -FileName $git -ArgumentList @('-c', 'core.quotepath=false', 'diff', '--cached', '--name-only')
                $staged = @($cached.Stdout -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
                if ($staged.Count -eq 0) {
                    Write-SafeLog 'nothing safe to commit'
                }
                else {
                    $message = New-CommitMessage -Files $staged
                    $committed = Invoke-Captured -FileName $git -ArgumentList @('commit', '-m', $message)
                    if ($committed.Code -ne 0) {
                        Write-SafeLog $committed.Stderr
                        throw 'git commit failed'
                    }
                    Write-SafeLog "committed: $message"
                }
            }
        }
        else {
            Write-SafeLog 'nothing to commit'
        }

        if (-not $DryRun) {
            $head = Get-GitOutput -GitExe $git -ArgumentList @('rev-parse', 'HEAD')
        }
        if ([string]::IsNullOrWhiteSpace($head)) { throw 'could not read HEAD' }

        $remote = Get-GitOutput -GitExe $git -ArgumentList @('rev-parse', '--verify', "refs/remotes/origin/$branch")
        $needsPush = $true
        if ($remote) {
            $ahead = Get-GitOutput -GitExe $git -ArgumentList @('rev-list', '--count', "origin/$branch..HEAD")
            $needsPush = ($ahead -ne '0')
        }
        if ($DryRun -and $stage.Count -gt 0) { $needsPush = $true }

        if ($needsPush) {
            if ($DryRun) {
                Write-SafeLog "would push $branch"
            }
            else {
                $pushed = Invoke-Captured -FileName $git -ArgumentList @('push', 'origin', "HEAD:refs/heads/$branch")
                if ($pushed.Code -ne 0) {
                    Write-SafeLog $pushed.Stderr
                    throw 'git push failed'
                }
                Write-SafeLog "pushed $branch"
            }
        }

        $flag = Read-PublishFlag
        $flagSha = if ($flag) { [string]$flag.lastSuccessfulCommitSha } else { '' }
        if (-not $DryRun -and $flagSha -eq $head -and -not $needsPush) {
            Write-SafeLog "already published $head"
            return
        }

        $runs = @(Expand-Runs (Get-PublishRuns -GhExe $gh))
        $decision = Get-DeployDecision -Head $head -Runs $runs
        if ($DryRun -and $stage.Count -gt 0) {
            $active = @($runs | Where-Object { $_.status -ne 'completed' })
            if ($active.Count -gt 0) {
                $decision = @{
                    Action = 'defer'
                    RunId  = [string]$active[0].databaseId
                    Status = [string]$active[0].status
                    Reason = "would commit and push, then skip deploy because publish run $($active[0].databaseId) is already $($active[0].status)"
                }
            }
            else {
                $decision = @{
                    Action = 'trigger'
                    RunId  = ''
                    Status = ''
                    Reason = 'would dispatch after commit and push'
                }
            }
        }

        if ($decision.Action -eq 'defer' -or $decision.Action -eq 'defer-dry-run') {
            Write-SafeLog $decision.Reason
            return
        }

        $runId = [string]$decision.RunId
        $status = [string]$decision.Status
        if ($decision.Action -eq 'trigger') {
            if ($DryRun) {
                Write-SafeLog "would dispatch $script:WorkflowFile for a new commit"
                return
            }
            $script:AllowDispatch = $true
            $dispatched = Invoke-WorkflowDispatch -GhExe $gh -Branch $branch
            $runId = [string]$dispatched.RunId
            $status = [string]$dispatched.Status
            Write-SafeLog "dispatched $script:WorkflowFile run $runId"
        }
        else {
            Write-SafeLog $decision.Reason
        }

        if ($DryRun) { return }
        Write-PublishFlag -CommitSha $head -RunId $runId -Status $status
        Write-SafeLog "flag updated for $head"
    }
    catch {
        Write-SafeLog $_.Exception.Message
    }
    finally {
        Exit-PublishLock
    }
}

function Invoke-SelfTest {
    $script:failures = New-Object System.Collections.Generic.List[string]
    function Assert-True {
        param([bool]$Condition, [string]$Label)
        if (-not $Condition) { $script:failures.Add($Label) }
    }

    Assert-True (Test-DeniedPath '.env') '.env'
    Assert-True (Test-DeniedPath 'backend/.env') 'backend/.env'
    Assert-True (Test-DeniedPath 'backend/.env.local') 'backend env local'
    Assert-True (Test-DeniedPath 'credentials.json') 'credentials file'
    Assert-True (Test-DeniedPath 'config/credentials') 'credentials path'
    Assert-True (Test-DeniedPath 'node_modules/react/index.js') 'node_modules'
    Assert-True (Test-DeniedPath 'dist/index.html') 'dist'
    Assert-True (Test-DeniedPath 'backend/target/app.jar') 'backend target'
    Assert-True (Test-DeniedPath 'server/data/races.json') 'server data'
    Assert-True (Test-DeniedPath 'cache/page.html') 'cache'
    Assert-True (Test-DeniedPath '.cursor/publish-state.json') 'flag'
    Assert-True (Test-DeniedPath '.cursor/publish-hook.lock') 'lock'
    Assert-True (-not (Test-DeniedPath '.cursor/hooks.json')) 'hooks.json allowed'
    Assert-True (-not (Test-DeniedPath '.cursor/hooks/publish-after-stop.ps1')) 'script allowed'
    Assert-True (-not (Test-DeniedPath 'src/App.tsx')) 'source allowed'
    Assert-True (-not (Test-DeniedPath 'src/distribution.ts')) 'distribution name allowed'

    $hookMessage = New-CommitMessage -Files @('.cursor/hooks.json', '.cursor/hooks/publish-after-stop.ps1', '.gitignore')
    Assert-True ($hookMessage -eq 'Add a stop hook so finished agent changes are committed, pushed, and published.') 'hook commit message'

    $same = Get-DeployDecision -Head 'abc' -Runs @([pscustomobject]@{ databaseId = 1; status = 'in_progress'; conclusion = ''; headSha = 'abc' })
    Assert-True ($same.Action -eq 'confirm') 'same sha in progress confirms'
    $done = Get-DeployDecision -Head 'abc' -Runs @([pscustomobject]@{ databaseId = 2; status = 'completed'; conclusion = 'success'; headSha = 'abc' })
    Assert-True ($done.Action -eq 'confirm') 'successful run confirms'
    $other = Get-DeployDecision -Head 'def' -Runs @([pscustomobject]@{ databaseId = 3; status = 'in_progress'; conclusion = ''; headSha = 'abc' })
    Assert-True ($other.Action -eq 'defer') 'other in-progress run defers'
    $missing = Get-DeployDecision -Head 'def' -Runs @([pscustomobject]@{ databaseId = 4; status = 'completed'; conclusion = 'failure'; headSha = 'def' })
    Assert-True ($missing.Action -eq 'trigger') 'failed run can be retried'
    $empty = Get-DeployDecision -Head 'def' -Runs @()
    Assert-True ($empty.Action -eq 'trigger') 'no runs triggers'

    $alive = @(Get-Process) | Where-Object { $_.Id -ne $PID -and $_.Id -gt 4 } | Select-Object -First 1
    $foreign = [ordered]@{ pid = $alive.Id; timestamp = (Get-Date).ToUniversalTime().ToString('o') }
    Assert-True (Test-LockActive $foreign) 'foreign live lock is active'
    $mine = [ordered]@{ pid = $PID; timestamp = (Get-Date).ToUniversalTime().ToString('o') }
    Assert-True (-not (Test-LockActive $mine)) 'current process lock is not a re-entry block'
    $stale = [ordered]@{ pid = $alive.Id; timestamp = (Get-Date).ToUniversalTime().AddMinutes(-30).ToString('o') }
    Assert-True (-not (Test-LockActive $stale)) 'stale lock is inactive'

    $gh = Resolve-Tool 'gh'
    $git = Resolve-Tool 'git'
    Assert-True (-not [string]::IsNullOrWhiteSpace($gh)) 'gh installed'
    Assert-True (-not [string]::IsNullOrWhiteSpace($git)) 'git installed'
    if ($gh -and $git) {
        $head = Get-GitOutput -GitExe $git -ArgumentList @('rev-parse', 'HEAD')
        $runs = @(Get-PublishRuns -GhExe $gh)
        $runs = @(Expand-Runs $runs)
        $live = Get-DeployDecision -Head $head -Runs $runs
        Write-SafeLog "live HEAD $head decision $($live.Action) run $($live.RunId)"
        Assert-True ([string]$live.RunId -notmatch '\s') 'run id is a single value'
        $activeForHead = @($runs | Where-Object { $_.headSha -eq $head -and $_.status -ne 'completed' })
        $activeAny = @($runs | Where-Object { $_.status -ne 'completed' })
        if ($activeForHead.Count -gt 0) {
            Assert-True ($live.Action -eq 'confirm') 'live in-progress commit is confirmed'
        }
        if ($activeAny.Count -gt 0) {
            Assert-True ($live.Action -ne 'trigger') 'no dispatch while a publish run is active'
        }
    }

    $gitignore = Get-Content -LiteralPath (Join-Path $script:RepoRoot '.gitignore') -Raw
    Assert-True ($gitignore -match [regex]::Escape('.cursor/publish-state.json')) 'flag is gitignored'
    Assert-True ($gitignore -match [regex]::Escape('.cursor/publish-hook.lock')) 'lock is gitignored'

    if ($script:failures.Count -gt 0) {
        Write-SafeLog ("self-test failed: " + ($script:failures -join '; '))
        return 1
    }
    Write-SafeLog 'self-test passed'
    return 0
}

if ($SelfTest) {
    $code = Invoke-SelfTest
    if ($code -eq 0) { [Console]::Out.WriteLine('{}') }
    exit $code
}

Invoke-PublishPipeline -DryRun:$DryRun
[Console]::Out.WriteLine('{}')
exit 0
