'use client';
import { ArrowDownLeft, ArrowUpRight, Sparkles, TrendingUp, Wallet, Boxes } from 'lucide-react';
import { useApp, useRows } from './AppProvider';
import { Badge, Panel, Stat, Table } from './ui';
import { dateOnly, downloadCsv, inr, qty } from '@/lib/format';
import type { Summary } from '@/lib/types';

type RecentSale = { id: string; sale_number: string; sold_at: string; channel: string; status: string; discount_amount: number; sale_items: { quantity: number; line_revenue: number; line_cogs: number; products: { name: string; sku: string } | null }[] };

export function Overview({ go }: { go: (t: string) => void }) {
  const { products, range, canWrite } = useApp();
  const sum = useRows<Summary>(db => db.rpc('report_summary', { p_from: range.from, p_to: range.to }));
  const daily = useRows<{ day: string; revenue: number; profit: number }>((db, r) => db.rpc('report_daily', { p_from: r.from, p_to: r.to }));
  const recent = useRows<RecentSale>(db => db.from('sales').select('id,sale_number,sold_at,channel,status,discount_amount,sale_items(quantity,line_revenue,line_cogs,products(name,sku))').order('sold_at', { ascending: false }).limit(6));
  const s = sum.rows[0];
  const units = products.reduce((a, p) => a + p.stock, 0);
  const value = products.reduce((a, p) => a + p.stock_value, 0);
  const totalUnitsIn = products.reduce((a, p) => a + (p.total_in || 0), 0);
  const totalUnitsOut = products.reduce((a, p) => a + (p.total_out || 0), 0);
  const totalExpended = Number(s?.purchases_total || 0) + Number(s?.expenses_total || 0) + Number(s?.selling_fees || 0) + Number(s?.shipping || 0);
  const grossMargin = s && Number(s.net_revenue) > 0 ? Math.round((Number(s.gross_profit) / Number(s.net_revenue)) * 100) : 0;
  const watch = products.filter(p => p.active && p.stock <= p.reorder_level).sort((a, b) => a.stock - b.stock);
  const days = daily.rows.slice(-30), max = Math.max(1, ...days.map(d => Number(d.revenue)));

  return <>
    <div className="hero-banner">
      <div>
        <span className="eyebrow">YOUR BUSINESS AT A GLANCE</span>
        <h2 className="hero-title">Good morning.</h2>
        <p className="hero-sub">Here&apos;s what&apos;s happening with your Products In &amp; Out, Earnings, and Expenditure.</p>
      </div>
      <div className="row">
        <button className="btn sm" onClick={() => downloadCsv('advaitum-overview-snapshot.csv', [
          ['Metric', 'Value'],
          ['Earned Sales Revenue', s?.net_revenue ?? 0],
          ['Gross Profit', s?.gross_profit ?? 0],
          ['Net Profit', s?.net_profit ?? 0],
          ['Total Expended (Purchases + Ops + Fees)', totalExpended],
          ['Stock Purchased (Cash Out)', s?.purchases_total ?? 0],
          ['Operating Expenses', s?.expenses_total ?? 0],
          ['Inventory Value', value],
          ['Units in Stock', units],
          ['Cumulative Units IN', totalUnitsIn],
          ['Cumulative Units OUT', totalUnitsOut],
        ])}>↓ Export CSV</button>
        {canWrite && <button className="btn primary sm" onClick={() => go('Sales')}>+ Record sale</button>}
      </div>
    </div>

    <div className="stats stats-5">
      <Stat label="Sales revenue (Earned)" value={inr(s?.net_revenue)} tone="good" hint={`${s?.orders ?? 0} orders · ${qty(s?.units)} units sold`} />
      <Stat label="Gross profit" value={inr(s?.gross_profit)} tone="good" hint={`${grossMargin}% gross margin (FIFO)`} />
      <Stat label="Total expended" value={inr(totalExpended)} tone="bad" hint={`Stock ${inr(s?.purchases_total)} · Ops ${inr(s?.expenses_total)}`} />
      <Stat label="Inventory value" value={inr(value)} hint="At FIFO landed cost" />
      <Stat label="Units in stock" value={qty(units)} hint={`IN: +${qty(totalUnitsIn)} · OUT: -${qty(totalUnitsOut)}`} />
    </div>

    <div className="grid-2">
      <Panel title="Recent sales" sub="Latest recorded transactions" action={<div className="row"><button className="link" onClick={() => go('Sales')}>Open sales ledger ↗</button></div>}>
        <Table head={['Order', 'Product', 'Channel', 'Revenue', 'Profit', 'Status']} empty="No sales recorded yet.">
          {recent.rows.map(r => {
            const rev = r.sale_items.reduce((a, i) => a + Number(i.line_revenue), 0) - Number(r.discount_amount);
            const cogs = r.sale_items.reduce((a, i) => a + Number(i.line_cogs), 0);
            const prof = rev - cogs;
            return <tr key={r.id}>
              <td><span className="mono">{r.sale_number}</span><br /><small>{dateOnly(r.sold_at)}</small></td>
              <td>{r.sale_items.map(i => <div key={i.products?.sku || Math.random()}><b>{i.products?.name ?? '—'}</b><br /><small className="mono">{qty(i.quantity)} units · {i.products?.sku}</small></div>)}</td>
              <td><Badge>{r.channel}</Badge></td>
              <td><b>{inr(rev)}</b></td>
              <td className="pos">{inr(prof)}</td>
              <td>{r.status === 'cancelled' ? <Badge tone="bad">Cancelled</Badge> : <Badge tone="good">Posted</Badge>}</td>
            </tr>;
          })}
        </Table>
      </Panel>

      <Panel title="Stock to watch" sub="Products needing attention" action={<button className="link" onClick={() => go('Stock')}>Manage inventory ↗</button>}>
        {watch.length === 0 ? <p className="empty">All active SKUs are above their reorder level.</p> :
          <ul className="list">{watch.slice(0, 6).map(p => <li key={p.id}>
            <div><b>{p.name}</b><small className="mono">{p.sku} · IN +{qty(p.total_in)} / OUT -{qty(p.total_out)}</small></div>
            <div className="right">{p.stock <= 0 ? <Badge tone="bad">0 left · Out of stock</Badge> : <Badge tone="warn">{qty(p.stock)} left · Low stock</Badge>}</div>
          </li>)}</ul>}
        <div style={{ marginTop: 14 }}>
          <button className="btn block" onClick={() => go('Purchases')}>Receive stock (Purchase Order) ↗</button>
        </div>
      </Panel>
    </div>

    <div className="grid-2">
      <Panel title="Quick actions" sub="Keep your records up to date">
        <div className="quick-list">
          <button className="quick-item" onClick={() => go('Sales')}>
            <span className="quick-icon good"><ArrowUpRight size={17} /></span>
            <div><b>Record a sale (Stock OUT &amp; Earned)</b><small>Deducts FIFO inventory &amp; calculates net profit</small></div>
            <span>+</span>
          </button>
          <button className="quick-item" onClick={() => go('Purchases')}>
            <span className="quick-icon warn"><ArrowDownLeft size={17} /></span>
            <div><b>Receive inventory purchase (Stock IN &amp; Expended)</b><small>Adds purchase lot with landed freight cost</small></div>
            <span>+</span>
          </button>
          <button className="quick-item" onClick={() => go('Expenses')}>
            <span className="quick-icon bad"><Wallet size={17} /></span>
            <div><b>Log operating expense (Expended)</b><small>Ads, packaging, courier, rent &amp; salaries</small></div>
            <span>+</span>
          </button>
          <button className="quick-item" onClick={() => go('Products')}>
            <span className="quick-icon"><Boxes size={17} /></span>
            <div><b>Add a product</b><small>Create a new SKU with reorder alert threshold</small></div>
            <span>+</span>
          </button>
        </div>
      </Panel>

      <Panel title="Business snapshot &amp; trend" sub="Earned vs Expended summary for selected period">
        <div className="snapshot-box">
          <p><Sparkles size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Your recorded sales show <b>{inr(s?.gross_profit)}</b> in gross profit ({grossMargin}% margin) and <b>{inr(s?.net_profit)}</b> in net profit after <b>{inr(s?.expenses_total)}</b> in operating expenses. There are <b>{watch.length} products</b> with low or zero stock.
          </p>
        </div>
        {days.length === 0 ? <p className="empty">No daily sales trend in this period yet.</p> :
          <div className="chart" role="img" aria-label="Daily net sales" style={{ height: 120, marginTop: 12 }}>
            {days.map(d => <div key={d.day} className="bar-wrap" title={`${d.day}: ${inr(d.revenue)}`}>
              <div className="bar" style={{ height: `${Math.max(4, (Number(d.revenue) / max) * 100)}%` }} />
              <small>{d.day.slice(8)}</small>
            </div>)}
          </div>}
        <div style={{ marginTop: 12 }}>
          <button className="link" onClick={() => go('Reports')}><TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Explore full P&amp;L and In/Out reports ↗</button>
        </div>
      </Panel>
    </div>
  </>;
}
