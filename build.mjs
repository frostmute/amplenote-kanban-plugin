import serve, { error } from "create-serve";
import esbuild from "esbuild";
import JSZip from "jszip";
import fs from "node:fs";
import path from "node:path";

const IS_DEV = process.argv.includes("--dev");
const PAYLOAD_TOKEN = "__KANBAN_CORE_PLACEHOLDER__";
const CSS_TOKEN = "__BASE64CSSCONTENT__";

function escaper(replacements) {
  return Object.keys(replacements)
    .sort((a, b) => b.length - a.length)
    .map((k) => [k, replacements[k]]);
}

function safeReplace(haystack, replacements) {
  let result = haystack;
  for (const [token, value] of escaper(replacements)) {
    if (!result.includes(token)) {
      throw new Error(`Template is missing expected token: ${token}`);
    }
    result = result.split(token).join(value);
  }
  return result;
}

const packageNotePlugin = {
  name: "package-note-plugin",
  setup(build) {
    const options = build.initialOptions;
    options.write = false;

    build.onEnd(async ({ errors, outputFiles }) => {
      if (errors.length > 0) {
        console.error("Build failed:", errors);
        process.exitCode = 1;
        return;
      }
      if (!outputFiles || outputFiles.length === 0) {
        console.error("Build produced no output files");
        process.exitCode = 1;
        return;
      }

      let htmlContent = fs.readFileSync(path.join("assets", "embed.html"), "utf8");
      let cssB64 = "";
      let jsB64 = "";

      for (const file of outputFiles) {
        const { path: outputPath, text } = file;
        if (outputPath.match(/\.css$/)) {
          cssB64 = Buffer.from(text).toString("base64");
        } else if (outputPath.match(/\.js$/)) {
          let safeJs = text.replace(/new Function\(/g, "new Error(");
          safeJs = safeJs.replace(/\beval\(/g, "console.error(");
          jsB64 = Buffer.from(safeJs).toString("base64");
        }
      }

      if (!jsB64) throw new Error("Build produced no JS bundle");
      if (!cssB64) cssB64 = "";

      htmlContent = htmlContent.replace("__BASE64JAVASCRIPTCONTENT__", jsB64);
      htmlContent = htmlContent.replace("__BASE64CSSCONTENT__", cssB64);

      const coreSource = fs.readFileSync(path.join("src", "kanban-core.ts"), "utf8");
      const coreStripped = coreSource
        .replace(/^export const KanbanCore/m, "const KanbanCore")
        .replace(/^export\s+/gm, "");
      const coreInlined = `const KanbanCore = (function() {\n${coreStripped}\nreturn KanbanCore;\n})();`;

      const noteTemplate = fs.readFileSync(path.join("assets", "note.template.md"), "utf8");
      const noteContent = safeReplace(noteTemplate, { [PAYLOAD_TOKEN]: coreInlined });

      const zip = new JSZip();
      zip.file("build.html.json", htmlContent);
      zip.file("note.md", noteContent);

      const zipContent = await zip.generateAsync({ type: "nodebuffer" });
      const outputDirectory = path.dirname(outputFiles[0].path);

      if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(outputDirectory, { recursive: true });
      }

      fs.writeFileSync(path.join(outputDirectory, "plugin.zip"), zipContent);
      fs.writeFileSync(path.join(outputDirectory, "build.html.json"), htmlContent);
      fs.writeFileSync(path.join(outputDirectory, "note.md"), noteContent);
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
        error(`Build failed: ${JSON.stringify(errors)}`);
        process.exitCode = 1;
        return;
      }
      if (!outputFiles || outputFiles.length === 0) return;
      outputFiles.forEach((file) => {
        const { path: outputPath, text } = file;
        if (outputPath.match(/\.css$/)) {
          fs.writeFileSync(path.join(path.dirname(outputPath), "index.css"), text);
        } else if (outputPath.match(/\.js$/)) {
          fs.writeFileSync(path.join(path.dirname(outputPath), "index.js"), text);
          const htmlContent = fs.readFileSync(path.join("assets", "embed.dev.html"), "utf8");
          fs.writeFileSync(path.join(path.dirname(outputPath), "index.html"), htmlContent);
        } else if (outputPath.match(/\.js\.map$/)) {
          fs.writeFileSync(path.join(path.dirname(outputPath), "index.js.map"), text);
        }
      });
      serve.update();
    });
  }
};

const buildOptions = {
  bundle: true,
  define: {
    "process.env.NODE_ENV": IS_DEV ? '"development"' : '"production"',
  },
  entryPoints: ["src/index.tsx"],
  minify: !IS_DEV,
  format: "iife",
  outdir: "dist",
  sourceRoot: "src",
  plugins: [IS_DEV ? serveBuildPlugin : packageNotePlugin],
  target: ["es2022"],
  logLevel: "info",
};

if (IS_DEV) {
  const context = await esbuild.context(buildOptions);
  context.watch();

  serve.start({
    port: 5000,
    root: "./dist",
    live: true,
  });
} else {
  await esbuild.build(buildOptions);
}
