#!/usr/bin/env node
// ponytail: tauri-to-theia-migrate — converts project.yaml to .theia/workspace.json
// Usage: node scripts/tauri-to-theia-migrate.js [project.yaml] [output.json]

"use strict";

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const inputPath = args[0] || "project.yaml";
const outputPath = args[1] || ".theia/workspace.json";

// ---- YAML parser (minimal — key: value, lists, nested) ----
function parseYaml(text) {
  const lines = text.split("\n");
  const root = {};
  const stack = [{ obj: root, indent: -1 }];

  for (const raw of lines) {
    const line = raw.replace(/\s*#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    const indent = raw.search(/\S/);
    while (stack.length > 1 && stack.at(-1).indent >= indent) stack.pop();

    const listMatch = line.match(/^\s*-\s+(.*)/);
    if (listMatch) {
      let frame = stack.at(-1);
      // auto-create list if parent key was parsed as empty object
      if (!frame.list) {
        frame.list = [];
        // find the key that points to this frame's obj and replace with list
        const parent = stack.at(-2);
        if (parent) {
          for (const k of Object.keys(parent.obj)) {
            if (parent.obj[k] === frame.obj) { parent.obj[k] = frame.list; break; }
          }
        }
      }
      frame.list.push(listMatch[1].trim());
      continue;
    }

    const kvMatch = line.match(/^\s*(\S+?)\s*:\s*(.*)/);
    if (!kvMatch) continue;

    const [, key, value] = kvMatch;
    const trimmed = value.trim();

    if (trimmed === "" || trimmed === "{}") {
      const nested = {};
      stack.at(-1).obj[key] = nested;
      stack.push({ obj: nested, indent });
    } else if (trimmed === "[]") {
      const nested = [];
      stack.at(-1).obj[key] = nested;
      stack.push({ obj: {}, list: nested, indent });
    } else {
      stack.at(-1).obj[key] = trimmed;
    }
  }
  return root;
}

// ---- convert project.yaml → workspace.json ----
function convert(projectYaml) {
  const cfg = parseYaml(projectYaml);
  const name = cfg.name || cfg.project_name || "AUDESYS Project";
  const srcDirs = cfg.source_dirs || cfg.src_dirs || [];
  const language = cfg.language || "ST";
  const folders = [{ path: "." }];

  for (const dir of srcDirs) {
    let dirName = dir.replace(/\/$/, "");
    const display = { src: "Source", hmi: "HMI Layouts", debug: "Debug" };
    folders.push({ path: dirName, name: display[dirName] || dirName });
  }

  return {
    folders,
    settings: {
      "workbench.colorTheme": "AUDESYS Dark",
      "editor.tabSize": 4,
      "editor.insertSpaces": true,
      "files.associations": { "*.st": "iecst", "*.il": "iecil", "*.ld": "iecdl" },
      "audesys.projectName": name,
      "audesys.projectLanguage": language
    },
    extensions: {
      recommendations: ["audesys-core", "audesys-st-editor", "audesys-hmi-designer"]
    }
  };
}

// ---- main ----
try {
  const yaml = fs.readFileSync(inputPath, "utf8");
  if (!yaml.trim()) {
    // empty file → generate from tauri.conf.json if present
    const tauriConf = "apps/studio/src-tauri/tauri.conf.json";
    if (fs.existsSync(tauriConf)) {
      const tc = JSON.parse(fs.readFileSync(tauriConf, "utf8"));
      const ws = {
        folders: [
          { path: "." },
          { path: "src", name: "Source" },
          { path: "hmi", name: "HMI Layouts" }
        ],
        settings: {
          "workbench.colorTheme": "AUDESYS Dark",
          "editor.tabSize": 4,
          "audesys.projectName": tc.productName || "AUDESYS Studio",
          "audesys.projectVersion": tc.version || "0.1.0"
        }
      };
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(ws, null, 2) + "\n");
      console.log(JSON.stringify(ws, null, 2));
      console.error(`\n✓ Generated ${outputPath} from ${tauriConf}`);
      process.exit(0);
    }
    // no tauri.conf.json either → generate minimal template
    const ws = convert("");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(ws, null, 2) + "\n");
    console.log(JSON.stringify(ws, null, 2));
    console.error(`\n! No project.yaml found, generated minimal template → ${outputPath}`);
    process.exit(0);
  }
  const ws = convert(yaml);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(ws, null, 2) + "\n");
  console.log(JSON.stringify(ws, null, 2));
  console.error(`\n✓ Converted ${inputPath} → ${outputPath}`);
} catch (e) {
  if (e.code === "ENOENT") {
    // file not found → generate minimal from tauri.conf.json
    const tauriConf = "apps/studio/src-tauri/tauri.conf.json";
    if (fs.existsSync(tauriConf)) {
      const tc = JSON.parse(fs.readFileSync(tauriConf, "utf8"));
      const ws = {
        folders: [
          { path: "." },
          { path: "src", name: "Source" },
          { path: "hmi", name: "HMI Layouts" }
        ],
        settings: {
          "workbench.colorTheme": "AUDESYS Dark",
          "editor.tabSize": 4,
          "audesys.projectName": tc.productName || "AUDESYS Studio",
          "audesys.projectVersion": tc.version || "0.1.0"
        }
      };
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(ws, null, 2) + "\n");
      console.log(JSON.stringify(ws, null, 2));
      console.error(`\n✓ No project.yaml — generated ${outputPath} from tauri.conf.json`);
      process.exit(0);
    }
    // fallback: minimal template
    const ws = convert("");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(ws, null, 2) + "\n");
    console.log(JSON.stringify(ws, null, 2));
    console.error(`\n! No project.yaml or tauri.conf.json — generated minimal template → ${outputPath}`);
  } else {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}
