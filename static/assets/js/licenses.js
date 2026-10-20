(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let busy = false;
  const message = (text, error = false) => { $('license-message').textContent = text; $('license-message').className = error ? 'license-error' : ''; };
  async function api(path, data) {
    const response = await fetch(path, {method: data ? 'POST' : 'GET', credentials: 'same-origin', headers: {'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content}, body: data ? JSON.stringify(data) : undefined});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save license changes.');
    return result;
  }
  const date = value => value ? new Date(value * 1000).toLocaleString() : 'Not activated';
  async function load() {
    try {
      const result = await api('/api/admin/licenses');
      $('license-rows').replaceChildren();
      for (const item of result.licenses) {
        const row = document.createElement('tr');
        for (const text of [`${item.label || 'Customer'} · ${item.id.slice(0,8)}`, item.revoked ? 'Revoked' : item.activated_at ? `Expires ${date(item.expires_at)}` : `${item.duration_days} days from activation`, item.bound ? 'One phone activated' : 'Unclaimed']) {
          const cell = document.createElement('td'); cell.textContent = text; row.append(cell);
        }
        const actions = document.createElement('td');
        const days = document.createElement('input'); days.type = 'number'; days.min = '1'; days.max = '3650'; days.value = '7'; days.setAttribute('aria-label', `Days to add for ${item.label || item.id}`);
        actions.append(days);
        for (const [action, title] of [['renew','Add days / restore'],['revoke','Revoke']]) {
          const button = document.createElement('button'); button.textContent = title;
          button.addEventListener('click', async () => {
            if (busy) return; busy = true; button.disabled = true;
            try { await api(`/api/admin/licenses/${encodeURIComponent(item.id)}`, {action, days: Number(days.value)}); message(action === 'revoke' ? 'Access revoked. An offline lease can remain valid for up to 5 hours.' : 'Access renewed. Ask the customer to verify online.'); await load(); }
            catch (e) { message(e.message, true); }
            finally { busy = false; button.disabled = false; }
          });
          actions.append(button);
        }
        row.append(actions); $('license-rows').append(row);
      }
      $('license-count').textContent = `${result.licenses.length} latest licenses. Expired and revoked codes remain visible.`;
    } catch (e) { message(e.message, true); }
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
})();
