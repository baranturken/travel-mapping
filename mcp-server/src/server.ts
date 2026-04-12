import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const docsRoot = path.join(repoRoot, "docs");
const registeredAgentsRoot = path.join(repoRoot, ".github", "agents");

const areaSchema = z.enum(["product", "ux", "architecture", "ai"]).optional();
const readDocSchema = z.object({
  path: z.string().min(1),
});
const searchDocsSchema = z.object({
  query: z.string().min(1),
  area: areaSchema,
});
const readAgentSchema = z.object({
  agent: z.string().min(1),
});
const startEmulatorSchema = z.object({
  avdName: z.string().min(1),
});
const screenshotSchema = z.object({
  outputPath: z.string().min(1).optional(),
});

const tools: Tool[] = [
  {
    name: "project_overview",
    description: "Return the current product, stack, and priority summary for Travel Mapping.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_docs",
    description: "List markdown documentation files, optionally limited to one docs area.",
    inputSchema: {
      type: "object",
      properties: {
        area: {
          type: "string",
          enum: ["product", "ux", "architecture", "ai"],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "read_doc",
    description: "Read a markdown documentation file from the repo docs tree.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path such as product/vision.md or ai/agents/coder.md",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "search_docs",
    description: "Search documentation content for a phrase and return matching snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        area: {
          type: "string",
          enum: ["product", "ux", "architecture", "ai"],
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_agents",
    description: "List the repository custom agent profiles registered for Copilot.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "read_agent",
    description: "Read a specific repository custom agent profile from .github/agents.",
    inputSchema: {
      type: "object",
      properties: {
        agent: {
          type: "string",
          description: "Agent name without the .md suffix, such as orchestrator or qa",
        },
      },
      required: ["agent"],
      additionalProperties: false,
    },
  },
  {
    name: "transport_defaults",
    description: "Return the current default transport set and mapping rules.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "build_order",
    description: "Return the project's required implementation order and non-negotiable sequencing.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "android_tooling",
    description: "Detect Android tooling availability and list available emulators when possible.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "adb_devices",
    description: "List attached Android devices and emulators via adb.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "start_emulator",
    description: "Start a named Android emulator if the emulator binary and AVD exist.",
    inputSchema: {
      type: "object",
      properties: {
        avdName: { type: "string" },
      },
      required: ["avdName"],
      additionalProperties: false,
    },
  },
  {
    name: "capture_emulator_screenshot",
    description: "Capture a PNG screenshot from the active Android device or emulator via adb.",
    inputSchema: {
      type: "object",
      properties: {
        outputPath: {
          type: "string",
          description: "Optional absolute or repo-relative PNG output path",
        },
      },
      additionalProperties: false,
    },
  },
];

function asText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function ensureWithinDocs(relativePath: string) {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  const absolute = path.resolve(docsRoot, normalized);

  if (!absolute.startsWith(docsRoot)) {
    throw new Error("Requested path is outside the docs directory.");
  }

  if (!absolute.endsWith(".md")) {
    throw new Error("Only markdown files can be read through read_doc.");
  }

  return absolute;
}

async function walkMarkdownFiles(root: string, prefix = ""): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    const relative = path.join(prefix, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await walkMarkdownFiles(fullPath, relative)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(relative.replaceAll("\\", "/"));
    }
  }

  return results.sort();
}

async function readMarkdown(relativePath: string) {
  const absolutePath = ensureWithinDocs(relativePath);
  return fs.readFile(absolutePath, "utf8");
}

async function listDocs(area?: z.infer<typeof areaSchema>) {
  const root = area ? path.join(docsRoot, area) : docsRoot;
  const basePrefix = area ? `${area}/` : "";
  const files = await walkMarkdownFiles(root);
  return files.map((file) => `${basePrefix}${file}`);
}

async function searchDocs(query: string, area?: z.infer<typeof areaSchema>) {
  const files = await listDocs(area);
  const loweredQuery = query.toLowerCase();
  const matches: Array<{ path: string; snippet: string }> = [];

  for (const file of files) {
    const content = await readMarkdown(file);
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].toLowerCase().includes(loweredQuery)) {
        const start = Math.max(0, index - 1);
        const end = Math.min(lines.length, index + 2);
        matches.push({
          path: file,
          snippet: lines.slice(start, end).join("\n"),
        });
      }
    }
  }

  return matches;
}

