; Grain Link - NSIS Installer Hooks for Tauri v2
; タスクスケジューラへの登録・削除を行う

!macro NSIS_HOOK_POSTINSTALL
  ; --- Windows起動時に自動で起動（ログオン後10秒遅延） ---
  ExecWait 'schtasks /create /tn "Grain Link Auto Start" /tr "\"$INSTDIR\grain-link.exe\"" /sc onlogon /delay 0000:10 /f'

  ; --- 毎日AM3:00にシステム再起動 ---
  ExecWait 'schtasks /create /tn "Grain Link Daily Reboot" /tr "shutdown /r /t 0" /sc daily /st 03:00 /f'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; --- アンインストール時にタスクを削除 ---
  ExecWait 'schtasks /delete /tn "Grain Link Auto Start" /f'
  ExecWait 'schtasks /delete /tn "Grain Link Daily Reboot" /f'
!macroend
