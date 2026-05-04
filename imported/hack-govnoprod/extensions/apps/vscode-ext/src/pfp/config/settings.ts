import * as vscode from 'vscode';

export function getPfpConfig() {
  const cfg = vscode.workspace.getConfiguration();
  return {
    tier: String(cfg.get('aiAuditorPfp.tier', 'full')),
    include: cfg.get<string[]>('aiAuditorPfp.include', ['**/*.py']) || ['**/*.py'],
    exclude: cfg.get<string[]>('aiAuditorPfp.exclude', ['**/node_modules/**','**/.git/**']) || [],
    maxWorkers: Number(cfg.get<number>('aiAuditorPfp.maxWorkers', 0) || 0),
    batchSize: Number(cfg.get<number>('aiAuditorPfp.batchSize', 200) || 200),
    enableLocalPreview: Boolean(cfg.get<boolean>('aiAuditorPfp.enableLocalPreview', true)),
    policyFile: String(cfg.get<string>('aiAuditorPfp.policyFile', '')),
    exportPath: String(cfg.get<string>('aiAuditorPfp.export.path', '.pfp/profiles.jsonl'))
  };
}

export default { getPfpConfig };


