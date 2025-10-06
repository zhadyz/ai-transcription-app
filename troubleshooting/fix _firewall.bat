@echo off
echo Opening firewall ports...

powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \"New-NetFirewallRule -DisplayName \"\"Vite Dev Server\"\" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName \"\"Transcription Backend HTTP\"\" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName \"\"Transcription Backend HTTPS\"\" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8443 -ErrorAction SilentlyContinue; Write-Host \"\"Firewall rules added!\"\" -ForegroundColor Green; pause\"\"'"

echo Done! Restart the app (START.bat)
pause