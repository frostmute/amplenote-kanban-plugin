import serve, { error, log } from "create-serve";
import esbuild from "esbuild";
import JSZip from "jszip";
import fs from "node:fs";
import path from "node:path";

const IS_DEV = process.argv.includes("--dev");

const packageNotePlugin = {
  name: "package-note-plugin",
  setup(build) {
    const options = build.initialOptions;
    options.write = false;

    build.onEnd(async ({ errors, outputFiles }) => {
      if (errors.length > 0) {
        console.error(errors);
      } else {
        let htmlContent = fs.readFileSync(path.join("assets", "embed.html"), "utf8");
        let pluginCode = "";

        for (const file of outputFiles) {
          const { path: outputPath } = file;
          if (outputPath.match(/plugin\.js$/)) {
            pluginCode = file.text;
          } else if (outputPath.match(/\.js$/)) {
            const base64JavascriptContent = Buffer.from(file.text).toString("base64");
            htmlContent = htmlContent.replace("__BASE64JAVASCRIPTCONTENT__", base64JavascriptContent);
          } else if (outputPath.match(/\.css$/)) {
            const base64CssContent = Buffer.from(file.text).toString("base64");
            htmlContent = htmlContent.replace("__BASE64CSSCONTENT__", base64CssContent);
          }
        }

        let markdownContent = fs.readFileSync(path.join("assets", "note.md"), "utf8");
        // Inject the compiled plugin TS into the markdown block
        // Strip the IIFE wrapper so it's a raw object as expected by Amplenote
        let strippedPlugin = pluginCode.trim();
        if (strippedPlugin.startsWith("var plugin = ")) {
          strippedPlugin = strippedPlugin.replace("var plugin = ", "");
        }
        if (strippedPlugin.endsWith(";")) {
          strippedPlugin = strippedPlugin.slice(0, -1);
        }
        markdownContent = markdownContent.replace("__BASE64JAVASCRIPTCONTENT__", strippedPlugin);

        const zip = new JSZip();
        zip.file("build.html.json", htmlContent);
        
        let finalMarkdown = `---
title: 'Plugin: Kanban board'
---

| | |
|-|-|
|name<!-- {"cell":{"colwidth":123}} -->|Kanban Board<!-- {"cell":{"colwidth":779}} -->|
|description<!-- {"cell":{"colwidth":123}} -->|A plugin to transform your notes into a customizable kanban board for streamlined task management.<!-- {"cell":{"colwidth":779}} -->|
|icon<!-- {"cell":{"colwidth":123}} -->|dashboard<!-- {"cell":{"colwidth":779}} -->|
|Instructions<!-- {"cell":{"colwidth":123}} -->|[^1]|
\\

\`\`\`javascript
${strippedPlugin}
\`\`\`

[build.html.json](attachment://PLACEHOLDER)

[^1]: 
    **Usage Instructions:**

    1. **Create a New Note:** Begin by creating a new note.

    1. **Activate Kanban View:** Click the three dots in the top right corner, then select **"Kanban Plugin: Create Board"** to transform the note into a kanban board.
`;

        zip.file("note.md", finalMarkdown);

        const zipContent = await zip.generateAsync({ type: "nodebuffer" });
        const outputDirectory = path.dirname(outputFiles[0].path);

        if (!fs.existsSync(outputDirectory)) {
          fs.mkdirSync(outputDirectory);
        }

        const zipPath = path.join(outputDirectory, "plugin.zip");
        fs.writeFileSync(zipPath, zipContent);
      }
    });
  }
};

const serveBuildPlugin = {
  name: "update-dev-plugin",
  setup(build) {
    const options = build.initialOptions;
    options.write = false;
    options.sourcemap = true;

    build.onEnd(({ errors, outputFiles }) => {
      if (errors.length > 0) {
        error(`Build failed: ${ JSON.stringify(errors) }`);
      } else {
        outputFiles.forEach(file => {
          const { path: outputPath } = file;

          if (outputPath.match(/\.css$/)) {
            const cssPath = path.join(path.dirname(outputPath), "index.css");
            fs.writeFileSync(cssPath, file.text);
          } else if (outputPath.match(/\.js$/)) {
            const javascriptPath = path.join(path.dirname(outputPath), "index.js");
            fs.writeFileSync(javascriptPath, file.text);

            const htmlContent = fs.readFileSync(path.join("assets", "embed.dev.html"), "utf8");
            const htmlPath = path.join(path.dirname(outputPath), "index.html");
            fs.writeFileSync(htmlPath, htmlContent);
          } else if (outputPath.match(/\.js.map$/)) {
            const sourcemapPath = path.join(path.dirname(outputPath), "index.js.map");
            fs.writeFileSync(sourcemapPath, file.text);
          }
        });

        serve.update();
      }
    });
  }
};

const buildOptions = {
  bundle: true,
  define: {
    "process.env.NODE_ENV": IS_DEV ? '"development"' : '"production"',
  },
  entryPoints: {
    "index": "src/index.tsx", 
    "plugin": "src/plugin.ts"
  },
  minify: !IS_DEV,
  format: "iife",
  globalName: "plugin",
  outdir: "build",
  sourceRoot: "src",
  plugins: [ IS_DEV ? serveBuildPlugin : packageNotePlugin ],
  target: [ "es2022" ],
};

if (IS_DEV) {
  const context = await esbuild.context(buildOptions);
  context.watch();

  serve.start({
    port: 5000,
    root: "./build",
    live: true,
  });
} else {
  await esbuild.build(buildOptions);
}
