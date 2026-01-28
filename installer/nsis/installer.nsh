; Custom NSIS script for RollCloud Wizard installer
; Adds option to install updater during main installation

!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "FileFunc.nsh"

; Variables
Var Dialog
Var InstallUpdaterCheckbox
Var InstallUpdater
Var UpdaterDirLabel
Var UpdaterDirText
Var UpdaterDirBrowse
Var UpdaterInstallDir

; Initialize installer - check for previous installations and running instances
!macro customInit
  ; Check if wizard is already running
  System::Call 'kernel32::CreateMutex(i 0, i 0, t "RollCloudWizardMutex") i .r1 ?e'
  Pop $R0
  ${If} $R0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "RollCloud Wizard is already running. Please close the existing instance before continuing."
    Abort
  ${EndIf}

  ; Check for previous RollCloud Wizard installation
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudWizard" "UninstallString"
  ${If} $0 != ""
    DetailPrint "Found existing RollCloud Wizard installation"
    MessageBox MB_YESNO|MB_ICONQUESTION "A previous version of RollCloud Wizard is installed.$\n$\nWould you like to uninstall it before continuing?$\n$\n(This is recommended to avoid conflicts)" IDYES UninstallPrevWizard IDNO SkipUninstallWizard

    UninstallPrevWizard:
      DetailPrint "Uninstalling previous RollCloud Wizard..."
      ExecWait '$0 /S _?=$INSTDIR'
      Delete "$0"
      DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudWizard"
      DetailPrint "Previous RollCloud Wizard uninstalled"

    SkipUninstallWizard:
  ${EndIf}

  ; Check for previous RollCloud Updater installation
  ReadRegStr $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater" "UninstallString"
  ReadRegStr $2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater" "InstallLocation"
  ${If} $1 != ""
    DetailPrint "Found existing RollCloud Updater installation"
    MessageBox MB_YESNO|MB_ICONQUESTION "A previous version of RollCloud Updater is installed.$\n$\nWould you like to uninstall it before continuing?$\n$\n(This is recommended to avoid conflicts)" IDYES UninstallPrevUpdater IDNO SkipUninstallUpdater

    UninstallPrevUpdater:
      DetailPrint "Stopping RollCloud Updater..."
      ; Try to gracefully close the updater first
      nsExec::ExecToLog 'taskkill /IM "RollCloud Updater.exe"'
      Sleep 2000
      ; Force kill if still running
      nsExec::ExecToLog 'taskkill /F /IM "RollCloud Updater.exe"'
      Sleep 1000

      DetailPrint "Removing previous RollCloud Updater files..."
      ; Delete files
      Delete "$2\RollCloud-Updater.exe"
      Delete "$2\updater-settings.json"
      Delete "$2\notification-settings.json"
      Delete "$2\first-run-complete"
      Delete "$2\updater-installed.flag"
      Delete "$SMPROGRAMS\RollCloud\RollCloud Updater.lnk"
      Delete "$SMSTARTUP\RollCloud Updater.lnk"
      RMDir "$2"
      RMDir "$SMPROGRAMS\RollCloud"
      DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater"
      DetailPrint "Previous RollCloud Updater uninstalled"

    SkipUninstallUpdater:
  ${EndIf}
!macroend

; Custom page for updater installation choice
Page custom UpdaterChoicePage UpdaterChoicePageLeave

; Function to create updater choice page
Function UpdaterChoicePage
  nsDialogs::Create 1018
  Pop $Dialog

  ${If} $Dialog == error
    Abort
  ${EndIf}

  ; Title
  ${NSD_CreateLabel} 0 0 100% 20u "RollCloud Updater Installation"
  Pop $0

  ; Description
  ${NSD_CreateLabel} 0 25u 100% 30u "The RollCloud Updater runs in your system tray and notifies you when updates are available."
  Pop $0

  ; Checkbox
  ${NSD_CreateCheckbox} 0 60u 100% 12u "Install RollCloud Updater (recommended)"
  Pop $InstallUpdaterCheckbox
  ${NSD_SetState} $InstallUpdaterCheckbox ${BST_CHECKED}
  ${NSD_OnClick} $InstallUpdaterCheckbox UpdaterCheckboxClick

  ; Directory label
  ${NSD_CreateLabel} 0 80u 100% 12u "Installation directory:"
  Pop $UpdaterDirLabel

  ; Directory text box
  ${NSD_CreateText} 0 95u 85% 12u "$PROGRAMFILES\RollCloud"
  Pop $UpdaterDirText
  StrCpy $UpdaterInstallDir "$PROGRAMFILES\RollCloud"

  ; Browse button
  ${NSD_CreateButton} 86% 95u 14% 12u "Browse..."
  Pop $UpdaterDirBrowse
  ${NSD_OnClick} $UpdaterDirBrowse BrowseUpdateDir

  nsDialogs::Show
