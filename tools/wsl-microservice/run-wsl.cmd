@echo off
REM Windows-side wrapper. Forwards all args to run-wsl.sh inside WSL Ubuntu.
REM The bash side wslpath-translates Windows paths to /mnt/c/... so the
REM Linux NeoTerritory binary sees the same files the Windows backend
REM wrote them to.
wsl.exe bash /mnt/c/Users/Drew/Desktop/NeoTerritory/Codebase/Microservice/build-wsl/run-wsl.sh %*
