import * as vscode from 'vscode';
import * as path from 'path';

export async function findOpenApiSpecs(glob = '**/openapi.*') {
  const uris = await vscode.workspace.findFiles(glob, undefined, 1000);
  return uris.map(u => ({ uri: u, rel: vscode.workspace.asRelativePath(u) }));
}

export async function loadOpenApi(uri: vscode.Uri) {
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    const txt = Buffer.from(raw).toString('utf8');
    if (uri.fsPath.endsWith('.json') || txt.trim().startsWith('{')) return JSON.parse(txt);
    // YAML parsing: simple heuristic using js-yaml if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const yaml = require('js-yaml');
      return yaml.load(txt);
    } catch (e) {
      return null;
    }
  } catch (e) {
    return null;
  }
}


