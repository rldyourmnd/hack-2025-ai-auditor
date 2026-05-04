import * as vscode from 'vscode';

export function createPfpStatusBar() {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 101);
  item.text = 'PFP: Idle';
  item.tooltip = 'PFP: File profiling status';
  item.show();
  return item;
}

export default { createPfpStatusBar };


