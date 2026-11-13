//go:build !windows

package system

import (
	"os"
	"os/exec"
	"syscall"
)

func spawnDetachedRestart(exe string, args []string) error {
	wd, _ := os.Getwd()
	cmd := exec.Command("sh", "-c", `sleep 1 && exec "$0" "$@"`, exe)
	cmd.Args = append(cmd.Args, args...)
	cmd.Dir = wd
	cmd.Env = os.Environ()
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	return cmd.Start()
}

