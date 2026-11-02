'use client';
import { useApp, useRows } from './AppProvider';
import { Panel, Stat, Table } from './ui';
import { downloadCsv, inr, qty } from '@/lib/format';
import type { Summary } from '@/lib/types';

export function Reports() {
  const { range } = useApp();
  const sum = useRows<Summary>(db => db.rpc('report_summary', { p_from: range.from, p_to: range.to }));
  const ch = useRows<{ channel: string; orders: number; revenue: number; cogs: number; profit: number }>(db => db.rpc('report_by_channel', { p_from: range.from, p_to: range.to }));
  const pr = useRows<{ sku: string; name: string; units: number; revenue: number; cogs: number; profit: number }>(db => db.rpc('report_by_product', { p_from: range.from, p_to: range.to }));
  const s = sum.rows[0];
  const margin = s && Number(s.net_revenue) > 0 ? (Number(s.gross_profit) / Number(s.net_revenue)) * 100 : 0;
  const totalExpendedCash = Number(s?.purchases_total || 0) + Number(s?.expenses_total || 0) + Number(s?.selling_fees || 0) + Number(s?.shipping || 0);
  const netCashFlow = Number(s?.net_revenue || 0) - totalExpendedCash;

  const pl: [string, number, boolean?][] = s ? [
    ['Gross sales (Earned)', s.gross_sales],
    ['Less: customer discounts', -s.discounts],
    ['Net sales revenue (Earned)', s.net_revenue, true],
    ['Less: cost of goods sold (FIFO inventory consumed)', -s.cogs],
    ['Gross profit', s.gross_profit, true],
    ['Less: marketplace / payment gateway fees (Expended)', -s.selling_fees],
    ['Less: outbound shipping paid by you (Expended)', -s.shipping],
    ['Less: operating business expenses (Expended)', -s.expenses_total],
    ['Net accounting profit', s.net_profit, true],
  ] : [];

  const cashFlowRows: [string, number, boolean?][] = s ? [
    ['Total Cash Earned (Net Sales Revenue)', s.net_revenue, true],
    ['Less: Stock Purchased (Inventory In Expenditure)', -s.purchases_total],
    ['Less: Operating Business Expenses (Ads, Packaging, Rent, etc.)', -s.expenses_total],
    ['Less: Platform & Payment Gateway Fees', -s.selling_fees],
    ['Less: Shipping & Courier Outflows', -s.shipping],
    ['Total Expended (All Cash Outflows)', -totalExpendedCash, true],
    ['Net Cash Flow (Earned minus Expended)', netCashFlow, true],
  ] : [];

  return <>
    <div className="stats stats-5">
      <Stat label="Net sales (Earned)" value={inr(s?.net_revenue)} tone="good" hint={`${s?.orders ?? 0} orders · ${qty(s?.units)} units`} />
      <Stat label="Gross margin" value={`${margin.toFixed(1)}%`} hint={`Gross profit ${inr(s?.gross_profit)}`} />
      <Stat label="Net accounting profit" value={inr(s?.net_profit)} tone={Number(s?.net_profit) < 0 ? 'bad' : 'good'} hint="After COGS, fees & expenses" />
      <Stat label="Total expended" value={inr(totalExpendedCash)} tone="bad" hint={`Purchases ${inr(s?.purchases_total)} + Ops ${inr(s?.expenses_total)}`} />
      <Stat label="Net cash flow" value={inr(netCashFlow)} tone={netCashFlow < 0 ? 'bad' : 'good'} hint="Earned cash minus all expended" />
    </div>

    <div className="grid-2">
      <Panel title="Profit &amp; loss statement (FIFO Accrual)" sub={`${range.from} to ${range.to} · cancelled sales excluded`} action={<button className="btn sm" onClick={() => downloadCsv('advaitum-profit-loss.csv', [['Line', 'Amount'], ...pl.map(([l, v]) => [l, v])])}>CSV</button>}>
        <Table head={['P&L Line Item', 'Amount']} empty="No data in this period.">{pl.map(([l, v, bold]) => <tr key={l} className={bold ? 'total' : ''}><td>{l}</td><td>{inr(v)}</td></tr>)}</Table>
        <p className="foot-note">Accounting P&amp;L deducts FIFO Cost of Goods Sold only when items are sold.</p>
      </Panel>

      <Panel title="Earned vs. Expended (Cash Outflow Tracker)" sub={`${range.from} to ${range.to} · includes full stock purchase cash spent`} action={<button className="btn sm" onClick={() => downloadCsv('advaitum-earned-vs-expended.csv', [['Line', 'Amount'], ...cashFlowRows.map(([l, v]) => [l, v])])}>CSV</button>}>
        <Table head={['Cash Flow Item', 'Amount']} empty="No data in this period.">{cashFlowRows.map(([l, v, bold]) => <tr key={l} className={bold ? 'total' : ''}><td>{l}</td><td className={v < 0 ? 'neg' : 'pos'}>{inr(v)}</td></tr>)}</Table>
        <p className="foot-note">Tracks exact cash earned vs. total money expended on stock purchases, ads, packaging, and shipping.</p>
      </Panel>
    </div>

    <div className="grid-2">
      <Panel title="Performance by sales channel" action={<button className="btn sm" onClick={() => downloadCsv('advaitum-by-channel.csv', [['Channel', 'Orders', 'Net revenue', 'COGS', 'Gross profit'], ...ch.rows.map(r => [r.channel, r.orders, r.revenue, r.cogs, r.profit])])}>CSV</button>}>
        <Table head={['Channel', 'Orders', 'Net revenue', 'Gross profit']} empty="No sales in this period.">{ch.rows.map(r => <tr key={r.channel}><td><b>{r.channel}</b></td><td>{r.orders}</td><td>{inr(r.revenue)}</td><td className="pos">{inr(r.profit)}</td></tr>)}</Table>
      </Panel>
      <Panel title="Performance by product (SKU)" sub="Line revenue and FIFO gross profit per SKU" action={<button className="btn sm" onClick={() => downloadCsv('advaitum-by-product.csv', [['SKU', 'Product', 'Units Sold', 'Revenue', 'COGS', 'Profit'], ...pr.rows.map(r => [r.sku, r.name, r.units, r.revenue, r.cogs, r.profit])])}>CSV</button>}>
        <Table head={['Product', 'Units Sold', 'Revenue', 'Gross Profit']} empty="No sales in this period.">{pr.rows.map(r => <tr key={r.sku}><td><b>{r.name}</b> <small className="mono">{r.sku}</small></td><td>{qty(r.units)}</td><td>{inr(r.revenue)}</td><td className="pos">{inr(r.profit)}</td></tr>)}</Table>
      </Panel>
    </div>
  </>;
}
