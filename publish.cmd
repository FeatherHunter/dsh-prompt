@echo off
start "DSH npm publish" powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -File "D:\dsh-plugin\dsh-prompt\scripts\publish-window.ps1" -PackageDir "D:\dsh-plugin\dsh-prompt"
