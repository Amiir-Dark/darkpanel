package system

import (
	"os"
	"path/filepath"
	"testing"
)

func isolateRuntimeEnv(t *testing.T, dir string) {
	t.Helper()
	t.Setenv("REBECCA_APP_DIR", dir)
	t.Setenv("REBECCA_INSTALL_MODE", "")
	t.Setenv("REBECCA_BINARY_METADATA_FILE", filepath.Join(dir, ".binary-release.json"))
	t.Setenv("REBECCA_INSTALL_MODE_FILE", filepath.Join(dir, ".install-mode"))
}

func TestRuntimeDetectorDetectsBinaryFromMetadataFile(t *testing.T) {
	dir := t.TempDir()
	isolateRuntimeEnv(t, dir)
	if err := os.WriteFile(filepath.Join(dir, ".binary-release.json"), []byte(`{"tag":"main-abcdef0"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := (DefaultRuntimeDetector{}).Info().Mode; got != "binary" {
		t.Fatalf("mode = %q, want binary", got)
	}
}

func TestRuntimeDetectorDetectsBinaryFromServerBinary(t *testing.T) {
	dir := t.TempDir()
	isolateRuntimeEnv(t, dir)
	if err := os.MkdirAll(filepath.Join(dir, "bin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "bin", "rebecca-server"), []byte("x"), 0o755); err != nil {
		t.Fatal(err)
	}
	if got := (DefaultRuntimeDetector{}).Info().Mode; got != "binary" {
		t.Fatalf("mode = %q, want binary", got)
	}
}

func TestRuntimeDetectorPrefersExplicitInstallMode(t *testing.T) {
	dir := t.TempDir()
	isolateRuntimeEnv(t, dir)
	t.Setenv("REBECCA_INSTALL_MODE", "docker")
	if err := os.WriteFile(filepath.Join(dir, ".binary-release.json"), []byte(`{"tag":"main-abcdef0"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := (DefaultRuntimeDetector{}).Info().Mode; got != "docker" {
		t.Fatalf("mode = %q, want docker", got)
	}
}

func TestRuntimeDetectorFallsBackToDocker(t *testing.T) {
	dir := t.TempDir()
	isolateRuntimeEnv(t, dir)
	if got := (DefaultRuntimeDetector{}).Info().Mode; got != "docker" {
		t.Fatalf("mode = %q, want docker", got)
	}
}
