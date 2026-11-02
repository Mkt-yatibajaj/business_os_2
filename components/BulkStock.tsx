'use client';
import { useMemo, useState } from 'react';
import { useApp } from './AppProvider';
import { Panel } from './ui';
import { inr, qty as fmt } from '@/lib/format';

type Mode = 'adjustment_in' | 'adjustment_out' | 'damage' | 'count';
type Row = { sel: boolean; qty: string; cost: string };
const MODES: { id: Mode; label: string; col: string }[] = [
  { id: 'adjustment_in', label: 'Add stock (IN)', col: 'Qty to add' },
  { id: 'adjustment_out', label: 'Remove stock (audit correction)', col: 'Qty to remove' },
  { id: 'damage', label: 'Remove stock (damage / loss)', col: 'Qty to remove' },
  { id: 'count', label: 'Set to counted quantity (stock-take)', col: 'Counted qty' },
];
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function BulkStock() {
  const { db, products, run, busy } = useApp();
  const [mode, setMode] = useState<Mode>('adjustment_in');
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [reason, setReason] = useState(''); const [q, setQ] = useState(''); const [defCost, setDefCost] = useState('');
  const active = products.filter(p => p.active);
  const list = active.filter(p => `${p.sku} ${p.name}`.toLowerCase().includes(q.toLowerCase()));
  const get = (id: string): Row => rows[id] || { sel: false, qty: '', cost: '' };
  const patch = (id: string, p: Partial<Row>) => setRows(r => ({ ...r, [id]: { ...(r[id] || { sel: false, qty: '', cost: '' }), ...p } }));
  const modeInfo = MODES.find(m => m.id === mode)!;
  const needsCost = mode === 'adjustment_in' || mode === 'count';

  // The lines that will actually be sent
  const plan = useMemo(() => active.flatMap(p => {
    const r = rows[p.id]; if (!r?.sel || r.qty === '') return [];
    const n = Number(r.qty); if (!Number.isFinite(n) || n < 0) return [];
    let type: string; let amount: number;
    if (mode === 'count') { const d = r3(n - p.stock); if (d === 0) return []; type = d > 0 ? 'adjustment_in' : 'adjustment_out'; amount = Math.abs(d); }
    else { type = mode; amount = n; if (amount <= 0) return []; }
    const raw = r.cost !== '' ? r.cost : defCost;
    const cost = type === 'adjustment_in' ? (raw === '' ? NaN : Number(raw)) : null;
    return [{ p, type, amount, cost }];
  }), [active, rows, mode, defCost]);

  const missingCost = plan.filter(x => x.type === 'adjustment_in' && (x.cost === null || Number.isNaN(x.cost)));
  const tooMuch = plan.filter(x => x.type !== 'adjustment_in' && x.amount > x.p.stock);
  const unitsIn = plan.filter(x => x.type === 'adjustment_in').reduce((a, x) => a + x.amount, 0);
  const unitsOut = plan.filter(x => x.type !== 'adjustment_in').reduce((a, x) => a + x.amount, 0);
  const canSubmit = plan.length > 0 && !missingCost.length && !tooMuch.length && reason.trim() !== '' && !busy;

  const allVisibleSelected = list.length > 0 && list.every(p => get(p.id).sel);
  const toggleAll = (on: boolean) => setRows(r => { const n = { ...r }; list.forEach(p => { n[p.id] = { ...(n[p.id] || { sel: false, qty: '', cost: '' }), sel: on }; }); return n; });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = plan.map(x => ({ product: x.p.id, type: x.type, qty: x.amount, unit_cost: x.cost }));
    const ok = await run(() => db.rpc('adjust_stock_bulk', { p_items: items, p_reason: reason.trim() }), `${items.length} product${items.length > 1 ? 's' : ''} updated.`);
    if (ok) { setRows({}); setReason(''); }
  }

  return <Panel title="Bulk stock update" sub="Update many products in one go: tick products, enter quantities, apply once. All-or-nothing, every line is logged with your reason.">
    <form onSubmit={submit}>
      <div className="form-grid">
        <label>What do you want to do?<select value={mode} onChange={e => setMode(e.target.value as Mode)}>{MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
        <label>Reason / reference (applies to all)<input required value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Opening physical count, 2 Nov" /></label>
        {needsCost && <label>Default unit cost (₹) <small>(for rows without their own)</small><input type="number" min="0" step="0.01" value={defCost} onChange={e => setDefCost(e.target.value)} placeholder="optional" /></label>}
        <label>Find product<input className="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search SKU or name" /></label>
      </div>
      <div className="table-scroll" style={{ marginTop: 14, maxHeight: 460, overflowY: 'auto' }}>
        <table>
          <thead><tr>
            <th><input type="checkbox" aria-label="Select all shown" checked={allVisibleSelected} onChange={e => toggleAll(e.target.checked)} style={{ width: 'auto' }} /></th>
            <th>SKU</th><th>Product</th><th>On hand</th><th>{modeInfo.col}</th>{needsCost && <th>Unit cost (₹)</th>}<th>New on hand</th>
          </tr></thead>
          <tbody>{list.map(p => {
            const r = get(p.id); const n = Number(r.qty);
            const after = r.sel && r.qty !== '' && Number.isFinite(n) ? (mode === 'count' ? n : mode === 'adjustment_in' ? p.stock + n : p.stock - n) : null;
            return <tr key={p.id} className={r.sel ? '' : 'muted'}>
              <td><input type="checkbox" checked={r.sel} onChange={e => patch(p.id, { sel: e.target.checked })} style={{ width: 'auto' }} aria-label={`Select ${p.name}`} /></td>
              <td className="mono">{p.sku}</td><td>{p.name}</td><td>{fmt(p.stock)} {p.unit}</td>
              <td><input type="number" min="0" step="0.001" style={{ width: 110 }} value={r.qty} onChange={e => patch(p.id, { qty: e.target.value, sel: e.target.value !== '' ? true : r.sel })} aria-label={`${modeInfo.col} for ${p.name}`} /></td>
              {needsCost && <td><input type="number" min="0" step="0.01" style={{ width: 110 }} value={r.cost} placeholder={defCost || '—'} onChange={e => patch(p.id, { cost: e.target.value })} aria-label={`Unit cost for ${p.name}`} /></td>}
              <td className={after !== null && after < 0 ? 'neg' : ''}>{after === null ? '—' : fmt(after)}</td>
            </tr>;
          })}</tbody>
        </table>
        {list.length === 0 && <p className="empty">No products match.</p>}
      </div>
      <div className="form-foot">
        <span>
          {plan.length === 0 ? 'Tick products and enter quantities.' : <>{plan.length} product{plan.length > 1 ? 's' : ''}: <b className="pos">+{fmt(unitsIn)} in</b> · <b className="neg">−{fmt(unitsOut)} out</b>{unitsIn > 0 && !missingCost.length && <> · adds {inr(plan.reduce((a, x) => a + (x.type === 'adjustment_in' ? x.amount * Number(x.cost) : 0), 0))} stock value</>}</>}
          {missingCost.length > 0 && <small className="neg" style={{ display: 'block' }}>Unit cost needed for: {missingCost.map(x => x.p.sku).join(', ')}</small>}
          {tooMuch.length > 0 && <small className="neg" style={{ display: 'block' }}>Cannot remove more than on hand: {tooMuch.map(x => x.p.sku).join(', ')}</small>}
        </span>
        <span className="row">
          <button type="button" className="btn" onClick={() => setRows({})} disabled={busy}>Clear</button>
          <button className="btn primary" disabled={!canSubmit}>Apply to {plan.length || ''} product{plan.length === 1 ? '' : 's'}</button>
        </span>
      </div>
    </form>
  </Panel>;
}
