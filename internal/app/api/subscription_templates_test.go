package api

import (
	"testing"

	"github.com/rebeccapanel/rebecca/internal/app/rowtemplates"
	"github.com/rebeccapanel/rebecca/internal/app/user"
)

func TestAllRowTemplatesEmbeddedAndRenderable(t *testing.T) {
	for _, tpl := range availableRowTemplates {
		t.Run(tpl.ID, func(t *testing.T) {
			content, err := rowtemplates.ReadTemplate(tpl.ID)
			if err != nil {
				t.Fatalf("failed to read template %q: %v", tpl.ID, err)
			}
			if len(content) == 0 {
				t.Fatalf("template %q has empty content", tpl.ID)
			}

			rendered, err := user.RenderSubscriptionPreview(string(content))
			if err != nil {
				t.Fatalf("failed to render template %q: %v", tpl.ID, err)
			}
			if len(rendered) == 0 {
				t.Fatalf("rendered output for template %q is empty", tpl.ID)
			}
		})
	}
}
