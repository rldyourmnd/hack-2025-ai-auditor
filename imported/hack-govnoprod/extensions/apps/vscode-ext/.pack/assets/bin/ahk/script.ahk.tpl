#Requires AutoHotkey v2.0
#SingleInstance Force

; Конфиг подставляется из расширения
global SCRIPT_DIR := "{SCRIPT_DIR}"
global LOG_DIR    := "{LOG_DIR}"
global PREPROMPT  := "{PREPROMPT}"
global DLP_BAT    := "{DLP_BAT_PATH}"
global HELPER_PORT_FILE := "{HELPER_PORT_FILE}"

; Ctrl+Shift+C — захват текста из Cursor, прогон через dlp-cli, результат в буфере
^+c:: {
    try {
        ; Проверяем активное окно: должно быть Cursor
        title := WinGetTitle("A")
        if !RegExMatch(title, "i)cursor") {
            return
        }

        ; Select-All + Copy
        Send "^a"
        Sleep 80
        Send "^c"
        ClipWait 0.5
        captured := A_Clipboard
        if (StrLen(captured) = 0) {
            return
        }

        ; Готовим temp-файлы
        inFile  := A_Temp "\\ai_auditor_in.txt"
        outFile := A_Temp "\\ai_auditor_out.txt"
        try FileDelete outFile
        f := FileOpen(inFile, "w", "UTF-8")
        f.Write(captured)
        f.Close()

        cleaned := ""
        if (FileExist(DLP_BAT)) {
            cmd := '"' DLP_BAT '" scan --in ' '"' inFile '"' ' --out ' '"' outFile '"'
            RunWait cmd, , "Hide"
            if FileExist(outFile) {
                cleaned := FileRead(outFile, "UTF-8")
            }
        }
        if (cleaned = "") {
            cleaned := captured
        }
        ; Try to push directly to helper if port file exists; else fallback to clipboard
        pushed := false
        try {
            if (FileExist(HELPER_PORT_FILE)) {
                port := Trim(FileRead(HELPER_PORT_FILE, "UTF-8"))
                if (port != "") {
                    json := '{"text":"' StrReplace(cleaned, '"', '\"') '"}'
                    ps := 'powershell -NoProfile -ExecutionPolicy Bypass -Command ' 
                        . 'Invoke-RestMethod -Uri "http://127.0.0.1:' port '/push" -Method POST -ContentType "application/json" -Body ''' json ''''
                    RunWait ps, , "Hide"
                    pushed := true
                }
            }
        } catch e {
            pushed := false
        }
        if (!pushed) {
            A_Clipboard := cleaned
        }
    } catch e {
        ; no-op
    }
}

