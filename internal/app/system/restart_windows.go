//go:build windows

package system

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"
)

func spawnDetachedRestart(exe string, args []string) error {
	wd, _ := os.Getwd()
	escapePS := func(s string) string {
		return "'" + strings.ReplaceAll(s, "'", "''") + "'"
	}
	script := fmt.Sprintf("Start-Sleep -Milliseconds 700; Start-Process -FilePath %s", escapePS(exe))
	if wd != "" {
		script += fmt.Sprintf(" -WorkingDirectory %s", escapePS(wd))
	}
	if len(args) > 0 {
		quoted := make([]string, 0, len(args))
		for _, a := range args {
			quoted = append(quoted, escapePS(a))
		}
		script += fmt.Sprintf(" -ArgumentList @(%s)", strings.Join(quoted, ","))
	}
	script += " -WindowStyle Hidden"

	const (
		detachedProcess        = 0x00000008
		createBreakawayFromJob = 0x01000000
	)

	makeCmd := func(flags uint32) *exec.Cmd {
		cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script)
		cmd.Dir = wd
		cmd.Env = os.Environ()
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: flags,
		}
		return cmd
	}

	if err := makeCmd(syscall.CREATE_NEW_PROCESS_GROUP | detachedProcess | createBreakawayFromJob).Start(); err != nil {
		return makeCmd(syscall.CREATE_NEW_PROCESS_GROUP | detachedProcess).Start()
	}
	return nil
}

