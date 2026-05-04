import * as vscode from "vscode";
import * as path from "path";
import { FindingsReport } from "./types";

export function publishFindingsReport(report: FindingsReport) {
  const coll = vscode.languages.createDiagnosticCollection("cci");
  coll.clear();

  const byFile: Record<string, vscode.Diagnostic[]> = {};
  for (const f of report.findings) {
    if (!f.file) continue;
    const sev = (f as any).appliedWeight >= 9 ? vscode.DiagnosticSeverity.Error : (f as any).appliedWeight >= 5 ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
    const range = new vscode.Range(new vscode.Position((f.line || 1) - 1, 0), new vscode.Position((f.line || 1) - 1, 160));
    const d = new vscode.Diagnostic(range, `${f.kind}: ${f.context || ""}`, sev);
    d.code = "CCI." + f.kind;
    d.source = "cci";
    byFile[f.file] = byFile[f.file] || [];
    byFile[f.file].push(d);
  }

  for (const file of Object.keys(byFile)) {
    try {
      // file paths from payload may be relative to workspace root
      const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || undefined;
      const abs = file && !file.startsWith('/') && wsRoot ? vscode.Uri.file(path.join(wsRoot, file)) : vscode.Uri.file(file);
      const uri = abs;
      coll.set(uri, byFile[file]);
    } catch (e) {
      // ignore
    }
  }
}


