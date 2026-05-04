import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
// load IO helpers at runtime to avoid compiling packages/io into this tsproject rootDir
// We'll attempt multiple resolution strategies at runtime (dev vs packaged)
// Resolution strategy (in order):
// 1) If running from workspace during development: require workspace packages/io/src via context.extensionPath
// 2) If running from a packaged extension in dev environment where repo root is parent paths: try relative workspace path
// 3) Require installed package name `ai-auditor-io` (packaged distribution)
// 4) As a last resort, attempt to resolve via NODE_PATH-like fallback to `../../packages/io/src` from CWD
// This helper centralizes resolution and logs helpful diagnostics to the output channel.
// @ts-ignore
let io: any = null;

function tryRequirePaths(paths: string[], out?: vscode.OutputChannel) {
  for (const p of paths) {
    try {
      // prefer resolved absolute path when provided
      const mod = require(p);
      out?.appendLine(`Loaded IO helpers from ${p}`);
      return mod;
    } catch (err:any) {
      out?.appendLine && out?.appendLine(`Require failed for ${p}: ${String(err?.message||err)}`);
    }
  }
  return null;
}
// UUID helper: use the uuid package (bundled) for deterministic stable generation.
// Robust UUID generation with zero external deps at runtime
function generateUuid(): string {
  try {
    const { randomUUID } = require('crypto');
    if (typeof randomUUID === 'function') return randomUUID();
  } catch {}
  try {
    // Optional dependency; if not bundled, we gracefully fall back
    // @ts-ignore
    const { v4: uuidv4 } = require('uuid');
    if (typeof uuidv4 === 'function') return uuidv4();
  } catch {}
  // RFC4122-ish fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function uploadRawFeaturesCommand(context: vscode.ExtensionContext, dryRun = false) {
  const out = vscode.window.createOutputChannel('AI Auditor');
  try {
    const cfg = vscode.workspace.getConfiguration();
    // endpoint may be a base URL (like http://127.0.0.1:8002/api/v1) or a full upload URL
    const rawEndpoint = (cfg.get<string>('ai-auditor.upload.endpoint') || '').trim();
    const base = rawEndpoint.replace(/\/$/, '');

    // Resolve final upload endpoint to match backend router naming.
    // Backend routers are included under `/api/v1` and define prefix `/entropy`.
    // Final public upload path should be: `/api/v1/entropy/upload/public`.
    let endpoint = '';
    if (!base) {
      endpoint = '';
    } else if (/(?:\/upload\/public|\/entropy\/upload\/public|\/upload|\/public|\/public-upload)$/.test(base)) {
      // user provided a full upload-like URL
      endpoint = base;
    } else if (/\/entropy\//.test(base)) {
      // contains entropy segment -> normalize to /entropy/upload/public
      endpoint = base.replace(/\/entropy(?:.*)?$/, '/entropy/upload/public');
    } else {
      // treat as host or api root; ensure /api/v1 present then append entropy upload public path
      const baseApi = /\/api\/v1/.test(base) ? base : base + '/api/v1';
      endpoint = baseApi.replace(/\/$/, '') + '/entropy/upload/public';
    }
    const profilesGlobs = cfg.get<string[]>('ai-auditor.upload.profilesGlobs', ['**/*profiles*.json*']);
    const findingsGlobs = cfg.get<string[]>('ai-auditor.upload.findingsGlobs', ['**/findings*.json*']);
    const maxMb = Number(cfg.get<number>('ai-auditor.upload.maxInputMB', 200) || 200);
    const root = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0])?.uri.fsPath || process.cwd();

    out.appendLine(`Upload: scanning for profiles/findings in ${root}`);
    // Ensure IO helpers available before any io.* calls
    if (!io) {
      out.appendLine('IO helpers not found; attempting robust resolution...');
      const candidates = [
        // vendored within VSIX (.pack/vendor/io)
        path.resolve(context.extensionPath, 'vendor', 'io'),
        path.resolve(__dirname, '..', 'vendor', 'io'),
        // workspace relative via extension context (when running from workspace dev extension)
        path.resolve(context.extensionPath, '..', '..', '..', 'packages', 'io', 'src'),
        // possible workspace layouts when extension launched from repo root
        path.resolve(process.cwd(), 'extensions', 'packages', 'io', 'src'),
        path.resolve(process.cwd(), '..', 'extensions', 'packages', 'io', 'src'),
        // compiled location relative to source
        path.resolve(__dirname, '..', '..', '..', 'packages', 'io', 'src'),
        // packaged npm dependency (try both scoped and legacy names)
        '@ai-auditor/io',
        'ai-auditor-io'
      ];
      io = tryRequirePaths(candidates, out);
      if (!io) {
        out.appendLine('All resolution attempts failed. See logs above for details.');
        vscode.window.showErrorMessage('AI Auditor: failed to load internal IO helpers. See Output -> AI Auditor for details.');
        throw new Error('IO module load failed');
      }
    }
    // Ensure CCI scan runs first, then export PFP profiles, and prefer files from the workspace audit directory
    try {
      const wsRoot = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0])?.uri.fsPath || process.cwd();
      // Run CCI scan via command (ensures activation ordering and existing behavior)
      try {
        out.appendLine('Executing command aiAuditor.scanCCIWorkspace...');
        await vscode.commands.executeCommand('aiAuditor.scanCCIWorkspace');
      } catch (e:any) { out.appendLine(`aiAuditor.scanCCIWorkspace failed: ${String(e?.message||e)}`); }

      // Export PFP profiles (ensure export exists)
      try {
        out.appendLine('Executing command aiAuditor.exportPfpProfiles...');
        await vscode.commands.executeCommand('aiAuditor.exportPfpProfiles');
      } catch (e:any) { out.appendLine(`aiAuditor.exportPfpProfiles failed: ${String(e?.message||e)}`); }

      // prefer audit directory as source for profiles/findings
      const auditDir = require('./utils/audit').getAuditDirForWorkspace(wsRoot);
      out.appendLine(`Looking for profiles/findings in audit dir: ${auditDir}`);
      let profileFiles = await io.globMany(profilesGlobs, auditDir);
      let findingFiles = await io.globMany(findingsGlobs, auditDir);
      // fallback to workspace root if none found in audit dir
      if ((!profileFiles || profileFiles.length === 0) && (!findingFiles || findingFiles.length === 0)) {
        out.appendLine('No profiles/findings found in audit dir; falling back to workspace root scan');
        profileFiles = await io.globMany(profilesGlobs, root);
        findingFiles = await io.globMany(findingsGlobs, root);
      }
      // attach to outer scope
      // @ts-ignore
      arguments[0];
      // reassign into locals used later
      // We'll shadow the names for remaining code
      (function setFiles(pf: string[], ff: string[]) {
        // @ts-ignore
        profileFiles = pf;
        // @ts-ignore
        findingFiles = ff;
      })(profileFiles, findingFiles);
      // expose via consts below
      // For readability, redefine consts
      // @ts-ignore
      var _profileFiles = profileFiles;
      // @ts-ignore
      var _findingFiles = findingFiles;
      // replace later references by these two
      // assign back where needed
      // (we'll use these names below)
      // eslint-disable-next-line no-unused-vars
      const __pf = _profileFiles;
      // eslint-disable-next-line no-unused-vars
      const __ff = _findingFiles;
      // Now continue by setting profileFiles/findingFiles variables in outer scope via simple assignment
      // (workaround - original code expects these consts below)
      // @ts-ignore
      profileFiles = _profileFiles;
      // @ts-ignore
      findingFiles = _findingFiles;
    } catch (e:any) {
      out.appendLine(`Pre-scan step error: ${String(e?.message||e)}`);
      // fallback: glob workspace root
      var profileFiles = await io.globMany(profilesGlobs, root);
      var findingFiles = await io.globMany(findingsGlobs, root);
    }
    // ensure profileFiles/findingFiles defined for subsequent code
    // @ts-ignore
    profileFiles = profileFiles || (await io.globMany(profilesGlobs, root));
    // @ts-ignore
    findingFiles = findingFiles || (await io.globMany(findingsGlobs, root));
    if (!profileFiles.length && !findingFiles.length) { vscode.window.showInformationMessage('No profiles/findings found'); return; }

    const tmp = await io.makeTempDir('ai-auditor-');
    const profilesOut = path.join(tmp, 'profiles.ndjson.gz');
    const findingsOut = path.join(tmp, 'findings.ndjson.gz');

    const profilesLines = await io.toNdjsonGz(profileFiles, profilesOut, [], (m: string) => out.appendLine(m));
    const findingsLines = await io.toNdjsonGz(findingFiles, findingsOut, ['weight','score','cdx','cci','scd','entropy'], (m: string) => out.appendLine(m));

    // Basic client-side validation before upload
    out.appendLine(`Archive validation: profiles_lines=${profilesLines}, findings_lines=${findingsLines}`);
    if (!profilesLines || profilesLines <= 0) {
      out.appendLine('Validation failed: no profiles found in archive; aborting upload.');
      vscode.window.showErrorMessage('Upload aborted: no profiles found in generated archive.');
      return;
    }
    if (!findingsLines || findingsLines <= 0) {
      // Ask user whether to proceed when findings empty — often indicates missing data
      const proceed = await vscode.window.showWarningMessage('Archive contains 0 findings. Upload anyway?', 'Upload', 'Cancel');
      if (proceed !== 'Upload') {
        out.appendLine('User cancelled upload due to zero findings.');
        return;
      }
      out.appendLine('User confirmed upload despite zero findings.');
    }

    const manifest = {
      version: '1.0',
      client: { name: 'ai-auditor', version: '0.1.0' },
      repo: { root: root, commit: null, default_grouping: 'top-level-folder' },
      counts: { profiles_lines: profilesLines, findings_lines: findingsLines },
      generated_at: new Date().toISOString()
    } as any;
    const manifestPath = path.join(tmp, 'manifest.json');
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    const zipPath = path.join(tmp, 'entropy-input-v1.zip');
    await io.zipFiles(zipPath, [ { name: 'profiles.ndjson.gz', path: profilesOut }, { name: 'findings.ndjson.gz', path: findingsOut }, { name: 'manifest.json', path: manifestPath } ]);

    const sha = await io.sha256File(zipPath);
    manifest.content_hash = `sha256:${sha}`;
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    // Rezip manifest update: regenerate zip including updated manifest
    await io.zipFiles(zipPath, [ { name: 'profiles.ndjson.gz', path: profilesOut }, { name: 'findings.ndjson.gz', path: findingsOut }, { name: 'manifest.json', path: manifestPath } ]);

    // ensure IO helpers available (redundant safety - try again before network ops)
    if (!io) {
      out.appendLine('Second-chance IO resolution...');
      const candidates = [
        path.resolve(context.extensionPath, 'vendor', 'io'),
        path.resolve(__dirname, '..', 'vendor', 'io'),
        path.resolve(context.extensionPath, '..', '..', '..', 'packages', 'io', 'src'),
        path.resolve(process.cwd(), 'extensions', 'packages', 'io', 'src'),
        path.resolve(__dirname, '..', '..', '..', 'packages', 'io', 'src'),
        '@ai-auditor/io',
        'ai-auditor-io'
      ];
      io = tryRequirePaths(candidates, out);
      if (!io) {
        out.appendLine('All resolution attempts failed on second pass.');
        vscode.window.showErrorMessage('AI Auditor: failed to load internal IO helpers. See Output -> AI Auditor for details.');
        throw new Error('IO module load failed');
      }
    }

    if (dryRun) {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(manifestPath));
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`Dry run: archive created at ${zipPath}`);
      return;
    }

    // prefer SecretStorage token, fallback to configuration token if not set
    const secretToken = await context.secrets.get('ai-auditor.upload.token');
    const cfgToken = cfg.get<string>('ai-auditor.upload.token') || '';
    const token = secretToken || cfgToken || undefined;
    const uploadId = generateUuid();
    out.appendLine(`Uploading ${zipPath} to ${endpoint}`);
    out.appendLine(`UploadId: ${uploadId}`);
    out.appendLine(`Token present: ${token ? 'yes' : 'no'}`);
    out.appendLine(`Archive size bytes: ${((await fs.promises.stat(zipPath)).size || 0)}`);
    // Avoid naming collision with other libs using `headers` symbol
    const uploadHeaders = { 'X-Upload-Id': uploadId, 'X-Repo-Id': vscode.workspace.name || '' };
    out.appendLine(`Headers: ${JSON.stringify(uploadHeaders)}`);
    const chunked = !!cfg.get<boolean>('ai-auditor.upload.chunked', false);
    // perform upload
    out.appendLine(`Resolved upload endpoint: ${endpoint}`);
    const res = await io.httpUpload(endpoint, zipPath, token, uploadHeaders, { retry: 2, chunked, partSize: 5 * 1024 * 1024 });
    out.appendLine(`Upload response: ${res.status}`);
    out.appendLine(`Upload body (first 2k): ${String(res.body || '').slice(0, 2048)}`);
    if (res.status === 200 || res.status === 202) {
      const isPublic = /\/entropy\/upload\/public\/?$/.test(endpoint);
      if (isPublic) {
        out.appendLine('Detected public endpoint; parsing immediate response');
        out.appendLine(`Public response body (first 2k): ${String(res.body||'').slice(0, 2048)}`);
        let payload: any = null;
        try {
          payload = JSON.parse(String(res.body||''));
        } catch (parseErr:any) {
          out.appendLine(`Failed to parse public response JSON: ${String(parseErr?.message||parseErr)}`);
        }
        const entropy = payload?.entropy ?? payload?.details?.scores?.CDX;
        const cci = payload?.cci ?? payload?.details?.scores?.CCI;
        if (typeof entropy !== 'undefined') {
          vscode.window.showInformationMessage(`Upload successful: id=${uploadId} — Entropy: ${entropy}${typeof cci !== 'undefined' ? `, CCI: ${cci}` : ''}`);
        } else if (payload) {
          // no entropy field but we have payload — show summary
          vscode.window.showInformationMessage(`Upload successful: id=${uploadId} — result received (see output)`);
        } else {
          vscode.window.showInformationMessage(`Upload successful: id=${uploadId}`);
        }
        try {
          // Persist public result into the workspace audit directory rather than project root
          const auditDir = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0])?.uri.fsPath ? require('./utils/audit').getAuditDirForWorkspace((vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0])?.uri.fsPath) : path.join(root, '.audit');
          if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
          const docPath = path.join(auditDir, `entropy-result-${uploadId}.json`);
          await fs.promises.writeFile(docPath, String(res.body||''), 'utf8');
          out.appendLine(`Public result saved: ${docPath}`);
          vscode.window.showInformationMessage(`Result saved: ${docPath}`);
        } catch (saveErr:any) {
          out.appendLine(`Failed to save public result: ${String(saveErr?.message||saveErr)}`);
          vscode.window.showWarningMessage('Upload succeeded but failed to save result file. See Output -> AI Auditor for details.');
        }
        return;
      }
      vscode.window.showInformationMessage(`Upload successful: id=${uploadId}`);
      // poll status until computed, then try to fetch result
      try {
        // derive baseUrl for status/result from resolved endpoint
        let baseUrl = endpoint;
        if (/\/(?:upload\/public|upload)\/?$/.test(baseUrl)) baseUrl = baseUrl.replace(/\/(?:upload\/public|upload)\/?$/, '');
        // Ensure baseUrl ends with /api/v1/entropy
        if (!/\/api\/v1\/entropy\/?$/.test(baseUrl)) {
          // if we already have /entropy appended somewhere, normalize to end with it
          if (/\/entropy(?![^/])/.test(baseUrl)) {
            baseUrl = baseUrl.replace(/\/$/, '');
          } else if (/\/api\/v1(?![^/])/.test(baseUrl)) {
            baseUrl = baseUrl.replace(/\/$/, '') + '/entropy';
          } else {
            baseUrl = baseUrl.replace(/\/$/, '') + '/api/v1/entropy';
          }
        }
        const pollInterval = cfg.get<number>('ai-auditor.upload.pollIntervalMs', 2000);
        const pollTimeout = cfg.get<number>('ai-auditor.upload.pollTimeoutMs', 120000);
        const start = Date.now();
        while (Date.now() - start < pollTimeout) {
          await new Promise((r) => setTimeout(r, pollInterval));
          try {
            const st = await io.httpGet(`${baseUrl}/status/${uploadId}`, token, {}, { retry: 1 });
            if (st.status >= 200 && st.status < 300) {
              const j = await st.json().catch(() => null);
              const status = j?.status || (typeof j === 'string' ? j : null);
              out.appendLine(`Status: ${String(status)}`);
              if (status === 'computed') {
                // fetch result
                const rres = await io.httpGet(`${baseUrl}/result/${uploadId}`, token, {}, { retry: 1 });
                if (rres.status >= 200 && rres.status < 300) {
                  const resultJson = await rres.json().catch(() => null);
                  out.appendLine(`Result fetched for ${uploadId}`);
                  // persist result into audit directory
                  try {
                    const auditDir = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0])?.uri.fsPath ? require('./utils/audit').getAuditDirForWorkspace((vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0])?.uri.fsPath) : path.join(root, '.audit');
                    if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
                    const docPath = path.join(auditDir, `entropy-result-${uploadId}.json`);
                    await fs.promises.writeFile(docPath, JSON.stringify(resultJson, null, 2), 'utf8');
                    const entropy = resultJson?.entropy ?? resultJson?.details?.scores?.CDX;
                    const cci = resultJson?.details?.scores?.CCI;
                    vscode.window.showInformationMessage(`Result saved: ${docPath}${typeof entropy!=='undefined' ? ` — Entropy: ${entropy}${typeof cci!=='undefined' ? `, CCI: ${cci}`: ''}`: ''}`);
                  } catch (saveErr:any) {
                    out.appendLine(`Failed to save public result: ${String(saveErr?.message||saveErr)}`);
                    vscode.window.showWarningMessage('Upload succeeded but failed to save result file. See Output -> AI Auditor for details.');
                  }
                }
                break;
              }
            }
          } catch (e:any) { out.appendLine(`Poll error: ${String(e?.message||e)}`); }
        }
      } catch (e:any) { out.appendLine(`Post-upload fetch error: ${String(e?.message||e)}`); }
    } else {
      await fs.promises.copyFile(zipPath, path.join(root, 'entropy-input-v1.zip')).catch(() => {});
      vscode.window.showErrorMessage(`Upload failed (${res.status}). Saved archive to workspace root.`);
    }
  } catch (e:any) {
    out.appendLine(`Upload error: ${String(e?.message || e)}`);
    vscode.window.showErrorMessage(`Upload failed: ${String(e?.message||e)}`);
  }
}


