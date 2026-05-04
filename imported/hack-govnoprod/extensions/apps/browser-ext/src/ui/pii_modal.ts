export async function showPiiModal(analyses: { fileName: string; findings: any[]; maxSeverity: string }[]): Promise<'allow' | 'cancel'> {
  return new Promise((resolve) => {
    try {
      const id = '__curestry_pii_modal__';
      if (document.getElementById(id)) return resolve('cancel');
      const host = document.createElement('div');
      host.id = id;
      const shadow = host.attachShadow({ mode: 'closed' });
      const wrap = document.createElement('div');
      Object.assign(wrap.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', zIndex: '2147483650' } as CSSStyleDeclaration);
      const card = document.createElement('div');
      Object.assign(card.style, { width: '520px', maxWidth: '92vw', background: '#fff', borderRadius: '10px', padding: '12px', boxShadow: '0 12px 40px rgba(0,0,0,.25)', color: '#111', font: '14px/1.3 system-ui, sans-serif' } as CSSStyleDeclaration);
      const title = document.createElement('div'); title.textContent = 'PII Guard — Files detected'; title.style.fontWeight = '600'; title.style.marginBottom = '8px';
      card.appendChild(title);
      const list = document.createElement('div'); list.style.maxHeight = '300px'; list.style.overflow = 'auto'; list.style.marginBottom = '12px';
      analyses.forEach(a => {
        const h = document.createElement('div');
        h.style.borderBottom = '1px solid #eee'; h.style.padding = '8px 0';
        const fh = document.createElement('div'); fh.textContent = `${a.fileName} — risk: ${a.maxSeverity}`; fh.style.fontWeight = '600';
        h.appendChild(fh);
        if (a.findings && a.findings.length) {
          const ul = document.createElement('ul'); ul.style.margin = '6px 0 0'; ul.style.paddingLeft = '16px';
          a.findings.forEach((f: any) => { const li = document.createElement('li'); li.textContent = `[${f.severity}] ${f.message}`; ul.appendChild(li); });
          h.appendChild(ul);
        }
        list.appendChild(h);
      });
      card.appendChild(list);
      const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.justifyContent = 'flex-end'; actions.style.gap = '8px';
      const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel';
      const allowBtn = document.createElement('button'); allowBtn.textContent = 'Allow upload'; allowBtn.style.background = '#10b981'; allowBtn.style.color = '#fff'; allowBtn.style.border = 'none'; allowBtn.style.padding = '8px 12px'; allowBtn.style.borderRadius = '8px';
      actions.appendChild(cancelBtn); actions.appendChild(allowBtn); card.appendChild(actions);
      wrap.appendChild(card); shadow.appendChild(wrap); document.body.appendChild(host);
      const cleanup = () => { try { host.remove(); } catch {} };
      cancelBtn.addEventListener('click', () => { cleanup(); resolve('cancel'); });
      allowBtn.addEventListener('click', () => { cleanup(); resolve('allow'); });
    } catch (err) { try { console.error('pii_modal err', err); } catch {} ; resolve('cancel'); }
  });
}


