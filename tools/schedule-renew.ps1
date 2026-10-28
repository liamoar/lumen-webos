# Registers (or removes, with -Remove) a Windows scheduled task that renews
# the TV's Developer Mode session every 12 hours while this PC is on.
param([switch]$Remove)

$TaskName = 'Lumen - Renew LG Developer Mode'

if ($Remove) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed scheduled task '$TaskName'."
    return
}

$ProjectDir = Split-Path -Parent $PSScriptRoot
$Node = (Get-Command node).Source
$Log = Join-Path $ProjectDir 'renew.log'

$Action = New-ScheduledTaskAction -Execute 'cmd.exe' `
    -Argument "/c `"`"$Node`" tools\renew-devmode.mjs >> `"$Log`" 2>&1`"" `
    -WorkingDirectory $ProjectDir
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) `
    -RepetitionInterval (New-TimeSpan -Hours 12)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
    -Settings $Settings -Description 'Keeps the LG TV Developer Mode session alive for the Lumen launcher.' -Force | Out-Null

Write-Host "Scheduled '$TaskName' every 12 hours. Log: $Log"
