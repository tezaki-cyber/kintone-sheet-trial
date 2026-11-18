// 867 アジェンダの答え合わせ(試験用。キントーンには登録しない)。進捗シートの枠の中で eval して使う。
// agsExtract(): いま出ているアジェンダを「商品×確認すること」の1件ずつに分けて取り出す(本番の版でも試験の版でも動く)
// agsJudge(json): 取り出した1件ずつを、表の値(年は行の流れで決めたもの)・納品確認・ステータス・会話の印の状態と突き合わせて、合っている/外れの型 を数える
// 会話の文面は読まない。会話の根拠は、決まった言葉が入っているかどうかだけを機械で見る
function agsExtract() {
  const out = [], iso = d => d ? [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-') : null;
  const rd = (r, c) => typeof agD === 'function' ? agD(r, c) : agDate(r.v[c]);
  for (const g of ag.items) for (const [k, it] of g.issues) for (const r of it.rows) {
    const c = { id: String(r.id), key: k, kind: it.kind, label: String(it.label).slice(0, 140) };
    if (it.kind === 'rule') {
      const rule = ag.rules.find(x => x.id === k);
      c.dc = it.dc; c.bc = it.bc == null ? null : it.bc; c.date = it.dc != null ? iso(rd(r, it.dc)) : null;
      c.when = k.startsWith('st:') ? 'status' : rule ? rule.when : ''; c.days = rule && rule.days || 30;
    } else if (it.kind === 'conv') {
      const said = `${it.conv.根拠 || ''} ${it.conv.理由 || ''}`;
      c.code = k.split(':')[1]; c.val = String(it.conv.値 || ''); c.col = it.convC; c.target = it.conv.対象 === undefined ? null : String(it.conv.対象 || '');
      c.sample = /サンプル|見本|色校|校正刷|仕分け/.test(said); c.ship = /出荷|発送/.test(said); c.deliv = /納品|着荷|届/.test(said);
    } else if (it.kind === 'smell') {
      c.danger = it.smell; c.risk = String(it.risk || '').slice(0, 140); c.event = String(it.event || '').slice(0, 40);
      const xs = (ag.smell && ag.smell.get(String(r.id)) || []).filter(x => (x.event || '') === (it.event || ''));
      const x = xs[0] || {};
      c.x = { resolved: !!x.resolved, post: !!x.post, blocks: x.blocks === undefined ? null : x.blocks, fmin: x.fmin || 0, fmax: x.fmax || 0 };
    }
    out.push(c);
  }
  return JSON.stringify({ week: [iso(agWeek(ag.next).mon), iso(agWeek(ag.next).sun)], autoOff: ag.autoOff || [], skipped: ag.convSkipped || 0, claims: out });
}
function agsJudge(json) {
  const J = JSON.parse(json), D = 864e5, today = agToday(), t = +today, { mon, sun } = agWeek(false);
  const Y = agYears(), byId = new Map(rows.map(r => [String(r.id), r]));
  const real = rows.filter(r => /^\d+$/.test(String(r.id)) && String(r.v[NAME] || '').trim());
  const kc = COLS.findIndex(x => /納品確認/.test(String(x.name))), sts = agStatusCols(), sc = (sts[0] || {}).c;
  const truth = (row, c) => { const k = Y.col.get(c), o = k && Y.yr.get(row); return (o && o[k]) || (agParts(row.v[c]) ? null : null); };
  const DONE2 = /校了|責了|こうりょう|量産|済|完了|OK|ＯＫ|FIX|ＦＩＸ|不要|なし|無し|再販|発送|出荷|納品|入荷|中止/i;
  const unusedMemo = new Map();
  const unused = (dc, bc) => { const key = dc + ':' + bc; if (!unusedMemo.has(key)) { const old = real.filter(r => { const d = truth(r, dc); return d && d < today && t - d <= 180 * D; }); unusedMemo.set(key, old.length >= 8 && old.filter(r => String(r.v[bc] || '').trim()).length < old.length * .3); } return unusedMemo.get(key); };
  const has = new Set(J.claims.filter(c => c.kind === 'rule' && c.when === 'past').map(c => c.id + '|past|' + c.dc));
  const res = { total: 0, ok: 0, ng: {}, unknown: 0, byKind: {}, samples: {}, stOpen: {} };
  const mark = (c, v, row, note) => {
    res.total++; const bk = res.byKind[c.kind === 'rule' && c.when === 'status' ? 'status' : c.kind] = res.byKind[c.kind === 'rule' && c.when === 'status' ? 'status' : c.kind] || { n: 0, ok: 0 };
    bk.n++;
    if (v === 'ok') { res.ok++; bk.ok++; return; }
    if (v === '?') { res.unknown++; return; }
    res.ng[v] = (res.ng[v] || 0) + 1;
    const s = res.samples[v] = res.samples[v] || []; if (s.length < 3) s.push(`${String(row ? row.v[NAME] : c.id).slice(0, 18)}｜${c.label.slice(0, 46)}｜${note || ''}`);
  };
  const md = d => d ? `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` : '-';
  for (const c of J.claims) {
    const row = byId.get(c.id); if (!row) { mark(c, '?'); continue; }
    const o = Y.yr.get(row) || {}, E = o.納品 || o.発売 || o.出荷 || null, stage = agStage(sc != null ? row.v[sc] : ''), kk = kc >= 0 && !!String(row.v[kc] || '').trim();
    if (c.kind === 'rule' && c.when !== 'status') {
      const T = truth(row, c.dc); if (!T) { mark(c, '?'); continue; }
      const inWeek = T >= mon && T <= sun, inPast = T < today && t - T <= c.days * D;
      if (c.when === 'week' ? !inWeek : !inPast) { mark(c, '年の読み違い', row, `本当は ${md(T)}`); continue; }
      if (c.bc != null && unused(c.dc, c.bc)) { mark(c, '使われていない欄', row, COLS[c.bc].name.replace('\n', '')); continue; }
      if (c.when === 'week' && c.bc == null && T < today && has.has(c.id + '|past|' + c.dc)) { mark(c, '同じ日付を二重に', row); continue; }
      if (c.key === 'ny' && stage >= 2) { mark(c, 'もう済んでいる', row, `本体「${String(row.v[sc] || '').slice(0, 16)}」`); continue; }
      if (c.key === 'ny-k' && stage >= 3) { mark(c, 'もう済んでいる', row, `本体「${String(row.v[sc] || '').slice(0, 16)}」`); continue; }
      mark(c, 'ok');
    } else if (c.kind === 'rule') {
      const st = String(row.v[c.bc] || '').trim().replace(/\s+/g, ' '), T = c.dc != null ? truth(row, c.dc) : null;
      if (!st || DONE2.test(st)) { mark(c, 'もう済んでいる', row, `「${st.slice(0, 20)}」`); continue; }
      if (!T) { mark(c, '?'); continue; }
      if (T < t - 45 * D || T > +sun + 56 * D) { mark(c, '年の読み違い', row, `本当は ${md(T)}`); continue; }
      res.stOpen[st.slice(0, 24)] = (res.stOpen[st.slice(0, 24)] || 0) + 1;
      mark(c, 'ok');
    } else if (c.kind === 'conv') {
      if (c.target && c.target !== '本体' && c.target !== '不明') { mark(c, '本体の話ではない', row, c.target.slice(0, 10)); continue; }
      if ((c.code === '会話_工程' || c.code === '会話_納品日') && c.sample) { mark(c, 'サンプルの話', row); continue; }
      if (c.code === '会話_納品日' && c.ship && !c.deliv) { mark(c, '出荷日を納品日と取り違え', row); continue; }
      const v = c.val.match(/^(\d{4})-(\d\d)-(\d\d)$/);
      if (v) {
        const d = +new Date(+v[1], v[2] - 1, +v[3]), cur = agParts(row.v[c.col]), k = Y.col.get(c.col);
        if (cur && cur.m === +v[2] && cur.d === +v[3]) { mark(c, '表と同じ日付', row); continue; }
        const other = Object.keys(o).find(r => r !== k && +o[r] === d);
        if (other) { mark(c, '別の欄の日付', row, `${other}と同じ`); continue; }
      } else if (c.code === '会話_工程' && c.val === '出荷済' && E && E - t > 30 * D && stage < 3) { mark(c, 'まだ出荷できない段階', row, `納品 ${md(E)}`); continue; }
      mark(c, 'ok');
    } else if (c.kind === 'smell') {
      if (c.x && c.x.resolved) { mark(c, '片付いている', row); continue; }
      if (kk && !(c.x && c.x.post)) { mark(c, '納品済みの商品', row); continue; }
      const left = E ? Math.round((E - t) / D) : null, m1 = c.risk.match(/納品まで(\d+)日/), m2 = c.risk.match(/あと(\d+)日/), m3 = c.risk.match(/を(\d+)日過ぎ/);
      const said = m1 ? +m1[1] : m2 ? +m2[1] : m3 ? -m3[1] : null;
      if (said != null && left == null) { mark(c, '?'); continue; }
      if (said != null && Math.abs(said - left) > 3) { mark(c, '別の商品の納品日', row, `本当は ${md(E)}(${left < 0 ? -left + '日前' : 'あと' + left + '日'})`); continue; }
      if (c.danger === '高' && left != null && left > (c.x && c.x.fmax || 14) + 30) { mark(c, '危なさが高すぎ', row, `納品 ${md(E)}`); continue; }
      if (/止まらない見込み/.test(c.risk)) { mark(c, '言い方が分からない', row); continue; }
      mark(c, 'ok');
    } else mark(c, '?');
  }
  res.autoOff = J.autoOff; res.skipped = J.skipped;
  res.stOpen = Object.entries(res.stOpen).sort((a, b) => b[1] - a[1]).slice(0, 25);
  return res;
}