FunctionEnd

; Handle checkbox click
Function UpdaterCheckboxClick
  Pop $0
  ${NSD_GetState} $InstallUpdaterCheckbox $1
  ${If} $1 == ${BST_CHECKED}
    EnableWindow $UpdaterDirLabel 1
    EnableWindow $UpdaterDirText 1
    EnableWindow $UpdaterDirBrowse 1
  ${Else}
    EnableWindow $UpdaterDirLabel 0
    EnableWindow $UpdaterDirText 0
    EnableWindow $UpdaterDirBrowse 0
  ${EndIf}
FunctionEnd

; Browse for directory
Function BrowseUpdateDir
  nsDialogs::SelectFolderDialog "Select RollCloud Updater Installation Directory" $UpdaterInstallDir
  Pop $0
  ${If} $0 != error
    StrCpy $UpdaterInstallDir $0
    ${NSD_SetText} $UpdaterDirText $UpdaterInstallDir
  ${EndIf}
FunctionEnd

; When leaving the page
Function UpdaterChoicePageLeave
  ${NSD_GetState} $InstallUpdaterCheckbox $InstallUpdater
  ${NSD_GetText} $UpdaterDirText $UpdaterInstallDir
FunctionEnd

; Custom install macro - install updater if requested
!macro customInstall
  ${If} $InstallUpdater == ${BST_CHECKED}
    DetailPrint "Installing RollCloud Updater to $UpdaterInstallDir..."

    ; Stop any running updater instances
    nsExec::ExecToLog 'taskkill /F /IM "RollCloud Updater.exe"'
    Sleep 500

    ; Create updater directory
    CreateDirectory "$UpdaterInstallDir"

    ; Copy updater executable from app resources
    CopyFiles /SILENT "$INSTDIR\resources\RollCloud-Updater.exe" "$UpdaterInstallDir\RollCloud-Updater.exe"

    ; Create flag file to indicate updater was installed
    FileOpen $0 "$UpdaterInstallDir\updater-installed.flag" w
    FileWrite $0 "installed"
    FileClose $0

    ; Create Start Menu shortcut
    CreateDirectory "$SMPROGRAMS\RollCloud"
    CreateShortcut "$SMPROGRAMS\RollCloud\RollCloud Updater.lnk" "$UpdaterInstallDir\RollCloud-Updater.exe" "" "$UpdaterInstallDir\RollCloud-Updater.exe" 0

    ; Register in Windows Add/Remove Programs
    ; Note: Updater is uninstalled via main RollCloud Wizard uninstaller
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater" "DisplayName" "RollCloud Updater"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater" "DisplayIcon" "$UpdaterInstallDir\RollCloud-Updater.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater" "Publisher" "Carmabella"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater" "DisplayVersion" "1.0.0"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater" "InstallLocation" "$UpdaterInstallDir"
    ; Uninstall via main wizard uninstaller (no separate updater uninstaller)
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater" "UninstallString" '"$INSTDIR\Uninstall RollCloud Wizard.exe"'
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater" "NoRepair" 1

    DetailPrint "RollCloud Updater installed successfully"
  ${EndIf}
!macroend


; Uninstaller section for updater
!macro customUnInstall
  ; Try to find updater installation from registry first
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater" "InstallLocation"
  ${If} $0 == ""
    ; Fallback to INI file
    ReadINIStr $0 "$INSTDIR\updater-path.ini" "Updater" "Path"
  ${EndIf}

  ${If} $0 != ""
    DetailPrint "Uninstalling RollCloud Updater from $0..."

    ; Stop any running updater processes
    nsExec::ExecToLog 'taskkill /F /IM "RollCloud Updater.exe"'
    Sleep 1000

    ; Delete updater files
    Delete "$0\RollCloud-Updater.exe"
    Delete "$0\updater-settings.json"
    Delete "$0\notification-settings.json"
    Delete "$0\first-run-complete"
    Delete "$0\updater-installed.flag"
    Delete "$SMPROGRAMS\RollCloud\RollCloud Updater.lnk"
    Delete "$SMSTARTUP\RollCloud Updater.lnk"
    RMDir "$SMPROGRAMS\RollCloud"
    RMDir "$0"

    ; Remove from Windows Add/Remove Programs
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RollCloudUpdater"

    DetailPrint "RollCloud Updater uninstalled"
  ${EndIf}
!macroend

; Custom run app macro - called when user checks "Run" on finish page
!macro customRunApp
  ; Check if updater was installed and pass appropriate args
  ${If} $InstallUpdater == ${BST_CHECKED}
    Exec '"$INSTDIR\${APP_FILENAME}.exe" --updater-installed --updater-dir=$\"$UpdaterInstallDir$\"'
  ${Else}
    Exec '"$INSTDIR\${APP_FILENAME}.exe"'
  ${EndIf}
!macroend
