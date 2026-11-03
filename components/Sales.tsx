'use client';
import { useState } from 'react';
import { useApp, useRows } from './AppProvider';
import { Badge, emptyLine, Lines, Panel, Table, type Line } from './ui';
import { bounds, dateTime, downloadCsv, inr, nowLocalInput, qty } from '@/lib/format';
import { CHANNELS } from '@/lib/types';

type SaleRow = { id: string; sale_number: string; sold_at: string; channel: string; location: string | null; payment_method: string | null; external_order_reference: string | null; notes: string | null; discount_amount: number; selling_fees: number; shipping_cost: number; status: string; sale_items: { id: string; quantity: number; unit_selling_price: number; line_revenue: number; line_cogs: number; products: { name: string; sku: string } | null }[] };

const net = (s: SaleRow) => s.sale_items.reduce((a, i) => a + Number(i.line_revenue), 0) - Number(s.discount_amount);
const cogs = (s: SaleRow) => s.sale_items.reduce((a, i) => a + Number(i.line_cogs), 0);

export function Sales() {
  const { db, products, canWrite, canAdmin, isOwner, run, busy } = useApp();
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const blank = { channel: 'Website', location: '', date: nowLocalInput(), discount: '0', fees: '0', shipping: '0', ref: '', payment: '', notes: '', number: '' };
  const [f, setF] = useState(blank); const [q, setQ] = useState('');
  const { rows } = useRows<SaleRow>((d, r) => { const b = bounds(r.from, r.to); return d.from('sales').select('*,sale_items(id,quantity,unit_selling_price,line_revenue,line_cogs,products(name,sku))').gte('sold_at', b.start).lte('sold_at', b.end).order('sold_at', { ascending: false }).limit(500); });
  const [editing, setEditing] = useState<SaleRow | null>(null);
  const [ef, setEf] = useState({ channel: '', date: '', location: '', ref: '', payment: '', discount: '0', fees: '0', shipping: '0', notes: '', number: '' });
  const [prices, setPrices] = useState<Record<string, string>>({});
  const toLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const startEdit = (s: SaleRow) => {
    setEditing(s);
    setEf({ channel: s.channel, date: toLocal(s.sold_at), location: s.location ?? '', ref: s.external_order_reference ?? '', payment: s.payment_method ?? '', discount: String(s.discount_amount), fees: String(s.selling_fees), shipping: String(s.shipping_cost), notes: s.notes ?? '', number: s.sale_number });
    setPrices(Object.fromEntries(s.sale_items.map(i => [i.id, String(i.unit_selling_price)])));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editing) return;
    const ok = await run(() => db.rpc('update_sale', { p_sale: editing.id, p_sold_at: new Date(ef.date).toISOString(), p_channel: ef.channel, p_location: ef.location || null, p_order_ref: ef.ref || null, p_payment: ef.payment || null, p_discount: Number(ef.discount || 0), p_fees: Number(ef.fees || 0), p_shipping: Number(ef.shipping || 0), p_notes: ef.notes || null, p_sale_number: ef.number, p_prices: editing.sale_items.map(i => ({ item: i.id, price: Number(prices[i.id]) })) }), 'Sale updated. The change is recorded in the activity log.');
    if (ok) setEditing(null);
  }
  const gross = lines.reduce((a, l) => a + Number(l.qty || 0) * Number(l.price || 0), 0);
  const shown = rows.filter(s => `${s.sale_number} ${s.channel} ${s.external_order_reference ?? ''} ${s.sale_items.map(i => i.products?.name).join(' ')}`.toLowerCase().includes(q.toLowerCase()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = lines.filter(l => l.product).map(l => ({ product: l.product, qty: Number(l.qty), price: Number(l.price) }));
    const ok = await run(() => db.rpc('post_sale', { p_items: items, p_channel: f.channel, p_date: new Date(f.date).toISOString(), p_location: f.location || null, p_discount: Number(f.discount || 0), p_fees: Number(f.fees || 0), p_shipping: Number(f.shipping || 0), p_order_ref: f.ref || null, p_payment: f.payment || null, p_notes: f.notes || null, p_number: f.number || null }), 'Sale recorded and stock deducted (FIFO).');
    if (ok) { setLines([emptyLine()]); setF({ ...blank, channel: f.channel, date: nowLocalInput() }); }
  }
  const cancel = async (s: SaleRow) => { const reason = prompt(`Cancel sale ${s.sale_number}? Stock will be restored. Enter a reason:`); if (reason?.trim()) await run(() => db.rpc('cancel_sale', { p_sale: s.id, p_reason: reason.trim() }), 'Sale cancelled and stock restored.'); };

  return <>
    {isOwner && editing && <Panel title={`Edit sale ${editing.sale_number}`} sub="Owner only. Fix the date, channel, order details, discount/fees/shipping or selling prices. Products and quantities can't be changed here because they move stock: cancel the sale and record it again for that.">
      <form onSubmit={saveEdit}>
        <div className="form-grid">
          <label>Date & time<input type="datetime-local" required value={ef.date} onChange={e => setEf({ ...ef, date: e.target.value })} /></label>
          <label>Channel<select value={ef.channel} onChange={e => setEf({ ...ef, channel: e.target.value })}>{[...new Set([...CHANNELS, ef.channel])].map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Sale no.<input required value={ef.number} onChange={e => setEf({ ...ef, number: e.target.value })} /></label>
          <label>Location / city<input value={ef.location} onChange={e => setEf({ ...ef, location: e.target.value })} /></label>
          <label>Marketplace order ID<input value={ef.ref} onChange={e => setEf({ ...ef, ref: e.target.value })} /></label>
          <label>Payment method<input value={ef.payment} onChange={e => setEf({ ...ef, payment: e.target.value })} /></label>
        </div>
        <div className="lines">
          <div className="line head"><span>Product</span><span>Quantity</span><span>Selling price (₹)</span><span /></div>
          {editing.sale_items.map(i => <div className="line" key={i.id}>
            <input disabled value={`${i.products?.sku ?? ''} — ${i.products?.name ?? ''}`} aria-label="Product" />
            <input disabled value={qty(i.quantity)} aria-label="Quantity" />
            <input type="number" required min="0" step="0.01" value={prices[i.id] ?? ''} onChange={e => setPrices({ ...prices, [i.id]: e.target.value })} aria-label="Selling price" />
            <span />
          </div>)}
        </div>
        <div className="form-grid compact">
          <label>Discount (₹)<input type="number" min="0" step="0.01" value={ef.discount} onChange={e => setEf({ ...ef, discount: e.target.value })} /></label>
          <label>Platform / payment fees (₹)<input type="number" min="0" step="0.01" value={ef.fees} onChange={e => setEf({ ...ef, fees: e.target.value })} /></label>
          <label>Shipping cost you paid (₹)<input type="number" min="0" step="0.01" value={ef.shipping} onChange={e => setEf({ ...ef, shipping: e.target.value })} /></label>
          <label>Notes<input value={ef.notes} onChange={e => setEf({ ...ef, notes: e.target.value })} /></label>
        </div>
        <div className="form-foot"><span>Net sale value: <b>{inr(editing.sale_items.reduce((a, i) => a + Number(i.quantity) * Number(prices[i.id] || 0), 0) - Number(ef.discount || 0))}</b></span>
          <span className="row"><button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" disabled={busy}>Save changes</button></span></div>
      </form>
    </Panel>}
    {canWrite && <Panel title="Record sale" sub="Stock is deducted oldest-lot-first. If any line is short of stock, the whole sale is rejected.">
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>Channel<select value={f.channel} onChange={e => setF({ ...f, channel: e.target.value })}>{CHANNELS.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Date & time<input type="datetime-local" required value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label>
          <label>Location / city<input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} /></label>
          <label>Marketplace order ID<input value={f.ref} onChange={e => setF({ ...f, ref: e.target.value })} /></label>
          <label>Payment method<input value={f.payment} onChange={e => setF({ ...f, payment: e.target.value })} placeholder="UPI, COD, card…" /></label>
          <label>Sale no. <small>(blank = auto)</small><input value={f.number} onChange={e => setF({ ...f, number: e.target.value })} placeholder="SAL-1001" /></label>
        </div>
        <Lines lines={lines} setLines={setLines} products={products} priceLabel="Selling price (₹)" showStock onPick={p => String(p.selling_price)} />
        <div className="form-grid compact">
          <label>Discount (₹)<input type="number" min="0" step="0.01" value={f.discount} onChange={e => setF({ ...f, discount: e.target.value })} /></label>
          <label>Platform / payment fees (₹)<input type="number" min="0" step="0.01" value={f.fees} onChange={e => setF({ ...f, fees: e.target.value })} /></label>
          <label>Shipping cost you paid (₹)<input type="number" min="0" step="0.01" value={f.shipping} onChange={e => setF({ ...f, shipping: e.target.value })} /></label>
          <label>Notes<input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
        </div>
        <div className="form-foot"><span>Net sale value: <b>{inr(gross - Number(f.discount || 0))}</b></span><button className="btn primary" disabled={busy}>Post sale</button></div>
      </form>
    </Panel>}
    <Panel title="Sales ledger" action={<div className="row"><input className="search" placeholder="Search order, channel, product" value={q} onChange={e => setQ(e.target.value)} />
      <button className="btn sm" onClick={() => downloadCsv('advaitum-sales.csv', [['Sale', 'Date', 'Channel', 'Order ref', 'SKU', 'Product', 'Qty', 'Unit price', 'Line revenue', 'Line COGS', 'Sale discount', 'Fees', 'Shipping', 'Status'], ...rows.flatMap(s => s.sale_items.map(i => [s.sale_number, s.sold_at, s.channel, s.external_order_reference, i.products?.sku, i.products?.name, i.quantity, i.unit_selling_price, i.line_revenue, i.line_cogs, s.discount_amount, s.selling_fees, s.shipping_cost, s.status]))])}>CSV</button></div>}>
      <Table head={['Sale', 'Date', 'Channel', 'Items', 'Net revenue', 'COGS', 'Profit*', 'Status', '']} empty="No sales in this period.">
        {shown.map(s => { const cancelled = s.status === 'cancelled'; const p = net(s) - cogs(s) - Number(s.selling_fees) - Number(s.shipping_cost);
          return <tr key={s.id} className={cancelled ? 'muted' : ''}><td className="mono">{s.sale_number}</td><td>{dateTime(s.sold_at)}</td><td>{s.channel}</td><td>{s.sale_items.map(i => `${i.products?.name} ×${qty(i.quantity)}`).join(', ')}</td><td>{inr(net(s))}</td><td>{inr(cogs(s))}</td><td>{inr(p)}</td><td>{cancelled ? <Badge tone="bad">Cancelled</Badge> : <Badge tone="good">Posted</Badge>}</td><td className="actions">{isOwner && !cancelled && <button className="link" onClick={() => startEdit(s)}>Edit</button>}{canAdmin && !cancelled && <button className="link danger" onClick={() => cancel(s)}>Cancel</button>}</td></tr>; })}
      </Table>
      <p className="foot-note">*Profit = net revenue − FIFO cost − platform fees − shipping. Business expenses are deducted in Reports.</p>
    </Panel>
  </>;
}
