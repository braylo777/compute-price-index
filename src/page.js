export const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Compute Price Index</title><style>
body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#0b0f17;color:#e6e9ef}main{max-width:980px;margin:auto;padding:24px}
h1{margin:0 0 4px}small,.muted{color:#8b93a7}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{padding:6px 8px;border-bottom:1px solid #222a3a;text-align:right}
td:first-child,th:first-child{text-align:left}.card{background:#121826;border:1px solid #222a3a;border-radius:10px;padding:16px;margin:16px 0}
input,select{background:#0b0f17;color:#e6e9ef;border:1px solid #333c52;border-radius:6px;padding:4px 6px;width:90px}label{margin-right:12px}
.bar{fill:#4f8cff}.band{fill:#4f8cff33}svg text{fill:#8b93a7;font-size:11px}</style></head><body><main>
<h1>Compute Price Index</h1><div class="muted" id="meta">loading live quotes…</div>
<div class="card"><h3>Spot index ($ / GPU-hour)</h3><svg id="chart" width="100%" height="300"></svg><table id="tbl"></table></div>
<div class="card"><h3>Forward curve</h3><select id="sku"></select> <span id="method" class="muted"></span><table id="fwd"></table></div>
<div class="card"><h3>Own vs rent (TCO)</h3>
<label>Capex/GPU $<input id="capex" value="30000"></label><label>Years<input id="years" value="4"></label>
<label>Utilization<input id="util" value="0.7"></label><label>$/kWh<input id="kwh" value="0.09"></label>
<div id="tco" style="margin-top:10px"></div></div>
<p class="muted">Method: per-source medians after modified-z (3.5) outlier removal, equal-weighted across sources. Sources: vast.ai marketplace API, RunPod public GraphQL. <a style="color:#4f8cff" href="https://github.com/braylo777/compute-price-index">Source &amp; methodology</a></p>
</main><script>
let data;
const $=id=>document.getElementById(id);
async function load(){data=await (await fetch('/api/index')).json();
$('meta').textContent='Observed '+new Date(data.observedAt).toLocaleString()+' · '+data.quoteCount+' quotes · '+(data.live?'live':'cached snapshot');
const rows=data.rows,w=$('chart').clientWidth||900,h=300,max=Math.max(...rows.map(r=>r.p75,0))*1.1,bw=w/rows.length;
$('chart').innerHTML=rows.map((r,i)=>{const y=v=>h-30-(v/max)*(h-50);return '<rect class="band" x="'+(i*bw+bw*.2)+'" width="'+bw*.6+'" y="'+y(r.p75)+'" height="'+Math.max(1,y(r.p25)-y(r.p75))+'"/><rect class="bar" x="'+(i*bw+bw*.3)+'" width="'+bw*.4+'" y="'+y(r.index)+'" height="'+(h-30-y(r.index))+'"/><text x="'+(i*bw+bw/2)+'" y="'+(h-12)+'" text-anchor="middle">'+r.sku+'</text><text x="'+(i*bw+bw/2)+'" y="'+(y(r.index)-4)+'" text-anchor="middle">$'+r.index.toFixed(2)+'</text>'}).join('');
$('tbl').innerHTML='<tr><th>SKU</th><th>Index</th><th>p25</th><th>p75</th><th>Quotes</th><th>Outliers dropped</th><th>Sources</th></tr>'+rows.map(r=>'<tr><td>'+r.sku+'</td><td>$'+r.index.toFixed(3)+'</td><td>'+r.p25.toFixed(2)+'</td><td>'+r.p75.toFixed(2)+'</td><td>'+r.n+'</td><td>'+r.dropped+'</td><td>'+Object.keys(r.sources).join(', ')+'</td></tr>').join('');
$('sku').innerHTML=rows.map(r=>'<option>'+r.sku+'</option>').join('');$('sku').value=rows.find(r=>r.sku==='H100')?'H100':rows[0].sku;fwd();tco();}
async function fwd(){const f=await (await fetch('/api/forward?sku='+encodeURIComponent($('sku').value))).json();
$('method').textContent='method: '+f.method+' · monthly drift '+(f.monthlyDrift*100).toFixed(1)+'%';
$('fwd').innerHTML='<tr>'+f.curve.map(c=>'<th>'+(c.months?c.months+'m':'spot')+'</th>').join('')+'</tr><tr>'+f.curve.map(c=>'<td>$'+c.price.toFixed(3)+'</td>').join('')+'</tr>';}
async function tco(){const q=new URLSearchParams({sku:$('sku').value,capexPerGpu:$('capex').value,years:$('years').value,utilization:$('util').value,dollarsPerKwh:$('kwh').value});
const t=await (await fetch('/api/tco?'+q)).json();$('tco').innerHTML=t.error?t.error:'Own: <b>$'+t.ownPerUsefulHr+'</b>/useful GPU-hr vs rent <b>$'+t.rentPerGpuHr+'</b> → <b>'+t.verdict.toUpperCase()+'</b>. Break-even utilization: '+(t.breakevenUtilization*100).toFixed(0)+'%';}
$('sku').onchange=()=>{fwd();tco()};['capex','years','util','kwh'].forEach(i=>$(i).oninput=tco);load();
</script></body></html>`;
