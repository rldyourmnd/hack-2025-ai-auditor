import * as vscode from 'vscode';
import { GrabMethod, GrabResult } from './types';
import { trySimCopyCopy } from './simCopy';
import { tryWinUia } from './winUia';

export async function grabNow(): Promise<GrabResult> {
	const noClipboard = vscode.workspace.getConfiguration().get<boolean>('revizor.privacy.noClipboard', false);
    const out = vscode.window.createOutputChannel('AI Auditor');

	// Try UI Automation first (non-invasive, reads input directly)
	const cfg = vscode.workspace.getConfiguration();
	const captureMethod = String(cfg.get('revizor.captureMethod', 'auto') || 'auto');
	if (captureMethod === 'auto' || captureMethod === 'uia') {
		try {
			const uia = await tryWinUia(2500);
			out.appendLine(`capture[uia]: ${JSON.stringify(uia)}`);
			if (uia.ok && uia.text && uia.text.trim().length > 0) return uia;
		} catch (e) { out.appendLine(`capture[uia] error: ${'message' in (e as any) ? String((e as any).message) : String(e)}`); }
	}

	// Try simulated Select-All + Copy next (uses OS script to send Ctrl+A/Ctrl+C)
	if (captureMethod === 'auto' || captureMethod === 'simCopy') {
		try {
			const simResult = await trySimCopyCopy(1500);
			out.appendLine(`capture[simCopy]: ${JSON.stringify(simResult)}`);
			if (simResult.ok && simResult.text && simResult.text.trim().length > 0) {
				return simResult;
			}
		} catch (e) { out.appendLine(`capture[simCopy] error: ${'message' in (e as any) ? String((e as any).message) : String(e)}`); }
	}

	// Simple workflow: Just read current clipboard content (user copies text manually)
	if (!noClipboard && (captureMethod === 'auto' || captureMethod === 'clipboard')) {
		try {
			const clipboardResult = await trySimpleClipboardGrab();
			out.appendLine(`capture[clipboard]: ${JSON.stringify(clipboardResult)}`);
			if (clipboardResult.ok && clipboardResult.text.trim().length > 0) {
				return clipboardResult;
			}
		} catch (e) { out.appendLine(`capture[clipboard] error: ${'message' in (e as any) ? String((e as any).message) : String(e)}`); }
	}

	return { ok: false, method: null, text: '', elapsedMs: 0, platform: process.platform, message: 'Please select and copy text (Ctrl+C) first, then click Grab Cursor.' };
}

async function trySimpleClipboardGrab(): Promise<GrabResult> {
	const start = Date.now();
	if (process.platform !== 'win32') {
		return { ok: false, method: 'clipboard', text: '', elapsedMs: 0, platform: process.platform, message: 'Simple clipboard method only supports Windows' };
	}

	const extRoot = vscode.extensions.getExtension('your-publisher.ai-auditor-vscode')?.extensionPath || 
		vscode.extensions.all.find(e => e.id.endsWith('ai-auditor-vscode'))?.extensionPath || '';
	const script = require('path').join(extRoot, 'scripts', 'grab-clipboard-simple.ps1');

	return new Promise<GrabResult>((resolve) => {
		const { spawn } = require('child_process');
		const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true });
		let out = '';
		let err = '';
		let settled = false;
		
		const done = (ok: boolean, msg?: string) => {
			if (settled) return; 
			settled = true;
			const elapsedMs = Date.now() - start;
			resolve({ 
				ok, 
				method: 'clipboard', 
				text: ok ? out.trim() : '', 
				elapsedMs, 
				platform: process.platform, 
				message: msg || err.trim() 
			});
		};

		const timeout = setTimeout(() => { 
			try { ps.kill(); } catch {} 
			done(false, 'Simple clipboard grab timeout'); 
		}, 1000);

		ps.stdout.setEncoding('utf8');
		ps.stdout.on('data', (d: any) => { out += String(d); });
		ps.stderr.on('data', (d: any) => { err += String(d); });
		ps.on('exit', (code: number) => {
			clearTimeout(timeout);
			if (code === 0 && out.trim().length > 0) {
				done(true);
			} else {
				done(false, `Exit ${code}`);
			}
		});
	});
}