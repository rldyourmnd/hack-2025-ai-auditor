import * as vscode from 'vscode';

export class OverlayController {
  private grabButton?: vscode.StatusBarItem;
  private analyzeButton?: vscode.StatusBarItem;
  private analyzeSendButton?: vscode.StatusBarItem;

  constructor(private readonly onClick: () => void) {}

  show() {
    // Grab Button - High priority position
    if (!this.grabButton) {
      this.grabButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
      this.grabButton.text = '$(arrow-down) Grab Cursor';
      this.grabButton.tooltip = 'AI Auditor — Grab text from Cursor AI input field';
      this.grabButton.command = 'aiAuditor.grabNow';
      this.grabButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    }
    
    // Analyze Button - Medium priority
    if (!this.analyzeButton) {
      this.analyzeButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 999);
      this.analyzeButton.text = '$(beaker) Analyze';
      this.analyzeButton.tooltip = 'AI Auditor — Analyze prompt from Cursor AI without sending';
      this.analyzeButton.command = 'aiAuditor.analyzeDraft';
    }
    
    // Analyze & Send Button - Lower priority
    if (!this.analyzeSendButton) {
      this.analyzeSendButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 998);
      this.analyzeSendButton.text = '$(rocket) Analyze & Send';
      this.analyzeSendButton.tooltip = 'AI Auditor — Analyze prompt and send to Cursor AI (Ctrl+Enter)';
      this.analyzeSendButton.command = 'aiAuditor.analyzeAndSend';
      this.analyzeSendButton.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
    }

    this.grabButton.show();
    this.analyzeButton.show();
    this.analyzeSendButton.show();
  }

  hide() {
    this.grabButton?.hide();
    this.analyzeButton?.hide();
    this.analyzeSendButton?.hide();
  }

  dispose() {
    this.grabButton?.dispose();
    this.analyzeButton?.dispose();
    this.analyzeSendButton?.dispose();
  }

  updateGrabStatus(success: boolean, textLength: number = 0) {
    if (this.grabButton) {
      if (success) {
        this.grabButton.text = `$(check) Grabbed (${textLength})`;
        this.grabButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        this.grabButton.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        // Reset after 3 seconds
        setTimeout(() => {
          if (this.grabButton) {
            this.grabButton.text = '$(arrow-down) Grab Cursor';
            this.grabButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
            this.grabButton.color = undefined;
          }
        }, 3000);
      } else {
        this.grabButton.text = '$(error) Grab Failed';
        this.grabButton.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        // Reset after 3 seconds
        setTimeout(() => {
          if (this.grabButton) {
            this.grabButton.text = '$(arrow-down) Grab Cursor';
            this.grabButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
            this.grabButton.color = undefined;
          }
        }, 3000);
      }
    }
  }
}


