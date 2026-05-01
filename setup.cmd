@echo off
REM cmd.exe shim for users without PowerShell on PATH. Just hands off to
REM bootstrap.ps1 with whatever args were passed. PowerShell is shipped
REM with every Windows 10/11 install; this wrapper exists so a dev who
REM only opened cmd.exe can still type `setup.cmd` and have it work.
powershell -ExecutionPolicy Bypass -File "%~dp0bootstrap.ps1" %*
