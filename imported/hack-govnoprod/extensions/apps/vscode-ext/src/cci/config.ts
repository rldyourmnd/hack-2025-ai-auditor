import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { CciConfig } from "./types";

const DEFAULTS: CciConfig = {
  backendUrl: "http://localhost:8080",
  sendFullFiles: false,
  maxPayloadBytes: 1024 * 1024, // 1MB
  ignorePatterns: [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/.venv/**",
    "**/venv/**",
    "**/__pycache__/**",
    "**/.mypy_cache/**",
    "**/.pytest_cache/**"
  ],
  timeoutMs: 10_000,
  heuristicFileMap: {},
  defaultHeuristicExtensions: ['.py'],
  // per-file processing timeout in ms
  fileTimeoutMs: 5000,
  // per-batch timeout (ms)
  batchTimeoutMs: 30000,
  maxFiles: 3000,
};

export function loadCciConfig(workspaceRoot: string | undefined): CciConfig {
  const workspaceConfig = vscode.workspace.getConfiguration("cci");
  let fileConfig: Partial<CciConfig> = {};

  if (workspaceRoot) {
    const cfgPath = path.join(workspaceRoot, ".cci", "cci.config.json");
    if (fs.existsSync(cfgPath)) {
      try {
        const raw = fs.readFileSync(cfgPath, "utf8");
        fileConfig = JSON.parse(raw) as Partial<CciConfig>;
      } catch (e) {
        // ignore parse errors; we'll fall back to settings
      }
    }
  }

  const merged: CciConfig = {
    backendUrl: (workspaceConfig.get<string>("backendUrl") as string) || fileConfig.backendUrl || DEFAULTS.backendUrl,
    authToken: (workspaceConfig.get<string>("authToken") as string) || fileConfig.authToken,
    sendFullFiles: (workspaceConfig.get<boolean>("sendFullFiles") as boolean) ?? fileConfig.sendFullFiles ?? DEFAULTS.sendFullFiles,
    maxPayloadBytes: (workspaceConfig.get<number>("maxPayloadBytes") as number) || fileConfig.maxPayloadBytes || DEFAULTS.maxPayloadBytes,
    ignorePatterns: (workspaceConfig.get<string[]>("ignorePatterns") as string[]) || fileConfig.ignorePatterns || DEFAULTS.ignorePatterns,
    timeoutMs: (workspaceConfig.get<number>("timeoutMs") as number) || fileConfig.timeoutMs || DEFAULTS.timeoutMs,
    fileTimeoutMs: (workspaceConfig.get<number>("fileTimeoutMs") as number) || fileConfig.fileTimeoutMs || DEFAULTS.fileTimeoutMs,
    batchTimeoutMs: (workspaceConfig.get<number>("batchTimeoutMs") as number) || fileConfig.batchTimeoutMs || DEFAULTS.batchTimeoutMs,
    heavyHeuristicsDisabled: (workspaceConfig.get<boolean>("heavyHeuristicsDisabled") as boolean) ?? fileConfig.heavyHeuristicsDisabled ?? false,
    maxFiles: (workspaceConfig.get<number>("maxFiles") as number) || fileConfig.maxFiles || DEFAULTS.maxFiles,
    // optional path for external heuristics (absolute)
    ...(workspaceConfig.get<string>("externalHeuristicsPath") ? { externalHeuristicsPath: workspaceConfig.get<string>("externalHeuristicsPath") as string } : {}),
    offlineMode: (workspaceConfig.get<boolean>("offlineMode") as boolean) ?? fileConfig.offlineMode ?? false,
  };

  // basic validation
  if (!merged.backendUrl) throw new Error("cci.backendUrl must be set");
  if (merged.maxPayloadBytes < 64 * 1024) merged.maxPayloadBytes = DEFAULTS.maxPayloadBytes;
  if (merged.timeoutMs < 1000) merged.timeoutMs = DEFAULTS.timeoutMs;

  return merged;
}


