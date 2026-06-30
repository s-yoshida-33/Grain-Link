!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

; Variables
Var PageHandle
Var CheckDesktop
Var CheckStartMenu
Var CheckAutoStart
Var WantDesktop
Var WantStartMenu
Var WantAutoStart
Var DesktopShortcutExists
Var StartMenuShortcutExists

; -----------------------------------------
; Initialize and override texts
; -----------------------------------------
!macro preInit
  ; Override MUI finish page texts
  !define MUI_FINISHPAGE_TITLE "インストール完了"
  !define MUI_FINISHPAGE_TEXT "インストールが正常に完了しました。"
  !define MUI_FINISHPAGE_NOAUTOCLOSE
!macroend

; -----------------------------------------
; Custom page inserted AFTER the directory selection page
; -----------------------------------------
!macro customPageAfterChangeDir
  Page custom ShortcutSelectPageCreate ShortcutSelectPageLeave
!macroend

; -----------------------------------------
; Custom Shortcut Selection Page
; -----------------------------------------
Function ShortcutSelectPageCreate
  !insertmacro MUI_HEADER_TEXT "ショートカットの作成" "作成するショートカットを選択してください。"

  nsDialogs::Create 1018
  Pop $PageHandle

  ${If} $PageHandle == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 20u "ショートカットを作成する場所を選択してください:"
  Pop $0

  ${NSD_CreateCheckbox} 0 30u 100% 12u "デスクトップショートカットを作成する"
  Pop $CheckDesktop
  ${NSD_Check} $CheckDesktop

  ${NSD_CreateCheckbox} 0 50u 100% 12u "スタートメニューのショートカットを作成する"
  Pop $CheckStartMenu
  ${NSD_Check} $CheckStartMenu

  ${NSD_CreateCheckbox} 0 70u 100% 12u "Windows起動時に自動で起動する"
  Pop $CheckAutoStart
  ${NSD_Check} $CheckAutoStart

  nsDialogs::Show
FunctionEnd

Function ShortcutSelectPageLeave
  ${NSD_GetState} $CheckDesktop   $WantDesktop
  ${NSD_GetState} $CheckStartMenu $WantStartMenu
  ${NSD_GetState} $CheckAutoStart  $WantAutoStart
FunctionEnd

; -----------------------------------------
; Custom actions during installation
; -----------------------------------------
!macro customInstall

  ; Desktop shortcut handling
  ; Check for old shortcut name
  ${If} ${FileExists} "$DESKTOP\GrainLink.lnk"
    StrCpy $DesktopShortcutExists "1"
    Delete "$DESKTOP\GrainLink.lnk"
    Sleep 100
  ; Check for new shortcut name
  ${ElseIf} ${FileExists} "$DESKTOP\Grain Link.lnk"
    StrCpy $DesktopShortcutExists "1"
    Delete "$DESKTOP\Grain Link.lnk"
    Sleep 100
  ${Else}
    StrCpy $DesktopShortcutExists "0"
  ${EndIf}
  
  ${If} $DesktopShortcutExists == "1"
    CreateShortCut "$DESKTOP\Grain Link.lnk" "$INSTDIR\Grain Link.exe" "" "$INSTDIR\Grain Link.exe" 0
  ${ElseIf} $WantDesktop == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\Grain Link.lnk" "$INSTDIR\Grain Link.exe" "" "$INSTDIR\Grain Link.exe" 0
  ${EndIf}

  ; Start Menu shortcut handling
  ; Check for old shortcut name
  ${If} ${FileExists} "$SMPROGRAMS\GrainLink\GrainLink.lnk"
    StrCpy $StartMenuShortcutExists "1"
    Delete "$SMPROGRAMS\GrainLink\GrainLink.lnk"
    Sleep 100
  ; Check for new shortcut name
  ${ElseIf} ${FileExists} "$SMPROGRAMS\GrainLink\Grain Link.lnk"
    StrCpy $StartMenuShortcutExists "1"
    Delete "$SMPROGRAMS\GrainLink\Grain Link.lnk"
    Sleep 100
  ${Else}
    StrCpy $StartMenuShortcutExists "0"
  ${EndIf}
  
  ${If} $StartMenuShortcutExists == "1"
    CreateDirectory "$SMPROGRAMS\GrainLink"
    CreateShortCut "$SMPROGRAMS\GrainLink\Grain Link.lnk" "$INSTDIR\Grain Link.exe" "" "$INSTDIR\Grain Link.exe" 0
  ${ElseIf} $WantStartMenu == ${BST_CHECKED}
    CreateDirectory "$SMPROGRAMS\GrainLink"
    CreateShortCut "$SMPROGRAMS\GrainLink\Grain Link.lnk" "$INSTDIR\Grain Link.exe" "" "$INSTDIR\Grain Link.exe" 0
  ${EndIf}

  ; --- Migration: 旧バージョンのレジストリ自動起動を削除 ---
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "GrainLink"

  ; --- Windows auto-start via Task Scheduler ---
  ${IfNot} ${Silent}
    ${If} $WantAutoStart == ${BST_CHECKED}
      ExecWait 'schtasks /create /tn "Grain Link Auto Start" /tr "$\"$INSTDIR\Grain Link.exe$\"" /sc onlogon /delay 0000:10 /f'
    ${Else}
      ExecWait 'schtasks /delete /tn "Grain Link Auto Start" /f'
    ${EndIf}
  ${Else}
    ; Silent install (e.g. auto-update)
    ; 既存タスクがあればパスを更新、なければユーザーの初回選択を尊重しそのまま
    ExecWait 'schtasks /query /tn "Grain Link Auto Start" /fo list' $0
    ${If} $0 == 0
      ; タスクが存在する → パスを最新に更新
      ExecWait 'schtasks /create /tn "Grain Link Auto Start" /tr "$\"$INSTDIR\Grain Link.exe$\"" /sc onlogon /delay 0000:10 /f'
    ${EndIf}
  ${EndIf}

  ; --- Scheduled task for daily reboot at 03:00 ---
  ExecWait 'schtasks /create /tn "Grain Link Daily Reboot" /tr "shutdown /r /t 0" /sc daily /st 03:00 /f'

  ; システムにアイコン等の変更を通知
  System::Call 'shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'

!macroend

; -----------------------------------------
; Auto-advance from InstFiles page to Finish page
; This function is called when leaving the InstFiles page
; -----------------------------------------
Function InstFilesLeave
  ; Automatically click "Next" button to advance to finish page
  Sleep 500
  FindWindow $0 "#32770" "" $HWNDPARENT
  ${If} $0 != 0
    ; Find the Next button (IDOK = 1)
    GetDlgItem $1 $0 1
    ${If} $1 != 0
      ; Simulate button click
      SendMessage $1 ${BM_CLICK} 0 0
    ${EndIf}
  ${EndIf}
FunctionEnd

; -----------------------------------------
; Override finish page text when it's shown
; This function is called when the finish page is displayed
; -----------------------------------------
Function .onInstSuccess
  ; Override MUI finish page header text
  !insertmacro MUI_HEADER_TEXT "インストール完了" "インストールが正常に完了しました。"
FunctionEnd

; -----------------------------------------
; Custom uninstall actions
; -----------------------------------------
!macro customUnInstall
  ; Migration: 旧バージョンのレジストリ自動起動も念のため削除
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "GrainLink"

  ; Delete scheduled tasks
  ExecWait 'schtasks /delete /tn "Grain Link Auto Start" /f'
  ExecWait 'schtasks /delete /tn "Grain Link Daily Reboot" /f'
!macroend
