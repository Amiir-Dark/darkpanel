import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import sass from "sass";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const publicDir = path.join(rootDir, "public");
const buildDir = path.join(rootDir, "build");
const staticsDir = path.join(buildDir, "statics");

const args = new Set(process.argv.slice(2));
const isDev = args.has("--dev");
const isServe = args.has("--serve");

function loadEnvFile(filePath) {
	const result = {};
	if (!fs.existsSync(filePath)) {
		return result;
	}
	const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}
		const eqIndex = trimmed.indexOf("=");
		if (eqIndex <= 0) {
			continue;
		}
		const key = trimmed.slice(0, eqIndex).trim();
		let value = trimmed.slice(eqIndex + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		result[key] = value;
	}
	return result;
}

function resolveSrcCandidate(candidate) {
	const extensions = ["", ".jsx", ".js", ".json", ".scss", ".css"];
	for (const ext of extensions) {
		const full = candidate + ext;
		if (fs.existsSync(full) && fs.statSync(full).isFile()) {
			return full;
		}
	}
	for (const indexFile of ["index.jsx", "index.js"]) {
		const full = path.join(candidate, indexFile);
		if (fs.existsSync(full) && fs.statSync(full).isFile()) {
			return full;
		}
	}
	return null;
}

const jsconfigAliasPlugin = {
	name: "jsconfig-aliases",
	setup(build) {
		build.onResolve({ filter: /^@\// }, (args) => {
			const resolved = resolveSrcCandidate(
				path.join(srcDir, args.path.slice(2)),
			);
			return resolved ? { path: resolved } : undefined;
		});

		build.onResolve({ filter: /^[^./]/ }, (args) => {
			if (args.resolveDir && args.resolveDir.includes("node_modules")) {
				return undefined;
			}
			const resolved = resolveSrcCandidate(path.join(srcDir, args.path));
			return resolved ? { path: resolved } : undefined;
		});
	},
};

const scssPlugin = {
	name: "scss-loader",
	setup(build) {
		build.onLoad({ filter: /\.s[ac]ss$/ }, (args) => {
			const compiled = sass.compile(args.path, {
				loadPaths: [srcDir, path.join(rootDir, "node_modules")],
			});
			return {
				contents: compiled.css,
				loader: "css",
				resolveDir: path.dirname(args.path),
			};
		});
	},
};

function copyPublicAssets() {
	if (!fs.existsSync(publicDir)) {
		return;
	}
	fs.cpSync(publicDir, buildDir, { recursive: true, force: true });
}

function writeHtmlEntry(metafile) {
	const template = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
	let entryJs = "";
	let entryCss = "";

	for (const [outPath, info] of Object.entries(metafile.outputs)) {
		const normalized = outPath.replace(/\\/g, "/");
		const entry = info.entryPoint ? info.entryPoint.replace(/\\/g, "/") : "";
		if (entry.endsWith("src/index.jsx") && normalized.endsWith(".js")) {
			entryJs = "/" + normalized.replace(/^build\//, "");
			if (info.cssBundle) {
				entryCss =
					"/" + info.cssBundle.replace(/\\/g, "/").replace(/^build\//, "");
			}
			break;
		}
	}

	let html = template.replace(
		'<script type="module" src="/src/index.jsx"></script>',
		entryJs
			? `<script type="module" crossorigin src="${entryJs}"></script>`
			: "",
	);

	if (entryCss) {
		html = html.replace(
			"</head>",
			`    <link rel="stylesheet" href="${entryCss}">\n  </head>`,
		);
	}

	fs.writeFileSync(path.join(buildDir, "index.html"), html, "utf8");
}

const envVars = {
	...loadEnvFile(path.join(rootDir, ".env")),
	...Object.fromEntries(
		Object.entries(process.env).filter(([k]) => k.startsWith("VITE_")),
	),
};

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(staticsDir, { recursive: true });
copyPublicAssets();

const buildOptions = {
	absWorkingDir: rootDir,
	entryPoints: [path.join(srcDir, "index.jsx")],
	bundle: true,
	splitting: true,
	format: "esm",
	platform: "browser",
	target: ["es2020"],
	jsx: "automatic",
	outdir: staticsDir,
	publicPath: "/statics/",
	entryNames: isDev ? "[name]" : "[name].[hash]",
	chunkNames: "chunk-[name].[hash]",
	assetNames: "[name].[hash]",
	minify: !isDev,
	sourcemap: isDev,
	metafile: true,
	external: ["/statics/*", "/fonts/*"],
	loader: {
		".js": "jsx",
		".jsx": "jsx",
		".svg": "file",
		".png": "file",
		".jpg": "file",
		".jpeg": "file",
		".gif": "file",
		".webp": "file",
		".woff": "file",
		".woff2": "file",
		".ttf": "file",
		".eot": "file",
	},
	define: {
		"process.env.NODE_ENV": JSON.stringify(
			isDev ? "development" : "production",
		),
		"import.meta.env": JSON.stringify({
			MODE: isDev ? "development" : "production",
			DEV: isDev,
			PROD: !isDev,
			BASE_URL: "/",
			NODE_ENV: isDev ? "development" : "production",
			...envVars,
		}),
	},
	plugins: [jsconfigAliasPlugin, scssPlugin],
	logLevel: "info",
};

if (isServe) {
	buildOptions.watch = {
		onRebuild(error, result) {
			if (error) {
				console.error("Rebuild failed:", error);
				return;
			}
			if (result?.metafile) {
				copyPublicAssets();
				writeHtmlEntry(result.metafile);
			}
		},
	};
}

const result = await esbuild.build(buildOptions);
writeHtmlEntry(result.metafile);

if (isServe) {
	const mimeTypes = {
		".html": "text/html; charset=utf-8",
		".js": "application/javascript; charset=utf-8",
		".css": "text/css; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".svg": "image/svg+xml",
		".png": "image/png",
		".jpg": "image/jpeg",
		".ico": "image/x-icon",
		".woff": "font/woff",
		".woff2": "font/woff2",
		".ttf": "font/ttf",
		".webmanifest": "application/manifest+json",
	};

	const apiTarget = new URL(envVars.VITE_BASE_API || "http://127.0.0.1:8000/api");
	const server = http.createServer((req, res) => {
		const reqUrl = new URL(req.url || "/", "http://127.0.0.1:3000");
		if (reqUrl.pathname.startsWith("/api")) {
			const proxyReq = http.request(
				{
					hostname: apiTarget.hostname,
					port: apiTarget.port || 80,
					path: reqUrl.pathname + reqUrl.search,
					method: req.method,
					headers: { ...req.headers, host: apiTarget.host },
				},
				(proxyRes) => {
					res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
					proxyRes.pipe(res);
				},
			);
			proxyReq.on("error", (err) => {
				res.writeHead(502);
				res.end(String(err));
			});
			req.pipe(proxyReq);
			return;
		}

		let relPath = decodeURIComponent(reqUrl.pathname);
		if (relPath.startsWith("/tutorial-content/") && relPath.endsWith("/")) {
			relPath += "index.html";
		}
		let filePath = path.join(buildDir, relPath);
		if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
			filePath = path.join(buildDir, "index.html");
		}
		const ext = path.extname(filePath).toLowerCase();
		res.writeHead(200, {
			"Content-Type": mimeTypes[ext] || "application/octet-stream",
		});
		fs.createReadStream(filePath).pipe(res);
	});

	server.listen(3000, "127.0.0.1", () => {
		console.log("React dashboard dev server listening on http://127.0.0.1:3000/");
	});
}
