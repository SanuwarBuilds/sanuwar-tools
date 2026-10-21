(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let busy = false;
  let loading = false;
  const message = (text, error = false) => { $('license-message').textContent = text; $('license-message').className = error ? 'license-error' : ''; };
  async function api(path, data) {
    const response = await fetch(path, {method: data ? 'POST' : 'GET', credentials: 'same-origin', headers: {'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content}, body: data ? JSON.stringify(data) : undefined});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save license changes.');
    return result;
  }
  const date = value => value ? new Date(value * 1000).toLocaleString() : 'Not activated';
  async function load() {
    if (loading) return;
    loading = true;
    try {
      const result = await api('/api/admin/licenses');
      const savedDays = new Map(Array.from($('license-rows').children, row => [row.dataset.id, row.querySelector('input')?.value]));
      $('license-rows').replaceChildren();
      const flagged = result.licenses.filter(item => item.device_attempt_count > 0);
      const summary = $('device-attempt-summary');
      summary.hidden = flagged.length === 0;
      const latest = Math.max(0, ...flagged.map(item => item.last_device_attempt_at || 0));
      summary.textContent = flagged.length ? `Attention: ${flagged.length} license(s) have blocked device attempts. Latest: ${date(latest)}. Check the customer rows below.` : '';
      for (const item of result.licenses) {
        const row = document.createElement('tr'); row.dataset.id = item.id;
        for (const text of [`${item.label || 'Customer'} · ${item.id.slice(0,8)}`, item.revoked ? 'Revoked' : item.activated_at ? `Expires ${date(item.expires_at)}` : `${item.duration_days} days from activation`, item.bound ? 'One phone activated' : 'Unclaimed']) {
          const cell = document.createElement('td'); cell.textContent = text; row.append(cell);
        }
        const attempts = document.createElement('td');
        attempts.textContent = item.device_attempt_count > 0 ? `${item.device_attempt_count} blocked attempt(s) · Last: ${date(item.last_device_attempt_at)}` : 'None';
        if (item.device_attempt_count > 0) attempts.className = 'license-attempt';
        row.append(attempts);
        const actions = document.createElement('td');
        const days = document.createElement('input'); days.type = 'number'; days.min = '1'; days.max = '3650'; days.value = savedDays.get(item.id) || '7'; days.setAttribute('aria-label', `Days to add for ${item.label || item.id}`);
        actions.append(days);
        for (const [action, title] of [['renew','Add days / restore'],['revoke','Revoke']]) {
          const button = document.createElement('button'); button.textContent = title;
          button.addEventListener('click', async () => {
            if (busy) return; busy = true; button.disabled = true;
            try { await api(`/api/admin/licenses/${encodeURIComponent(item.id)}`, {action, days: Number(days.value)}); message(action === 'revoke' ? 'Access revoked. An offline lease can remain valid for up to 24 hours.' : 'Access renewed. Ask the customer to verify online.'); await load(); }
            catch (e) { message(e.message, true); }
            finally { busy = false; button.disabled = false; }
          });
          actions.append(button);
        }
        row.append(actions); $('license-rows').append(row);
      }
      $('license-count').textContent = `${result.licenses.length} latest licenses. Expired and revoked codes remain visible.`;
    } catch (e) { message(e.message, true); }
    finally { loading = false; }
  }
  $('license-create').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return; busy = true;
    const button = event.target.querySelector('button'); button.disabled = true;
    try {
      const form = new FormData(event.target);
      const result = await api('/api/admin/licenses', {label: form.get('label'), days: Number(form.get('days')), count: Number(form.get('count'))});
      $('license-codes').value = result.created.map(item => `${item.code} | ${item.days} days | ${item.label}`).join('\n');
      $('new-codes').hidden = false; message('Codes created. Save them before leaving this page.'); await load();
    } catch (e) { message(e.message, true); }
    finally { busy = false; button.disabled = false; }
  });
  $('initialize-licenses').addEventListener('click', async () => { try { await api('/api/admin/licenses/initialize', {}); message('Private database ready.'); await load(); } catch (e) { message(e.message, true); } });
  $('refresh-licenses').addEventListener('click', load);
  $('copy-codes').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('license-codes').value); message('Codes copied.'); } catch (_) { message('Select the codes above and copy them manually.'); } });
  load();
  // Visible admin pages check for new attempts without interrupting form editing.
  setInterval(() => {
    if (!document.hidden && !busy && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) load();
  }, 30000);
})();
