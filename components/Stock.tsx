'use client';
import { useState } from 'react';
import { MessageSquare, Download } from 'lucide-react';
import { useApp, useRows } from './AppProvider';
import { Badge, Panel, Stat, Table } from './ui';
import { BulkStock } from './BulkStock';
import { dateTime, downloadCsv, inr, qty } from '@/lib/format';

type Move = { id: string; created_at: string; movement_type: string; quantity_delta: number; unit_cost: number; reason: string | null; products: { sku: string; name: string } | null };
const LABEL: Record<string, string> = { purchase: 'Stock IN · Purchase', sale: 'Stock OUT · Sale', adjustment_in: 'Stock IN · Added', adjustment_out: 'Stock OUT · Correction', damage: 'Stock OUT · Damage/Loss', return: 'Stock IN · Cancelled Sale' };

export function Stock() {
  const { db, products, canWrite, run, busy } = useApp();
  const [f, setF] = useState({ product: '', type: 'adjustment_in', qty: '1', cost: '', reason: '' });
  const [filterDir, setFilterDir] = useState<'all' | 'in' | 'out'>('all');
  const { rows } = useRows<Move>(d => d.from('stock_movements').select('id,created_at,movement_type,quantity_delta,unit_cost,reason,products(sku,name)').order('created_at', { ascending: false }).limit(300));

  const activeProducts = products.filter(p => p.active);
  const totalInAll = activeProducts.reduce((a, p) => a + (p.total_in || 0), 0);
  const totalOutAll = activeProducts.reduce((a, p) => a + (p.total_out || 0), 0);
  const totalStockAll = activeProducts.reduce((a, p) => a + p.stock, 0);
  const totalValueAll = activeProducts.reduce((a, p) => a + p.stock_value, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() => db.rpc('adjust_stock', { p_product: f.product, p_type: f.type, p_qty: Number(f.qty), p_reason: f.reason, p_unit_cost: f.type === 'adjustment_in' ? Number(f.cost) : null }), 'Stock adjusted and movement logged.');
    if (ok) setF({ ...f, qty: '1', cost: '', reason: '' });
  }

  const copyRestockMessage = () => {
    const low = activeProducts.filter(p => p.stock <= p.reorder_level);
    if (low.length === 0) { alert('All products are currently above their reorder level.'); return; }
    const lines = low.map(p => `• ${p.name} (${p.sku}): Current Stock ${qty(p.stock)} → Order ${qty(Math.max(20, p.reorder_level * 3 - p.stock))} ${p.unit}s`);
    const text = `Namaste, Purchase Order Request from *ADVAITUM*:\n\n${lines.join('\n')}\n\nPlease share proforma invoice & dispatch timeline.`;
    navigator.clipboard.writeText(text);
    alert('Supplier Restock Purchase Order copied to clipboard for WhatsApp/Email!');
  };

  const filteredMoves = rows.filter(m => {
    if (filterDir === 'in') return Number(m.quantity_delta) > 0;
    if (filterDir === 'out') return Number(m.quantity_delta) < 0;
    return true;
  });

  return <>
    <div className="stats">
      <Stat label="Cumulative Products IN" value={`+${qty(totalInAll)}`} tone="good" hint="Purchases + opening/added stock" />
      <Stat label="Cumulative Products OUT" value={`-${qty(totalOutAll)}`} tone="bad" hint="Sales + damage & write-offs" />
      <Stat label="Net Units On Hand" value={qty(totalStockAll)} hint={`${activeProducts.length} active SKUs`} />
      <Stat label="FIFO Inventory Value" value={inr(totalValueAll)} hint="Valued at landed lot cost" />
    </div>

    <Panel title="Products In &amp; Out — Live Stock Levels" sub="Complete unit flow per SKU with FIFO average landed cost" action={<div className="row">
      <button className="btn sm" onClick={copyRestockMessage}><MessageSquare size={14} /> Copy Low-Stock PO for WhatsApp</button>
      <button className="btn sm" onClick={() => downloadCsv('advaitum-inventory-in-out.csv', [['SKU', 'Product', 'Units IN', 'Units OUT', 'On Hand', 'Unit', 'Reorder Level', 'Avg Landed Cost', 'Stock Value'], ...activeProducts.map(p => [p.sku, p.name, p.total_in, p.total_out, p.stock, p.unit, p.reorder_level, p.stock > 0 ? (p.stock_value / p.stock).toFixed(2) : 0, p.stock_value])])}><Download size={14} /> CSV</button>
    </div>}>
      <Table head={['SKU', 'Product', 'Units IN', 'Units OUT', 'On Hand', 'Reorder Level', 'Avg Cost / Unit', 'Stock Value', 'Status']} empty="No products yet.">
        {activeProducts.map(p => <tr key={p.id}>
          <td className="mono">{p.sku}</td>
          <td><b>{p.name}</b></td>
          <td className="pos">+{qty(p.total_in)}</td>
          <td className="neg">-{qty(p.total_out)}</td>
          <td><b>{qty(p.stock)}</b> <small>{p.unit}</small></td>
          <td>{qty(p.reorder_level)}</td>
          <td>{p.stock > 0 ? inr(p.stock_value / p.stock) : '—'}</td>
          <td>{inr(p.stock_value)}</td>
          <td>{p.stock <= 0 ? <Badge tone="bad">Out of stock</Badge> : p.stock <= p.reorder_level ? <Badge tone="warn">Low stock</Badge> : <Badge tone="good">OK</Badge>}</td>
        </tr>)}
      </Table>
    </Panel>

    {canWrite && <Panel title="Manual Stock In / Out Adjustment" sub="For opening stock, found items, damage, loss, or audit corrections. Every adjustment is permanently logged.">
      <form className="form-grid" onSubmit={submit}>
        <label>Product<select required value={f.product} onChange={e => setF({ ...f, product: e.target.value })}><option value="">Select product</option>{activeProducts.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name} (on hand: {p.stock})</option>)}</select></label>
        <label>Direction / Type<select value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
          <option value="adjustment_in">Stock IN (+ Opening stock / Found)</option>
          <option value="adjustment_out">Stock OUT (- Audit correction)</option>
          <option value="damage">Stock OUT (- Damage / Loss)</option>
        </select></label>
        <label>Quantity<input type="number" required min="0.001" step="0.001" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} /></label>
        {f.type === 'adjustment_in' && <label>Unit cost (₹)<input type="number" required min="0" step="0.01" placeholder="e.g. 160" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} /></label>}
        <label>Reason / Reference<input required value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="e.g. Opening physical count / Broken bead" /></label>
        <div className="form-actions"><button className="btn primary" disabled={busy}>Apply stock movement</button></div>
      </form>
    </Panel>}

    {canWrite && <BulkStock />}

    <Panel title="Products In &amp; Out Movement Ledger" sub="Chronological audit trail of every unit entering or leaving your warehouse" action={<div className="row">
      <select value={filterDir} onChange={e => setFilterDir(e.target.value as 'all' | 'in' | 'out')} aria-label="Filter direction">
        <option value="all">All movements ({rows.length})</option>
        <option value="in">Stock IN only (+)</option>
        <option value="out">Stock OUT only (-)</option>
      </select>
      <button className="btn sm" onClick={() => downloadCsv('advaitum-stock-movements.csv', [['Date', 'SKU', 'Product', 'Type', 'Qty Change', 'Unit Cost', 'Reason'], ...filteredMoves.map(m => [m.created_at, m.products?.sku, m.products?.name, m.movement_type, m.quantity_delta, m.unit_cost, m.reason])])}><Download size={14} /> CSV</button>
    </div>}>
      <Table head={['Date & Time', 'Product', 'Movement Type', 'In / Out Qty', 'Unit Cost', 'Reason / Note']} empty="No stock movements recorded yet.">
        {filteredMoves.map(m => <tr key={m.id}>
          <td>{dateTime(m.created_at)}</td>
          <td><b>{m.products?.name}</b> <small className="mono">{m.products?.sku}</small></td>
          <td><Badge tone={Number(m.quantity_delta) > 0 ? 'good' : 'warn'}>{LABEL[m.movement_type] || m.movement_type}</Badge></td>
          <td className={Number(m.quantity_delta) < 0 ? 'neg' : 'pos'}>{Number(m.quantity_delta) > 0 ? '+' : ''}{qty(m.quantity_delta)}</td>
          <td>{inr(m.unit_cost)}</td>
          <td>{m.reason || '—'}</td>
        </tr>)}
      </Table>
    </Panel>
  </>;
}
