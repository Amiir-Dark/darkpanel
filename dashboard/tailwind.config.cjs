/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ["class", ".rb-theme-dark"],
	content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
	theme: {
		extend: {
			colors: {
				canvas: "var(--rb-canvas)",
				surface: {
					1: "var(--rb-surface-1)",
					2: "var(--rb-surface-2)",
					3: "var(--rb-surface-3)",
				},
				hairline: {
					DEFAULT: "var(--rb-hairline)",
					strong: "var(--rb-hairline-strong)",
				},
				ink: {
					DEFAULT: "var(--rb-ink)",
					muted: "var(--rb-ink-muted)",
					subtle: "var(--rb-ink-subtle)",
					tertiary: "var(--rb-ink-tertiary)",
				},
				accent: {
					DEFAULT: "var(--rb-panel-accent)",
					hover: "var(--rb-panel-accent-hover)",
					soft: "var(--rb-panel-accent-soft)",
				},
			},
			fontFamily: {
				sans: [
					"Arad",
					"system-ui",
					"-apple-system",
					"BlinkMacSystemFont",
					"Segoe UI",
					"Roboto",
					"sans-serif",
				],
				mono: [
					"ui-monospace",
					"SFMono-Regular",
					"Menlo",
					"Monaco",
					"Consolas",
					"monospace",
				],
			},
			borderRadius: {
				panel: "10px",
			},
		},
	},
	plugins: [],
};