async function which(command: string) {
  const locator = process.platform === "win32" ? "where.exe" : "which";

  try {
    const result = await execFileAsync(locator, [command], { timeout: 8_000 });
    return result.stdout
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function runCommand(command: string, args: string[], timeout = 20_000) {
  const result = await execFileAsync(command, args, {
    timeout,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });

  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

async function getAndroidTooling() {
  const commands = ["adb", "emulator", "avdmanager", "sdkmanager"];
  const availability = await Promise.all(
    commands.map(async (command) => ({
      command,
      paths: await which(command),
    })),
  );

  let avds: string[] = [];

  if (availability.find((item) => item.command === "emulator")?.paths.length) {
    try {
      const result = await runCommand("emulator", ["-list-avds"]);
      avds = result.stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    } catch {
      avds = [];
    }
  }

  return {
    platform: process.platform,
    availability,
    avds,
  };
}

async function getAdbDevices() {
  const result = await runCommand("adb", ["devices", "-l"]);
  return result.stdout;
}

async function startEmulator(avdName: string) {
  const emulatorPaths = await which("emulator");

  if (!emulatorPaths.length) {
    throw new Error("Android emulator binary was not found in PATH.");
  }

  const executable = emulatorPaths[0];
  const child = spawn(executable, ["-avd", avdName], {
    windowsHide: false,
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  return {
    message: `Emulator launch requested for ${avdName}.`,
    pid: child.pid ?? null,
  };
}

async function captureScreenshot(outputPath?: string) {
  const finalOutputPath = outputPath
    ? path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(repoRoot, outputPath)
    : path.join(repoRoot, "mcp-server", "artifacts", "latest-emulator-screenshot.png");

  await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });
  const { stdout } = await execFileAsync("adb", ["exec-out", "screencap", "-p"], {
    encoding: "buffer" as never,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });

  await fs.writeFile(finalOutputPath, stdout as unknown as Buffer);

  return {
    outputPath: finalOutputPath,
  };
}

const server = new Server(
  {
    name: "travel-mapping-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case "project_overview":
      return asText({
        appDirection: "Mobile-first travel planning app built with Expo and TypeScript.",
        backendDirection: "Supabase first, custom backend later.",
        storageDirection: "Local-first trip data with authenticated accounts.",
        mapDirection: "Free/open-source-first map stack using straight-line legs in v1.",
        designDirection: "Clean Mediterranean UI with white and blue tones.",
        priorityOrder: ["agent orchestration", "custom MCP server", "mobile app"],
      });

    case "list_docs": {
      const parsed = z.object({ area: areaSchema }).parse(args);
      return asText(await listDocs(parsed.area));
    }

    case "read_doc": {
      const parsed = readDocSchema.parse(args);
      return asText(await readMarkdown(parsed.path));
    }

    case "search_docs": {
      const parsed = searchDocsSchema.parse(args);
      return asText(await searchDocs(parsed.query, parsed.area));
    }

    case "list_agents": {
      const files = await walkMarkdownFiles(registeredAgentsRoot);
      const agents = files.map((file) => file.replace(/\.agent\.md$/u, ""));
      return asText(agents);
    }

    case "read_agent": {
      const parsed = readAgentSchema.parse(args);
      return asText(
        await fs.readFile(path.join(registeredAgentsRoot, `${parsed.agent}.agent.md`), "utf8"),
      );
    }

    case "transport_defaults":
      return asText({
        supportedDefaults: ["plane", "bus", "ferry", "train", "car"],
        customOption: true,
        renderingRule: "Use straight-line legs in v1 and keep route-aware rendering for future phases.",
      });

    case "build_order":
      return asText([
        "Create and maintain the agent orchestration system.",
        "Create and maintain the MCP server.",
        "Build the mobile app after the MCP layer is usable.",
      ]);

    case "android_tooling":
      return asText(await getAndroidTooling());

    case "adb_devices":
      return asText(await getAdbDevices());

    case "start_emulator": {
      const parsed = startEmulatorSchema.parse(args);
      return asText(await startEmulator(parsed.avdName));
    }

    case "capture_emulator_screenshot": {
      const parsed = screenshotSchema.parse(args);
      return asText(await captureScreenshot(parsed.outputPath));
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Travel Mapping MCP server failed to start.");
  console.error(error);
  process.exit(1);
});
