from pathlib import Path
p = Path('output/App.jsx')
content = r'''import { useState, useEffect, useMemo } from 'react'
import { db } from './firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore'

const CO = {
  name: 'Bärenstarker Transport GmbH',
  addr: 'Fürtiring 16a · 6018 Buttisholz',
  contact: 'Zef Mirakaj',
  title: 'Geschäftsführer',
  email: 'baeren_stark@hotmail.com',
  phone: '075 558 33 33',
  uid: 'CHE-459.842.475 MwSt.',
  svcs: ['Transporte', 'Umzüge', 'Räumungen', 'Montagen', 'Reinigungen', 'Entsorgungen'],
}

const LEISTUNGEN = ['Transport', 'Umzug', 'Räumung', 'Entsorgung', 'Montage', 'Reinigung', 'Sonstiges']
const DOC_TYPEN = ['Rechnung', 'Auftragsbestätigung', 'Offerte']
const ANREDEN = ['Herr', 'Frau', 'Firma']
const ZAHLARTEN = ['Barzahlung', 'Kartenzahlung', 'Twint', 'Überweisung']
const VAT = 0.081
const STUECK_LEISTUNGEN = ['Sonstiges']

function genNr(type) {
  const y = new Date().getFullYear()
  const p = type === 'Rechnung' ? 'RE' : type === 'Auftragsbestätigung' ? 'AB' : 'OF'
  return `${p}-${y}-${String(Math.floor(Math.random() * 900) + 100)}`
}
const heute = () => new Date().toISOString().split('T')[0]
const fmtD = s => { try { return new Date(s).toLocaleDateString('de-CH') } catch { return s } }
const fmtCHF = n => `CHF ${Number(n).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const emptyPos = () => ({ id: Date.now() + Math.random(), leistung: 'Transport', beschreibung: '', stunden: 2, ansatz: 80 })
const monthKey = s => (s ? s.slice(0, 7) : '')
const monthLabel = m => {
  if (!m) return ''
  const [y, mm] = m.split('-')
  const names = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
  return `${names[Number(mm) - 1]} ${y}`
}

function buildPrintHtml(inv) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8"/>
  <title>${inv.docTyp} ${inv.nr} – ${inv.kunde.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #222; background: white; padding: 32px; max-width: 800px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1a2744; color: white; padding: 8px 10px; font-size: 12px; font-weight: 500; text-align: left; }
    td { padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    .right { text-align: right; }
    .green-box { background: #dcfce7; border: 2px solid #16a34a; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .agb { font-size: 11px; color: #666; line-height: 1.7; border-top: 1px solid #ddd; padding-top: 14px; margin-top: 20px; }
    .top-actions { display:flex; gap:10px; flex-wrap:wrap; background:#f4f5f7; border:1px solid #e2e5ec; border-radius:10px; padding:12px; margin-bottom:16px; }
    .top-actions a, .top-actions button { border:none; border-radius:6px; padding:10px 14px; font-size:14px; font-weight:700; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:8px; }
    .btn-print { background:#1a2744; color:#fff; }
    .btn-email { background:#0ea5e9; color:#fff; }
    .btn-wa { background:#16a34a; color:#fff; }
    .btn-close { background:#e5e7eb; color:#111827; margin-left:auto; }
    @media print { body { padding: 0; } .top-actions { display:none !important; } }
  </style>
</head>
<body>
  <div class="top-actions no-print">
    <button class="btn-print" id="btnPrint">🖨️ Print</button>
    <a class="btn-email" href="mailto:${encodeURIComponent(inv.kunde.email || '')}?subject=${encodeURIComponent(inv.docTyp + ' ' + inv.nr)}&body=${encodeURIComponent('Guten Tag,%0A%0Aanbei finden Sie die ' + inv.docTyp + ' ' + inv.nr + '.%0A%0AMit freundlichen Grüssen%0A' + CO.contact + '%0A' + CO.phone)}">📧 Email</a>
    <a class="btn-wa" href="https://wa.me/?text=${encodeURIComponent('Guten Tag,%0A%0Ahier ist Ihre ' + inv.docTyp + ' ' + inv.nr + '.%0A%0AMit freundlichen Grüssen%0A' + CO.contact + '%0A' + CO.phone)}" target="_blank" rel="noopener noreferrer">📱 WhatsApp</a>
    <button class="btn-close" id="btnClose">✕ Close</button>
  </div>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a2744;padding-bottom:16px;margin-bottom:24px;">
      <div>
        <img src="${window.location.origin}/logo_full.png" alt="Bärenstarker Transport GmbH" style="height:65px;width:auto;margin-bottom:6px;" />
        <p style="font-size:11px;color:#666;">●Transporte ·●Umzüge ·●Räumungen ·●Montagen ·●Reinigungen ·●Entsorgungen</p>
      </div>
      <div style="text-align:right;font-size:11.5px;color:#555;line-height:1.9;">
        <p style="font-weight:700;color:#1a2744;">${CO.name}</p>
        <p>${CO.addr}</p>
        <p>Tel. ${CO.phone}</p>
        <p>${CO.email}</p>
        <p>UID: ${CO.uid}</p>
      </div>
    </div>

    ${inv.zahlstatus === 'Bezahlt' ? `
    <div class="green-box">
      <p style="font-weight:800;font-size:16px;color:#16a34a;">✅ BETRAG DANKEND ERHALTEN</p>
      <p style="font-size:12px;color:#166534;margin-top:4px;">Zahlungsart: ${inv.zahlart} · ${fmtD(inv.datum)}</p>
    </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
      <div style="font-size:12px;color:#555;line-height:2;">
        <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">Datum:</span><span>${fmtD(inv.datum)}</span></div>
        <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">Ansprechpartner:</span><span>${CO.contact}</span></div>
        <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">E-Mail:</span><span>${CO.email}</span></div>
        <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">Telefon:</span><span>${CO.phone}</span></div>
        <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">Nummer:</span><span>${inv.nr}</span></div>
      </div>
      <div style="font-size:13px;line-height:1.9;">
        <p style="color:#888;font-size:12px;">${inv.anrede}</p>
        <p style="font-weight:700;font-size:15px;">${inv.kunde.name}</p>
        ${inv.kunde.strasse ? `<p>${inv.kunde.strasse}</p>` : ''}
        ${(inv.kunde.plz || inv.kunde.ort) ? `<p>${inv.kunde.plz} ${inv.kunde.ort}</p>` : ''}
      </div>
    </div>

    <p style="font-weight:800;font-size:16px;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:14px;">${inv.docTyp}${inv.zahlstatus === 'Bezahlt' ? ' / Quittung' : ''}</p>
    <p style="font-size:13px;margin-bottom:20px;line-height:1.7;">Sehr geehrte${inv.anrede === 'Herr' ? 'r' : ''} ${inv.anrede !== 'Firma' ? inv.anrede + ' ' : ''}${inv.kunde.name},<br/>vielen Dank für Ihr Vertrauen. Wir freuen uns, den Auftrag ausgeführt zu haben.</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:13px;">
      <thead>
        <tr style="background:#1a2744;color:white;">
          <th style="padding:8px 10px;text-align:left;width:40px;">Pos</th>
          <th style="padding:8px 10px;text-align:left;">Bezeichnung</th>
          <th style="padding:8px 10px;text-align:right;width:60px;">Std.</th>
          <th style="padding:8px 10px;text-align:right;width:90px;">CHF/h</th>
          <th style="padding:8px 10px;text-align:right;width:120px;">Positionspreis</th>
        </tr>
      </thead>
      <tbody>
        ${inv.positionen.map((pos, idx) => `
          <tr style="border-bottom:1px solid #eee;background:${idx % 2 === 0 ? '#fafafa' : 'white'};">
            <td style="padding:8px 10px;color:#888;">${idx + 1}</td>
            <td style="padding:8px 10px;"><strong>${pos.leistung}</strong>${pos.beschreibung ? ' – ' + pos.beschreibung : ''}</td>
            <td style="padding:8px 10px;text-align:right;">${pos.stunden} h</td>
            <td style="padding:8px 10px;text-align:right;">${Number(pos.ansatz).toFixed(2)}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;">CHF ${(Number(pos.stunden) * Number(pos.ansatz)).toLocaleString('de-CH', {minimumFractionDigits:2})}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <p style="font-size:11.5px;color:#666;margin-bottom:20px;">Alle Preise inkl. 8.1% MwSt. in CHF.</p>

    <div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
      <div style="min-width:280px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;"><span style="color:#555;">Nettobetrag (exkl. MwSt.)</span><span>${fmtCHF(inv.netto)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;"><span style="color:#555;">MwSt. 8.1 %</span><span>${fmtCHF(inv.mwst)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:800;font-size:16px;color:#1a2744;border-top:2px solid #1a2744;margin-top:4px;"><span>Gesamtbetrag</span><span>${fmtCHF(inv.brutto)}</span></div>
        ${inv.zahlstatus === 'Bezahlt' ? `<div style="background:#dcfce7;border-radius:6px;padding:8px 12px;text-align:center;font-weight:700;color:#16a34a;font-size:13px;margin-top:8px;">✓ Betrag dankend erhalten — ${inv.zahlart}</div>` : ''}
      </div>
    </div>

    <div class="agb">
      <p style="font-weight:700;text-decoration:underline;margin-bottom:8px;color:#333;">Allgemein</p>
      <div style="display:grid;grid-template-columns:160px 1fr;gap:2px 12px;">
        <span style="font-weight:600;">Zahlungskonditionen:</span>
        <span>Barzahlung vor Ort nach Erledigung des Auftrags. Alle Preise zzgl. MwSt. 8.1%</span>
        <span style="font-weight:600;">Im Preis inbegriffen:</span>
        <span>Betriebshaftpflichtversicherung (CHF 5'000'000.–), Transportversicherung (CHF 50'000.–), keine Benzin- oder Kilometerkosten, keine LSVA</span>
        <span style="font-weight:600;">Vertragsrücktritt:</span>
        <span>30% ab 48h · 60% ab 14 Tage · 100% ab 7 Tage vor geplantem Einsatz</span>
      </div>
    </div>

    <div style="margin-top:28px;font-size:12px;color:#555;">
      <p>Für Rückfragen steht Ihnen ${CO.contact} unter ${CO.phone} gerne zur Verfügung.</p>
      <p style="margin:14px 0 32px;">Wir bedanken uns für den Auftrag und freuen uns auf die weitere Zusammenarbeit.</p>
      <p>Freundliche Grüsse</p>
      <p style="margin-top:24px;font-weight:700;font-size:13px;color:#1a2744;margin-bottom:2px;">${CO.contact}</p>
      <p style="margin:0;">${CO.title}</p>
      <p style="margin:0;font-style:italic;">${CO.name}</p>
    </div>
  </div>

  <script>
    document.getElementById('btnPrint').addEventListener('click', () => window.print())
    document.getElementById('btnClose').addEventListener('click', () => window.close())
  </script>
</body>
</html>`
}

function buildMonthlySummaryHtml({ label, total, offen, bezahlt, methods }) {
  const methodRows = Object.entries(methods || {}).map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;"><span>${k}</span><span>${fmtCHF(v)}</span></div>`).join('') || '<p style="color:#9ca3af;">Ni podatkov za metode.</p>'
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Monatsbilanz ${label}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin:0; font-family: Arial, sans-serif; background:#f4f5f7; color:#111827; }
    .bar { display:flex; gap:10px; flex-wrap:wrap; padding:12px; background:#f4f5f7; border-bottom:1px solid #e2e5ec; }
    .bar button, .bar a { border:none; border-radius:6px; padding:10px 14px; font-weight:700; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:8px; }
    .btn-print { background:#1a2744; color:#fff; }
    .btn-email { background:#0ea5e9; color:#fff; }
    .btn-wa { background:#16a34a; color:#fff; }
    .btn-close { background:#e5e7eb; color:#111827; margin-left:auto; }
    .sheet { max-width: 900px; margin: 16px auto; background:#fff; border:1px solid #e2e5ec; border-radius:10px; padding:32px; }
    .cards { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:16px; }
    .card { border:1px solid #e2e5ec; border-radius:10px; padding:16px; background:#fafafa; }
    .title { font-size:20px; font-weight:800; color:#1a2744; margin-bottom:10px; }
    @media print { body { background:#fff; } .bar { display:none !important; } .sheet { border:none; margin:0; border-radius:0; } }
  </style>
</head>
<body>
  <div class="bar no-print">
    <button class="btn-print" id="btnPrint">🖨️ Print</button>
    <a class="btn-email" href="mailto:?subject=${encodeURIComponent('Monatsbilanz ' + label)}&body=${encodeURIComponent('Guten Tag,%0A%0Aanbei die Monatsbilanz ' + label + '.%0A%0ATotal: ' + fmtCHF(total) + '%0ABezahlt: ' + fmtCHF(bezahlt) + '%0AOffen: ' + fmtCHF(offen) + '%0A%0AMit freundlichen Grüssen%0A' + CO.contact + '%0A' + CO.phone)}">📧 Email</a>
    <a class="btn-wa" href="https://wa.me/?text=${encodeURIComponent('Guten Tag,%0A%0Aanbei die Monatsbilanz ' + label + '.%0A%0ATotal: ' + fmtCHF(total) + '%0ABezahlt: ' + fmtCHF(bezahlt) + '%0AOffen: ' + fmtCHF(offen) + '%0A%0AMit freundlichen Grüssen%0A' + CO.contact + '%0A' + CO.phone)}" target="_blank" rel="noopener noreferrer">📱 WhatsApp</a>
    <button class="btn-close" id="btnClose">✕ Close</button>
  </div>
  <div class="sheet">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a2744;padding-bottom:16px;margin-bottom:20px;">
      <div>
        <img src="${window.location.origin}/logo_full.png" alt="Bärenstarker Transport GmbH" style="height:60px;width:auto;margin-bottom:6px;" />
        <p style="font-size:11px;color:#666;">●Transporte ·●Umzüge ·●Räumungen ·●Montagen ·●Reinigungen ·●Entsorgungen</p>
      </div>
      <div style="text-align:right;font-size:11.5px;color:#555;line-height:1.8;">
        <p style="font-weight:700;color:#1a2744;">${CO.name}</p>
        <p>${CO.addr}</p>
        <p>Tel. ${CO.phone}</p>
        <p>${CO.email}</p>
      </div>
    </div>

    <div class="title">Monatsbilanz ${label}</div>
    <div class="cards">
      <div class="card"><div style="color:#6b7280;font-size:12px;">Total</div><div style="font-size:20px;font-weight:800;color:#1a2744;">${fmtCHF(total)}</div></div>
      <div class="card"><div style="color:#6b7280;font-size:12px;">Bezahlt</div><div style="font-size:20px;font-weight:800;color:#16a34a;">${fmtCHF(bezahlt)}</div></div>
      <div class="card"><div style="color:#6b7280;font-size:12px;">Offen</div><div style="font-size:20px;font-weight:800;color:#d97706;">${fmtCHF(offen)}</div></div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700; margin-bottom:8px; color:#1a2744;">Zahlungsarten</div>
      ${methodRows}
    </div>

    <div style="font-size:12px;color:#6b7280;line-height:1.7;">
      <p>Diese Monatsbilanz wurde aus den in der App gespeicherten Rechnungen erstellt.</p>
      <p>Für Rückfragen steht Ihnen ${CO.contact} unter ${CO.phone} gerne zur Verfügung.</p>
    </div>
  </div>
  <script>
    document.getElementById('btnPrint').addEventListener('click', () => window.print())
    document.getElementById('btnClose').addEventListener('click', () => window.close())
  </script>
</body>
</html>`
}

function RechnungForm({ initial, onSave, onCancel }) {
  const [docTyp, setDocTyp] = useState(initial?.docTyp || 'Rechnung')
  const [nr, setNr] = useState(initial?.nr || genNr('Rechnung'))
  const [datum, setDatum] = useState(initial?.datum || heute())
  const [anrede, setAnrede] = useState(initial?.anrede || 'Herr')
  const [kunde, setKunde] = useState(initial?.kunde || { name: '', strasse: '', plz: '', ort: '' })
  const [positionen, setPositionen] = useState(initial?.positionen || [emptyPos()])
  const [zahlstatus, setZahlstatus] = useState(initial?.zahlstatus || 'Offen')
  const [zahlart, setZahlart] = useState(initial?.zahlart || 'Barzahlung')

  const uck = (f, v) => setKunde(c => ({ ...c, [f]: v }))
  const ucp = (id, f, v) => setPositionen(p => p.map(i => i.id === id ? { ...i, [f]: v } : i))
  const addPos = () => setPositionen(p => [...p, emptyPos()])
  const delPos = id => setPositionen(p => p.length > 1 ? p.filter(i => i.id !== id) : p)
  const chgTyp = t => { setDocTyp(t); setNr(genNr(t)) }

  const netto = positionen.reduce((s, p) => s + Number(p.stunden) * Number(p.ansatz), 0)
  const mwst = netto * VAT
  const brutto = netto + mwst

  const isStueck = pos => STUECK_LEISTUNGEN.includes(pos.leistung)
  const qtyLabel = pos => isStueck(pos) ? 'Stück / Menge' : 'Stunden'
  const rateLabel = pos => isStueck(pos) ? 'CHF / Stück' : 'CHF / Stunde'
  const qtyPlaceholder = pos => isStueck(pos) ? 'z.B. 3' : 'z.B. 2.5'
  const qtyStep = pos => isStueck(pos) ? '1' : '0.5'

  const handleLeistungChange = (id, value) => {
    const pos = positionen.find(p => p.id === id)
    const newStunden = value === 'Sonstiges' ? 1 : (pos?.stunden ?? 2)
    setPositionen(p => p.map(i => i.id === id ? { ...i, leistung: value, stunden: newStunden } : i))
  }

  const handleSave = () => {
    if (!kunde.name.trim()) { alert('Bitte Kundenname eingeben.'); return }
    onSave({
      id: initial?.id || Date.now(),
      docTyp, nr, datum, anrede, kunde, positionen, zahlstatus, zahlart, netto, mwst, brutto,
      createdAt: initial?.createdAt || new Date().toISOString()
    })
  }

  return <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 0 40px' }}>{/* same form as before */}
    <div className="card"><p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 14 }}>Dokumentdetails</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }} className="grid-3">
        <div><label>Dokumenttyp</label><select value={docTyp} onChange={e => chgTyp(e.target.value)}>{DOC_TYPEN.map(d => <option key={d}>{d}</option>)}</select></div>
        <div><label>Nummer</label><input value={nr} onChange={e => setNr(e.target.value)} /></div>
        <div><label>Datum</label><input type="date" value={datum} onChange={e => setDatum(e.target.value)} /></div>
      </div>
    </div>

    <div className="card"><p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 14 }}>Kunde / Empfänger</p>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 12 }}>
        <div><label>Anrede</label><select value={anrede} onChange={e => setAnrede(e.target.value)}>{ANREDEN.map(a => <option key={a}>{a}</option>)}</select></div>
        <div><label>Name / Firma</label><input placeholder="Vorname Nachname" value={kunde.name} onChange={e => uck('name', e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}><div><label>Strasse & Nr.</label><input placeholder="Strasse & Nr." value={kunde.strasse} onChange={e => uck('strasse', e.target.value)} /></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
        <div><label>PLZ</label><input placeholder="PLZ" value={kunde.plz} onChange={e => uck('plz', e.target.value)} /></div>
        <div><label>Ort</label><input placeholder="Ort" value={kunde.ort} onChange={e => uck('ort', e.target.value)} /></div>
      </div>
    </div>

    <div className="card"><p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 14 }}>Positionen</p>
      {positionen.map((pos, idx) => <div key={pos.id} style={{ background: '#f8f9fc', borderRadius: 8, padding: 14, marginBottom: 10, border: '1px solid #e8ebf0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><span style={{ fontSize: 12, fontWeight: 600, color: '#1a2744' }}>Position {idx + 1}</span><button className="btn-danger" onClick={() => delPos(pos.id)} title="Entfernen">✕</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, marginBottom: 10 }}>
          <div><label>Leistungsart</label><select value={pos.leistung} onChange={e => handleLeistungChange(pos.id, e.target.value)}>{LEISTUNGEN.map(l => <option key={l}>{l}</option>)}</select></div>
          <div><label>{pos.leistung === 'Sonstiges' ? 'Beschreibung (Pflicht)' : 'Beschreibung (optional)'}</label><input placeholder={pos.leistung === 'Sonstiges' ? 'Was wurde gemacht?' : 'z.B. 2 Schränke, 3. OG ohne Lift…'} value={pos.beschreibung} onChange={e => ucp(pos.id, 'beschreibung', e.target.value)} style={{ borderColor: pos.leistung === 'Sonstiges' && !pos.beschreibung ? '#dc2626' : undefined }} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div><label>{qtyLabel(pos)}</label><input type="number" min="0.5" step={qtyStep(pos)} value={pos.stunden} onChange={e => ucp(pos.id, 'stunden', e.target.value)} placeholder={qtyPlaceholder(pos)} style={{ textAlign: 'right' }} /></div>
          <div><label>{rateLabel(pos)}</label><input type="number" min="0" step="5" value={pos.ansatz} onChange={e => ucp(pos.id, 'ansatz', e.target.value)} style={{ textAlign: 'right' }} /></div>
          <div><label>Positionspreis</label><div style={{ padding: '9px 12px', background: 'white', border: '1px solid #e2e5ec', borderRadius: 6, fontWeight: 700, textAlign: 'right', fontSize: 14, color: '#1a2744' }}>{fmtCHF(Number(pos.stunden) * Number(pos.ansatz))}</div></div>
        </div>
      </div>)}
      <button onClick={addPos} style={{ marginTop: 4, border: '1px dashed #c8a84b', color: '#c8a84b', background: 'transparent', width: '100%', padding: 10 }}>+ Position hinzufügen</button>
    </div>

    <div className="card"><p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 14 }}>Zahlungsdetails</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label>Zahlungsstatus</label><select value={zahlstatus} onChange={e => setZahlstatus(e.target.value)} style={{ borderColor: zahlstatus === 'Bezahlt' ? '#16a34a' : '#d97706', color: zahlstatus === 'Bezahlt' ? '#16a34a' : '#d97706', fontWeight: 600 }}><option value="Offen">🟡 Offen</option><option value="Bezahlt">🟢 Bezahlt</option></select></div>
        <div><label>Zahlungsart</label><select value={zahlart} onChange={e => setZahlart(e.target.value)} disabled={zahlstatus === 'Offen'} style={{ opacity: zahlstatus === 'Offen' ? 0.5 : 1 }}>{ZAHLARTEN.map(z => <option key={z}>{z}</option>)}</select></div>
      </div>
      {zahlstatus === 'Bezahlt' && <div style={{ marginTop: 12, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✓ Das PDF wird als Quittung mit «Betrag dankend erhalten» ausgestellt.</div>}
    </div>

    <div className="card" style={{ maxWidth: 300, marginLeft: 'auto' }}>
      {[['Nettobetrag', netto], ['MwSt. 8.1 %', mwst]].map(([l, a]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#6b7280' }}><span>{l}</span><span style={{ color: '#1a2744' }}>{fmtCHF(a)}</span></div>)}
      <div style={{ borderTop: '2px solid #1a2744', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, color: '#1a2744' }}><span>Gesamtbetrag</span><span>{fmtCHF(brutto)}</span></div>
    </div>

    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}><button onClick={onCancel} style={{ padding: '10px 20px' }}>Abbrechen</button><button className="btn-primary" onClick={handleSave}>{initial ? 'Aktualisieren' : 'Speichern'}</button></div>
  </div>
}

function Uebersicht({ rechnungen, onEdit, onDelete, onNeu, onPrint, onPrintBilanz }) {
  const [filter, setFilter] = useState('Alle')
  const [filterMonat, setFilterMonat] = useState('Alle')

  const offen = rechnungen.filter(r => r.zahlstatus === 'Offen')
  const bezahlt = rechnungen.filter(r => r.zahlstatus === 'Bezahlt')
  const totalOffen = offen.reduce((s, r) => s + r.brutto, 0)
  const totalBezahlt = bezahlt.reduce((s, r) => s + r.brutto, 0)
  const monate = Array.from(new Set(rechnungen.map(r => monthKey(r.datum)).filter(Boolean))).sort((a, b) => b.localeCompare(a))
  const byStatus = filter === 'Alle' ? rechnungen : rechnungen.filter(r => r.zahlstatus === filter)
  const filtered = filterMonat === 'Alle' ? byStatus : byStatus.filter(r => monthKey(r.datum) === filterMonat)
  const selectedMonth = filterMonat !== 'Alle' ? filterMonat : (monate[0] || null)

  const selectedSummary = useMemo(() => {
    if (!selectedMonth) return null
    const monthRows = rechnungen.filter(r => monthKey(r.datum) === selectedMonth)
    const total = monthRows.reduce((s, r) => s + (Number(r.brutto) || 0), 0)
    const paid = monthRows.filter(r => r.zahlstatus === 'Bezahlt').reduce((s, r) => s + (Number(r.brutto) || 0), 0)
    const offenM = monthRows.filter(r => r.zahlstatus === 'Offen').reduce((s, r) => s + (Number(r.brutto) || 0), 0)
    const methods = monthRows.filter(r => r.zahlstatus === 'Bezahlt').reduce((acc, r) => {
      acc[r.zahlart] = (acc[r.zahlart] || 0) + (Number(r.brutto) || 0)
      return acc
    }, {})
    return { label: monthLabel(selectedMonth), total, paid, offen: offenM, methods }
  }, [rechnungen, selectedMonth])

  const shareSummary = (type) => {
    if (!selectedSummary) return
    if (type === 'print') {
      const w = window.open('', '_blank')
      w.document.write(buildMonthlySummaryHtml(selectedSummary))
      w.document.close()
      return
    }
    if (type === 'email') {
      const subject = encodeURIComponent(`Monatsbilanz ${selectedSummary.label}`)
      const body = encodeURIComponent(`Guten Tag,\n\nanbei die Monatsbilanz ${selectedSummary.label}.\n\nTotal: ${fmtCHF(selectedSummary.total)}\nBezahlt: ${fmtCHF(selectedSummary.paid)}\nOffen: ${fmtCHF(selectedSummary.offen)}\n\nMit freundlichen Grüssen\n${CO.contact}\n${CO.phone}`)
      window.location.href = `mailto:?subject=${subject}&body=${body}`
      return
    }
    if (type === 'whatsapp') {
      const text = encodeURIComponent(`Guten Tag,%0A%0Aanbei die Monatsbilanz ${selectedSummary.label}.%0A%0ATotal: ${fmtCHF(selectedSummary.total)}%0ABezahlt: ${fmtCHF(selectedSummary.paid)}%0AOffen: ${fmtCHF(selectedSummary.offen)}%0A%0AMit freundlichen Grüssen%0A${CO.contact}%0A${CO.phone}`)
      window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        {[
          ['Alle Dokumente', rechnungen.length, '#1a2744', '📄'],
          ['Offen', `${offen.length} · ${fmtCHF(totalOffen)}`, '#d97706', '🟡'],
          ['Bezahlt', `${bezahlt.length} · ${fmtCHF(totalBezahlt)}`, '#16a34a', '🟢'],
        ].map(([label, val, color, icon]) => <div key={label} className="card" style={{ textAlign: 'center', padding: 16 }}><div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div><p style={{ margin: 0, fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p><p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color }}>{val}</p></div>)
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['Alle', 'Offen', 'Bezahlt'].map(f => <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? '#1a2744' : 'white', color: filter === f ? 'white' : '#1a2744', border: '1px solid #1a2744', fontWeight: 500, padding: '7px 16px', fontSize: 13 }}>{f}</button>)}</div>
        <button className="btn-primary" onClick={onNeu} style={{ padding: '9px 20px', fontSize: 14 }}>+ Neue Rechnung</button>
      </div>

      <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <div style={{ minWidth: 240 }}>
          <label>Monat filtern</label>
          <select value={filterMonat} onChange={e => setFilterMonat(e.target.value)}>
            <option value="Alle">Alle Monate</option>
            {monate.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
        {selectedSummary && <div className="card" style={{ margin: 0, padding: 14, flex: 1, minWidth: 260 }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#1a2744' }}>Monatsbilanz: {selectedSummary.label}</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>Total: {fmtCHF(selectedSummary.total)} · Bezahlt: {fmtCHF(selectedSummary.paid)} · Offen: {fmtCHF(selectedSummary.offen)}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{Object.entries(selectedSummary.methods).map(([m, sum]) => <div key={m} style={{ background: '#f8f9fc', border: '1px solid #e2e5ec', borderRadius: 8, padding: '8px 10px', minWidth: 120 }}><p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{m}</p><p style={{ margin: '2px 0 0', fontWeight: 700, color: '#1a2744' }}>{fmtCHF(sum)}</p></div>)}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => shareSummary('print')}>🖨️ Monatsbilanz PDF / Print</button>
            <button className="btn-primary" onClick={() => shareSummary('email')} style={{ background: '#0ea5e9' }}>📧 Monatsbilanz Email</button>
            <button className="btn-primary" onClick={() => shareSummary('whatsapp')} style={{ background: '#16a34a' }}>📱 Monatsbilanz WhatsApp</button>
          </div>
        </div>}
      </div>

      {filtered.length === 0 ? <div className="card" style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}><p style={{ fontSize: 40, marginBottom: 10 }}>📭</p><p style={{ fontWeight: 600 }}>Keine Dokumente gefunden</p><p style={{ fontSize: 13, marginTop: 4 }}>Klicken Sie auf «Neue Rechnung» um zu beginnen.</p></div> : filtered.map(inv => <div key={inv.firestoreId} className="card" style={{ marginBottom: 10, padding: '14px 18px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}><div style={{ flex: 1, minWidth: 180 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span style={{ fontWeight: 700, fontSize: 14 }}>{inv.kunde.name || '—'}</span><span className={`badge badge-${inv.zahlstatus === 'Bezahlt' ? 'paid' : 'open'}`}>{inv.zahlstatus === 'Bezahlt' ? '✓ Bezahlt' : '● Offen'}</span></div><p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{inv.nr} · {fmtD(inv.datum)} · {inv.docTyp}{inv.zahlstatus === 'Bezahlt' && <span style={{ marginLeft: 6, color: '#16a34a' }}>· {inv.zahlart}</span>}</p><p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>{inv.positionen.map(p => p.leistung).join(', ')}</p></div><div style={{ textAlign: 'right' }}><p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#1a2744' }}>{fmtCHF(inv.brutto)}</p><p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>inkl. MwSt.</p></div><div style={{ display: 'flex', gap: 6 }}><button onClick={() => onPrint(inv)} title="Drucken / PDF" style={{ padding: '7px 12px', fontSize: 13 }}>🖨️</button><button onClick={() => onEdit(inv)} title="Bearbeiten" style={{ padding: '7px 12px', fontSize: 13 }}>✏️</button><button className="btn-danger" onClick={() => onDelete(inv)} title="Löschen" style={{ padding: '7px 12px', fontSize: 13 }}>🗑️</button></div></div></div>)}
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState('overview')
  const [rechnungen, setRechnungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [editInv, setEditInv] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'rechnungen'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setRechnungen(snap.docs.map(d => ({ ...d.data(), firestoreId: d.id })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [])

  const handleSave = async inv => {
    try {
      if (inv.firestoreId) {
        const ref = doc(db, 'rechnungen', inv.firestoreId)
        const { firestoreId, ...data } = inv
        await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() })
      } else {
        await addDoc(collection(db, 'rechnungen'), { ...inv, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      }
      setScreen('overview')
      setEditInv(null)
    } catch (e) {
      alert('Fehler beim Speichern: ' + e.message)
    }
  }

  const handleDelete = async firestoreId => {
    try {
      await deleteDoc(doc(db, 'rechnungen', firestoreId))
    } catch (e) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  const handlePrint = inv => {
    const w = window.open('', '_blank', 'width=1200,height=900')
    w.document.write(buildPrintHtml(inv))
    w.document.close()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f7' }}>
      <div id="app-shell">
        <header style={{ background: '#1a2744', color: 'white', padding: '0 20px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo.png" alt="Bärenstarker Transport GmbH" style={{ height: 36, width: 'auto', flexShrink: 0, filter: 'brightness(0) invert(1)' }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Bärenstarker Transport</p>
              <p style={{ margin: 0, fontSize: 11, opacity: 0.65 }}>Rechnungs-Manager</p>
            </div>
            {screen !== 'overview' && <button onClick={() => { setScreen('overview'); setEditInv(null) }} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', padding: '7px 14px', fontSize: 13 }}>← Übersicht</button>}
          </div>
        </header>

        <div style={{ background: 'white', borderBottom: '1px solid #e2e5ec', padding: '12px 20px' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a2744' }}>{screen === 'overview' && '📋 Übersicht'}{screen === 'new' && '+ Neue Rechnung'}{screen === 'edit' && '✏️ Rechnung bearbeiten'}</h1>
          </div>
        </div>

        <main style={{ padding: '20px 16px', maxWidth: 800, margin: '0 auto' }}>
          {loading ? <div style={{ textAlign: 'center', padding: 60 }}><div style={{ fontSize: 40, marginBottom: 16 }}>🔄</div><p style={{ color: '#6b7280', fontWeight: 500 }}>Daten werden geladen…</p></div> : screen === 'overview' ? <Uebersicht rechnungen={rechnungen} onEdit={inv => { setEditInv(inv); setScreen('edit') }} onDelete={inv => { if (window.confirm('Wirklich löschen?')) handleDelete(inv.firestoreId) }} onNeu={() => { setEditInv(null); setScreen('new') }} onPrint={handlePrint} /> : (screen === 'new' || screen === 'edit') ? <RechnungForm initial={editInv} onSave={handleSave} onCancel={() => { setScreen('overview'); setEditInv(null) }} /> : null}
        </main>
      </div>
    </div>
  )
}
'''
p.write_text(content, encoding='utf-8')
print(str(p))
