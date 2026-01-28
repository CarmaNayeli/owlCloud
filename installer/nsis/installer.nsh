; Custom NSIS script for RollCloud Wizard installer
; Adds option to install updater during main installation

!include "LogicLib.nsh"

; Use the finish page's showReadme checkbox for updater installation
!macro customFinishPage
  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Install RollCloud Updater (recommended)"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION installUpdater
  !define MUI_FINISHPAGE_SHOWREADME_CHECKED
!macroend

; Function to install the updater
Function installUpdater
  DetailPrint "Installing RollCloud Updater..."

  ; Create updater directory
  CreateDirectory "$PROGRAMFILES\RollCloud"

  ; Copy updater executable from app resources
  ; The updater is bundled in the installed app's resources folder
  CopyFiles "$INSTDIR\resources\RollCloud-Updater.exe" "$PROGRAMFILES\RollCloud\RollCloud-Updater.exe"

  ; Create updater settings file
  FileOpen $0 "$PROGRAMFILES\RollCloud\updater-settings.json" w
  FileWrite $0 '{$\r$\n'
  FileWrite $0 '  "minimizeToTray": true,$\r$\n'
  FileWrite $0 '  "startMinimized": true,$\r$\n'
  FileWrite $0 '  "enabled": true,$\r$\n'
  FileWrite $0 '  "checkInterval": 3600000$\r$\n'
  FileWrite $0 '}$\r$\n'
  FileClose $0

  ; Create Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\RollCloud"
  CreateShortcut "$SMPROGRAMS\RollCloud\RollCloud Updater.lnk" "$PROGRAMFILES\RollCloud\RollCloud-Updater.exe"

  ; Create startup shortcut
  CreateShortcut "$SMSTARTUP\RollCloud Updater.lnk" "$PROGRAMFILES\RollCloud\RollCloud-Updater.exe" "--minimized"

  DetailPrint "RollCloud Updater installed successfully"
FunctionEnd

; Uninstaller section for updater
!macro customUnInstall
  Delete "$PROGRAMFILES\RollCloud\RollCloud-Updater.exe"
  Delete "$PROGRAMFILES\RollCloud\updater-settings.json"
  Delete "$SMPROGRAMS\RollCloud\RollCloud Updater.lnk"
  Delete "$SMSTARTUP\RollCloud Updater.lnk"
  RMDir "$SMPROGRAMS\RollCloud"
  RMDir "$PROGRAMFILES\RollCloud"
!macroend

