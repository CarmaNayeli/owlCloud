; Custom NSIS script for RollCloud Wizard installer
; Adds option to install updater during main installation

!include "LogicLib.nsh"
!include "nsDialogs.nsh"

; Variables
Var Dialog
Var InstallUpdaterCheckbox
Var InstallUpdater
Var UpdaterDirLabel
Var UpdaterDirText
Var UpdaterDirBrowse
Var UpdaterInstallDir

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

    ; Create updater directory
    CreateDirectory "$UpdaterInstallDir"

    ; Copy updater executable from app resources
    CopyFiles "$INSTDIR\resources\RollCloud-Updater.exe" "$UpdaterInstallDir\RollCloud-Updater.exe"

    ; Create flag file to indicate updater was installed
    FileOpen $0 "$UpdaterInstallDir\updater-installed.flag" w
    FileWrite $0 "installed"
    FileClose $0

    ; Create Start Menu shortcut
    CreateDirectory "$SMPROGRAMS\RollCloud"
    CreateShortcut "$SMPROGRAMS\RollCloud\RollCloud Updater.lnk" "$UpdaterInstallDir\RollCloud-Updater.exe"

    DetailPrint "RollCloud Updater installed successfully"
  ${EndIf}
!macroend

; Modify the run command to pass updater flag
!macro customRunApp
  ${If} $InstallUpdater == ${BST_CHECKED}
    Exec '"$INSTDIR\$APPEXE" --updater-installed --updater-dir="$UpdaterInstallDir"'
  ${Else}
    Exec '"$INSTDIR\$APPEXE"'
  ${EndIf}
!macroend

; Uninstaller section for updater
!macro customUnInstall
  ReadINIStr $0 "$INSTDIR\updater-path.ini" "Updater" "Path"
  ${If} $0 != ""
    Delete "$0\RollCloud-Updater.exe"
    Delete "$0\updater-settings.json"
    Delete "$0\updater-installed.flag"
    Delete "$SMPROGRAMS\RollCloud\RollCloud Updater.lnk"
    Delete "$SMSTARTUP\RollCloud Updater.lnk"
    RMDir "$SMPROGRAMS\RollCloud"
    RMDir "$0"
  ${EndIf}
!macroend

