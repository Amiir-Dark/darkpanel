package rowtemplates

import (
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

//go:embed assets/*/shell.html
var embeddedFS embed.FS

// AllTemplateIDs maps all 17 supported Row-Template IDs.
var AllTemplateIDs = map[string]bool{
	"row":          true,
	"arcade":       true,
	"arcadenova":   true,
	"brutal":       true,
	"canvas":       true,
	"editorial":    true,
	"meter":        true,
	"notebook":     true,
	"prism":        true,
	"prismnova":    true,
	"pulse":        true,
	"pulsenova":    true,
	"saffron":      true,
	"signature":    true,
	"sketch":       true,
	"terminal":     true,
	"terminalnova": true,
}

// ExtractTemplateID parses a template string or path and returns the Row-Template ID if matched.
func ExtractTemplateID(pathOrName string) (string, bool) {
	trimmed := strings.ToLower(strings.TrimSpace(pathOrName))
	trimmed = strings.ReplaceAll(trimmed, "\\", "/")
	trimmed = strings.TrimPrefix(trimmed, "/")
	trimmed = strings.TrimSuffix(trimmed, "/shell.html")

	if AllTemplateIDs[trimmed] {
		return trimmed, true
	}

	parts := strings.Split(trimmed, "/")
	for i, part := range parts {
		if part == "row-template" && i+1 < len(parts) {
			candidate := parts[i+1]
			if AllTemplateIDs[candidate] {
				return candidate, true
			}
		}
	}

	return "", false
}

// MatchRowTemplate checks if pathOrName corresponds to a Row-Template,
// and if so returns its rendered raw bytes.
func MatchRowTemplate(pathOrName string) ([]byte, bool) {
	id, ok := ExtractTemplateID(pathOrName)
	if !ok {
		return nil, false
	}
	content, err := ReadTemplate(id)
	if err != nil {
		return nil, false
	}
	return content, true
}

// ReadTemplate returns the raw HTML bytes for the given template name.
// It first attempts to read from disk (allowing admin overrides), and falls
// back to the embedded template compiled directly into the binary.
func ReadTemplate(name string) ([]byte, error) {
	cleanName := strings.ToLower(strings.TrimSpace(name))
	if cleanName == "" {
		return nil, fmt.Errorf("empty template name")
	}

	// 1. Try disk candidates
	diskCandidates := candidatePaths(cleanName)
	for _, candidate := range diskCandidates {
		if content, err := os.ReadFile(candidate); err == nil && len(content) > 0 {
			return content, nil
		}
	}

	// 2. Fall back to embedded files (guaranteed to be present in binary)
	embedPath := "assets/" + cleanName + "/shell.html"
	content, err := embeddedFS.ReadFile(embedPath)
	if err == nil && len(content) > 0 {
		return content, nil
	}

	return nil, fmt.Errorf("قالب مورد نظر یافت نشد: %s", name)
}

func candidatePaths(name string) []string {
	var candidates []string

	filename := filepath.Join(name, "shell.html")

	// CWD-based paths
	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(cwd, "templates", "subscription", "row-template", filename),
			filepath.Join(cwd, "row-template", filename),
			filepath.Join(filepath.Dir(cwd), "templates", "subscription", "row-template", filename),
			filepath.Join(filepath.Dir(filepath.Dir(cwd)), "templates", "subscription", "row-template", filename),
		)
	}

	// Executable-based paths
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(exeDir, "templates", "subscription", "row-template", filename),
			filepath.Join(filepath.Dir(exeDir), "templates", "subscription", "row-template", filename),
			filepath.Join(filepath.Dir(filepath.Dir(exeDir)), "templates", "subscription", "row-template", filename),
		)
	}

	// Standard installation paths
	candidates = append(candidates,
		filepath.Join("/opt", "rebecca", "templates", "subscription", "row-template", filename),
		filepath.Join("/opt", "darkpanel", "templates", "subscription", "row-template", filename),
		filepath.Join("/var", "lib", "rebecca", "templates", "subscription", "row-template", filename),
		filepath.Join("/var", "lib", "darkpanel", "templates", "subscription", "row-template", filename),
	)

	return candidates
}

// ResolveSubscriptionTargetPath returns the absolute path where templates/subscription/index.html
// should be stored when activating a template.
func ResolveSubscriptionTargetPath() string {
	candidates := []string{}

	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates, filepath.Join(cwd, "templates", "subscription"))
	}
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(exeDir, "templates", "subscription"),
			filepath.Join(filepath.Dir(exeDir), "templates", "subscription"),
		)
	}
	candidates = append(candidates,
		filepath.Join("/opt", "darkpanel", "templates", "subscription"),
		filepath.Join("/opt", "rebecca", "templates", "subscription"),
		filepath.Join("/var", "lib", "darkpanel", "templates", "subscription"),
		filepath.Join("/var", "lib", "rebecca", "templates", "subscription"),
	)

	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && info.IsDir() {
			return filepath.Join(c, "index.html")
		}
		parent := filepath.Dir(c)
		if info, err := os.Stat(parent); err == nil && info.IsDir() {
			return filepath.Join(c, "index.html")
		}
	}

	return filepath.Join("templates", "subscription", "index.html")
}
