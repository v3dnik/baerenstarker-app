import { useState, useEffect, useMemo } from 'react'
import { db, auth } from './firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth'

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
const EINHEITEN = ['Stunde', 'Stück', 'kg']
const VAT = 0.081

function genNr(type) {
  const y = new Date().getFullYear()
  const p = type === 'Rechnung' ? 'RE' : type === 'Auftragsbestätigung' ? 'AB' : 'OF'
  return `${p}-${y}-${String(Math.floor(Math.random() * 900) + 100)}`
}

const heute = () => new Date().toISOString().split('T')[0]
const fmtD = s => { try { return new Date(s).toLocaleDateString('de-CH') } catch { return s } }
const fmtCHF = n => `CHF ${Number(n).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const emptyPos = () => ({ id: Date.now() + Math.random(), leistung: 'Transport', beschreibung: '', menge: 2, einheit: 'Stunde', preis: 80 })
const monthKey = s => (s ? s.slice(0, 7) : '')
const monthLabel = m => {
  if (!m) return ''
  const [y, mm] = m.split('-')
  const names = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
  return `${names[Number(mm) - 1]} ${y}`
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleLogin = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await setPersistence(auth, browserLocalPersistence)
      await signInWithEmailAndPassword(auth, email, password)
    } catch {
      setError('E-Mail oder Passwort falsch. Bitte nochmals versuchen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1e2d4f,#2f4b88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 28, padding: '40px 36px', width: '100%', maxWidth: 420, boxShadow: '0 40px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo_full.png" alt="Bärenstarker Transport GmbH" style={{ height: 60, width: 'auto', marginBottom: 16 }} onError={e => e.target.style.display='none'} />
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Rechnungs-Manager · Anmelden</p>
        </div>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label>E-Mail</label>
            <input type="email" placeholder="ihre@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={{ fontSize: 15 }} />
          </div>
          <div>
            <label>Passwort</label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={{ fontSize: 15, paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', padding: 4 }}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: 13, fontWeight: 500 }}>
              ⚠️ {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{ background: 'linear-gradient(135deg,#1e2d4f,#2f4b88)', color: 'white', border: 'none', borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? '⏳ Anmelden…' : '🔐 Anmelden'}
          </button>
        </form>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 20 }}>Zugang nur für autorisierte Mitarbeiter</p>
      </div>
    </div>
  )
}

function buildPrintHtml(inv) {
  const quittung = inv.zahlstatus === 'Bezahlt'
  const posTotal = pos => Number(pos.menge ?? pos.stunden ?? 0) * Number(pos.preis ?? pos.ansatz ?? 0)
  const einheitLabel = pos => pos.einheit || (pos.ansatz ? 'Stunde' : 'Stück')
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"/><title>${inv.docTyp} ${inv.nr}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;color:#222;background:white;padding:32px;max-width:860px;margin:0 auto}table{width:100%;border-collapse:collapse}th{background:#1a2744;color:white;padding:8px 10px;font-size:12px;font-weight:600;text-align:left}td{padding:8px 10px;font-size:13px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#fafafa}.right{text-align:right}.green-box{background:#dcfce7;border:2px solid #16a34a;border-radius:8px;padding:12px 16px;margin-bottom:20px}.toolbar{display:flex;gap:10px;flex-wrap:wrap;background:#f4f5f7;border:1px solid #e2e5ec;border-radius:10px;padding:12px;margin-bottom:16px}.toolbar button{border:none;border-radius:6px;padding:10px 14px;font-size:14px;font-weight:700;cursor:pointer}.btn-print{background:#1a2744;color:#fff}.btn-close{background:#e5e7eb;color:#111827;margin-left:auto}@media print{body{padding:0}.toolbar{display:none!important}}</style></head><body>
  <div class="toolbar"><button class="btn-print" id="btnPrint">🖨️ Print / PDF speichern</button><button class="btn-close" id="btnClose">✕ Schliessen</button></div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a2744;padding-bottom:16px;margin-bottom:24px;">
    <div><img src="${window.location.origin}/logo_full.png" alt="Logo" style="height:65px;width:auto;margin-bottom:6px;" onerror="this.style.display='none'"/><p style="font-size:11px;color:#666;">${CO.svcs.map((s,i)=>`${i>0?' · ':''}●${s}`).join('')}</p></div>
    <div style="text-align:right;font-size:11.5px;color:#555;line-height:1.9;"><p style="margin:0;font-weight:700;color:#1a2744;">${CO.name}</p><p style="margin:0;">${CO.addr}</p><p style="margin:0;">Tel. ${CO.phone}</p><p style="margin:0;">${CO.email}</p><p style="margin:0;">UID: ${CO.uid}</p></div>
  </div>
  ${quittung?`<div class="green-box"><p style="font-weight:800;font-size:16px;color:#16a34a;">✅ BETRAG DANKEND ERHALTEN</p><p style="font-size:12px;color:#166534;margin-top:4px;">Zahlungsart: ${inv.zahlart} · ${fmtD(inv.datum)}</p></div>`:''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
    <div style="font-size:12px;color:#555;line-height:2;">
      <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">Datum:</span><span>${fmtD(inv.datum)}</span></div>
      <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">Ansprechpartner:</span><span>${CO.contact}</span></div>
      <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">E-Mail:</span><span>${CO.email}</span></div>
      <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">Telefon:</span><span>${CO.phone}</span></div>
      <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">Nummer:</span><span>${inv.nr}</span></div>
    </div>
    <div style="font-size:13px;line-height:1.9;"><p style="color:#888;font-size:12px;">${inv.anrede}</p><p style="font-weight:700;font-size:15px;">${inv.kunde.name}</p>${inv.kunde.strasse?`<p>${inv.kunde.strasse}</p>`:''} ${(inv.kunde.plz||inv.kunde.ort)?`<p>${inv.kunde.plz} ${inv.kunde.ort}</p>`:''}</div>
  </div>
  <p style="font-weight:800;font-size:16px;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:14px;">${inv.docTyp}${quittung?' / Quittung':''}</p>
  <table style="margin-bottom:12px;">
    <thead><tr>
      <th style="width:40px;">Pos</th>
      <th>Bezeichnung</th>
      <th class="right" style="width:70px;">Menge</th>
      <th class="right" style="width:70px;">Einheit</th>
      <th class="right" style="width:100px;">Preis/Einh.</th>
      <th class="right" style="width:120px;">Positionspreis</th>
    </tr></thead>
    <tbody>
    ${inv.positionen.map((pos,idx)=>`<tr><td style="color:#888;">${idx+1}</td><td><strong>${pos.leistung}</strong>${pos.beschreibung?' – '+pos.beschreibung:''}</td><td class="right">${pos.menge??pos.stunden??0}</td><td class="right">${einheitLabel(pos)}</td><td class="right">CHF ${Number(pos.preis??pos.ansatz??0).toFixed(2)}</td><td class="right" style="font-weight:700;">${fmtCHF(posTotal(pos))}</td></tr>`).join('')}
    </tbody>
  </table>
  <p style="font-size:11.5px;color:#666;margin-bottom:20px;">Alle Preise inkl. 8.1% MwSt. in CHF.</p>
  <div style="display:flex;justify-content:flex-end;margin-bottom:24px;"><div style="min-width:280px;font-size:13px;">
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;"><span style="color:#555;">Nettobetrag (exkl. MwSt.)</span><span>${fmtCHF(inv.netto)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;"><span style="color:#555;">MwSt. 8.1 %</span><span>${fmtCHF(inv.mwst)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:800;font-size:16px;color:#1a2744;border-top:2px solid #1a2744;margin-top:4px;"><span>Gesamtbetrag</span><span>${fmtCHF(inv.brutto)}</span></div>
    ${quittung?`<div style="background:#dcfce7;border-radius:6px;padding:8px 12px;text-align:center;font-weight:700;color:#16a34a;font-size:13px;margin-top:8px;">✓ Betrag dankend erhalten — ${inv.zahlart}</div>`:''}
  </div></div>
  <p style="font-size:13px;color:#555;margin-top:8px;">Besten Dank für Ihren Auftrag.</p>

  <!-- FOOTER -->
  <div style="margin-top:40px;border-top:2px solid #1a2744;padding-top:16px;">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;font-size:11px;color:#555;line-height:1.9;">
      <div>
        <p style="font-weight:800;color:#1a2744;font-size:12px;margin-bottom:4px;">${CO.name}</p>
        <p style="margin:0;">${CO.addr}</p>
      </div>
      <div>
        <p style="font-weight:700;color:#1a2744;margin-bottom:4px;">Kontakt</p>
        <p style="margin:0;">Tel. ${CO.phone}</p>
        <p style="margin:0;">${CO.email}</p>
      </div>
      <div>
        <p style="font-weight:700;color:#1a2744;margin-bottom:4px;">Web</p>
        <p style="margin:0;">www.baerenstarker-transport.ch</p>
        <p style="margin:0;">UID: ${CO.uid}</p>
      </div>
    </div>
    <p style="text-align:center;margin-top:14px;font-size:11px;color:#9ca3af;font-style:italic;">Vielen Dank für Ihr Vertrauen — wir freuen uns auf die nächste Zusammenarbeit.</p>
  </div>

  <script>document.getElementById('btnPrint').addEventListener('click',()=>window.print());document.getElementById('btnClose').addEventListener('click',()=>window.close())</script>
</body></html>`
}

function buildMonthlySummaryHtml({ label, total, offen, bezahlt, methods }) {
  const rows = Object.entries(methods||{}).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef2f7;"><span>${k}</span><span>${fmtCHF(v)}</span></div>`).join('')||'<p style="color:#9ca3af;">Keine Zahlungsarten vorhanden.</p>'
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"/><title>Monatsbilanz ${label}</title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f4f5f7;color:#111827}.bar{display:flex;gap:10px;flex-wrap:wrap;padding:12px;background:#f4f5f7;border-bottom:1px solid #e2e5ec}.bar button{border:none;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}.btn-print{background:#1a2744;color:#fff}.btn-close{background:#e5e7eb;color:#111827;margin-left:auto}.sheet{max-width:920px;margin:16px auto;background:#fff;border:1px solid #e2e5ec;border-radius:14px;padding:28px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}.card{border:1px solid #e2e5ec;border-radius:12px;padding:16px;background:#fafafa}@media print{body{background:#fff}.bar{display:none!important}.sheet{border:none;margin:0;border-radius:0}}@media(max-width:800px){.cards{grid-template-columns:1fr}}</style></head><body>
  <div class="bar"><button class="btn-print" id="btnPrint">🖨️ Print / PDF speichern</button><button class="btn-close" id="btnClose">✕ Schliessen</button></div>
  <div class="sheet">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a2744;padding-bottom:16px;margin-bottom:20px;">
      <div><img src="/logo_full.png" alt="Logo" style="height:55px;width:auto;margin-bottom:6px;" onerror="this.style.display='none'"/><p style="font-size:11px;color:#666;">${CO.svcs.join(' · ')}</p></div>
      <div style="text-align:right;font-size:11.5px;color:#555;line-height:1.9;"><p style="margin:0;font-weight:700;color:#1a2744;">${CO.name}</p><p style="margin:0;">${CO.addr}</p><p style="margin:0;">Tel. ${CO.phone}</p><p style="margin:0;">${CO.email}</p></div>
    </div>
    <p style="font-size:22px;font-weight:800;color:#1a2744;margin-bottom:10px;">Monatsbilanz ${label}</p>
    <div class="cards">
      <div class="card"><div style="color:#6b7280;font-size:12px;">Total</div><div style="font-size:22px;font-weight:900;color:#1a2744;">${fmtCHF(total)}</div></div>
      <div class="card"><div style="color:#6b7280;font-size:12px;">Bezahlt</div><div style="font-size:22px;font-weight:900;color:#16a34a;">${fmtCHF(bezahlt)}</div></div>
      <div class="card"><div style="color:#6b7280;font-size:12px;">Offen</div><div style="font-size:22px;font-weight:900;color:#d97706;">${fmtCHF(offen)}</div></div>
    </div>
    <div class="card" style="margin-bottom:16px;"><div style="font-weight:700;margin-bottom:8px;color:#1a2744;">Zahlungsarten</div>${rows}</div>
  </div>
  <script>document.getElementById('btnPrint').addEventListener('click',()=>window.print());document.getElementById('btnClose').addEventListener('click',()=>window.close())</script>
</body></html>`
}

function RechnungForm({ initial, onSave, onCancel }) {
  const [docTyp, setDocTyp] = useState(initial?.docTyp || 'Rechnung')
  const [nr, setNr] = useState(initial?.nr || genNr('Rechnung'))
  const [datum, setDatum] = useState(initial?.datum || heute())
  const [anrede, setAnrede] = useState(initial?.anrede || 'Herr')
  const [kunde, setKunde] = useState(initial?.kunde || { name: '', strasse: '', plz: '', ort: '' })
  const [positionen, setPositionen] = useState(() => {
    if (initial?.positionen) {
      // Migrate old stunden/ansatz fields to menge/einheit/preis
      return initial.positionen.map(p => ({
        ...p,
        menge: p.menge ?? p.stunden ?? 1,
        einheit: p.einheit ?? 'Stunde',
        preis: p.preis ?? p.ansatz ?? 80,
      }))
    }
    return [emptyPos()]
  })
  const [zahlstatus, setZahlstatus] = useState(initial?.zahlstatus || 'Offen')
  const [zahlart, setZahlart] = useState(initial?.zahlart || 'Barzahlung')

  const uck = (f, v) => setKunde(c => ({ ...c, [f]: v }))
  const ucp = (id, f, v) => setPositionen(p => p.map(i => i.id === id ? { ...i, [f]: v } : i))
  const addPos = () => setPositionen(p => [...p, emptyPos()])
  const delPos = id => setPositionen(p => p.length > 1 ? p.filter(i => i.id !== id) : p)
  const chgTyp = t => { setDocTyp(t); setNr(genNr(t)) }

  const netto = positionen.reduce((s, p) => s + Number(p.menge) * Number(p.preis), 0)
  const mwst = netto * VAT
  const brutto = netto + mwst

  const handleSave = () => {
    if (!kunde.name.trim()) { alert('Bitte Kundenname eingeben.'); return }
    onSave({ id: initial?.id || Date.now(), docTyp, nr, datum, anrede, kunde, positionen, zahlstatus, zahlart, netto, mwst, brutto, createdAt: initial?.createdAt || new Date().toISOString() })
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 0 44px' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e2d4f,#2f4b88)', color: 'white', borderRadius: 24, padding: 22, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.12em', opacity: .75, fontWeight: 700 }}>Bärenstarker Transport</div>
            <h2 style={{ margin: '6px 0 0', fontSize: 24 }}>{initial ? 'Rechnung bearbeiten' : 'Neue Rechnung erstellen'}</h2>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={{ background: 'rgba(255,255,255,.12)', color: 'white', border: '1px solid rgba(255,255,255,.18)', padding: '10px 16px', borderRadius: 12 }}>Abbrechen</button>
            <button onClick={handleSave} style={{ background: '#f7c948', color: '#1e2d4f', padding: '10px 16px', borderRadius: 12, border: 'none', fontWeight: 800 }}>{initial ? 'Aktualisieren' : 'Speichern'}</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="card" style={{ borderRadius: 22 }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 14 }}>Dokumentdetails</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }} className="grid-3">
            <div><label>Dokumenttyp</label><select value={docTyp} onChange={e => chgTyp(e.target.value)}>{DOC_TYPEN.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label>Nummer</label><input value={nr} onChange={e => setNr(e.target.value)} /></div>
            <div><label>Datum</label><input type="date" value={datum} onChange={e => setDatum(e.target.value)} /></div>
          </div>
        </div>

        <div className="card" style={{ borderRadius: 22 }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 14 }}>Kunde / Empfänger</p>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, marginBottom: 12 }}>
            <div><label>Anrede</label><select value={anrede} onChange={e => setAnrede(e.target.value)}>{ANREDEN.map(a => <option key={a}>{a}</option>)}</select></div>
            <div><label>Name / Firma</label><input placeholder="Vorname Nachname" value={kunde.name} onChange={e => uck('name', e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><label>Strasse & Nr.</label><input placeholder="Strasse & Nr." value={kunde.strasse} onChange={e => uck('strasse', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
            <div><label>PLZ</label><input placeholder="PLZ" value={kunde.plz} onChange={e => uck('plz', e.target.value)} /></div>
            <div><label>Ort</label><input placeholder="Ort" value={kunde.ort} onChange={e => uck('ort', e.target.value)} /></div>
          </div>
        </div>

        <div className="card" style={{ borderRadius: 22 }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 14 }}>Positionen</p>
          {positionen.map((pos, idx) => (
            <div key={pos.id} style={{ background: '#f8fafc', borderRadius: 18, padding: 16, marginBottom: 12, border: '1px solid #e8edf3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2744' }}>Position {idx + 1}</span>
                <button className="btn-danger" onClick={() => delPos(pos.id)}>✕</button>
              </div>
              {/* Leistungsart + Beschreibung */}
              <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label>Leistungsart</label>
                  <select value={pos.leistung} onChange={e => ucp(pos.id, 'leistung', e.target.value)}>
                    {LEISTUNGEN.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label>{pos.leistung === 'Sonstiges' ? 'Beschreibung (Pflicht)' : 'Beschreibung (optional)'}</label>
                  <input
                    placeholder={pos.leistung === 'Sonstiges' ? 'Was wurde gemacht?' : 'z.B. 2 Schränke, 3. OG ohne Lift…'}
                    value={pos.beschreibung}
                    onChange={e => ucp(pos.id, 'beschreibung', e.target.value)}
                    style={{ borderColor: pos.leistung === 'Sonstiges' && !pos.beschreibung ? '#dc2626' : undefined }}
                  />
                </div>
              </div>
              {/* Menge / Einheit / Preis / Total */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label>Menge</label>
                  <input type="number" min="0" step="0.5" value={pos.menge} onChange={e => ucp(pos.id, 'menge', e.target.value)} style={{ textAlign: 'right' }} />
                </div>
                <div>
                  <label>Einheit</label>
                  <select value={pos.einheit} onChange={e => ucp(pos.id, 'einheit', e.target.value)}>
                    {EINHEITEN.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label>Preis pro Einheit</label>
                  <input type="number" min="0" step="0.5" value={pos.preis} onChange={e => ucp(pos.id, 'preis', e.target.value)} style={{ textAlign: 'right' }} />
                </div>
                <div>
                  <label>Total CHF</label>
                  <div style={{ padding: '9px 12px', background: 'white', border: '1px solid #e2e5ec', borderRadius: 12, fontWeight: 800, textAlign: 'right', fontSize: 14, color: '#1a2744' }}>
                    {fmtCHF(Number(pos.menge) * Number(pos.preis))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={addPos} style={{ marginTop: 4, border: '1px dashed #9ca3af', color: '#1e2d4f', background: 'transparent', width: '100%', padding: 12, borderRadius: 14, fontWeight: 700 }}>+ Position hinzufügen</button>
        </div>

        <div className="card" style={{ borderRadius: 22 }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 14 }}>Zahlungsdetails</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label>Zahlungsstatus</label><select value={zahlstatus} onChange={e => setZahlstatus(e.target.value)} style={{ borderColor: zahlstatus === 'Bezahlt' ? '#16a34a' : '#d97706', color: zahlstatus === 'Bezahlt' ? '#16a34a' : '#d97706', fontWeight: 600 }}><option value="Offen">🟡 Offen</option><option value="Bezahlt">🟢 Bezahlt</option></select></div>
            <div><label>Zahlungsart</label><select value={zahlart} onChange={e => setZahlart(e.target.value)} disabled={zahlstatus === 'Offen'} style={{ opacity: zahlstatus === 'Offen' ? 0.5 : 1 }}>{ZAHLARTEN.map(z => <option key={z}>{z}</option>)}</select></div>
          </div>
          {zahlstatus === 'Bezahlt' && <div style={{ marginTop: 12, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#16a34a', fontWeight: 700 }}>✓ Das PDF wird als Quittung mit «Betrag dankend erhalten» ausgestellt.</div>}
        </div>

        <div className="card" style={{ borderRadius: 22, maxWidth: 340, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#6b7280' }}><span>Nettobetrag</span><span style={{ color: '#1a2744' }}>{fmtCHF(netto)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#6b7280' }}><span>MwSt. 8.1 %</span><span style={{ color: '#1a2744' }}>{fmtCHF(mwst)}</span></div>
          <div style={{ borderTop: '2px solid #1a2744', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 17, color: '#1a2744' }}><span>Gesamtbetrag</span><span>{fmtCHF(brutto)}</span></div>
        </div>
      </div>
    </div>
  )
}

function Uebersicht({ rechnungen, onEdit, onDelete, onNeu, onPrint }) {
  const [filter, setFilter] = useState('Alle')
  const [filterMonat, setFilterMonat] = useState('Alle')

  const offen = rechnungen.filter(r => r.zahlstatus === 'Offen')
  const bezahlt = rechnungen.filter(r => r.zahlstatus === 'Bezahlt')
  const totalOffen = offen.reduce((s, r) => s + (Number(r.brutto) || 0), 0)
  const totalBezahlt = bezahlt.reduce((s, r) => s + (Number(r.brutto) || 0), 0)
  const monate = Array.from(new Set(rechnungen.map(r => monthKey(r.datum)).filter(Boolean))).sort((a, b) => b.localeCompare(a))
  const byStatus = filter === 'Alle' ? rechnungen : rechnungen.filter(r => r.zahlstatus === filter)
  const filtered = filterMonat === 'Alle' ? byStatus : byStatus.filter(r => monthKey(r.datum) === filterMonat)
  const selectedMonth = filterMonat !== 'Alle' ? filterMonat : (monate[0] || null)

  const selectedSummary = useMemo(() => {
    if (!selectedMonth) return null
    const rows = rechnungen.filter(r => monthKey(r.datum) === selectedMonth)
    const total = rows.reduce((s, r) => s + (Number(r.brutto) || 0), 0)
    const paid = rows.filter(r => r.zahlstatus === 'Bezahlt').reduce((s, r) => s + (Number(r.brutto) || 0), 0)
    const offenM = rows.filter(r => r.zahlstatus === 'Offen').reduce((s, r) => s + (Number(r.brutto) || 0), 0)
    const methods = rows.filter(r => r.zahlstatus === 'Bezahlt').reduce((acc, r) => { acc[r.zahlart] = (acc[r.zahlart] || 0) + (Number(r.brutto) || 0); return acc }, {})
    return { label: monthLabel(selectedMonth), total, paid, offen: offenM, methods }
  }, [rechnungen, selectedMonth])

  const openPdf = () => { if (!selectedSummary) return; const w = window.open('','_blank','width=1200,height=900'); w.document.write(buildMonthlySummaryHtml(selectedSummary)); w.document.close() }
  const downloadAllPdf = () => {
    const total = rechnungen.reduce((s,r)=>s+(Number(r.brutto)||0),0)
    const paid = rechnungen.filter(r=>r.zahlstatus==='Bezahlt').reduce((s,r)=>s+(Number(r.brutto)||0),0)
    const offenM = rechnungen.filter(r=>r.zahlstatus==='Offen').reduce((s,r)=>s+(Number(r.brutto)||0),0)
    const methods = rechnungen.filter(r=>r.zahlstatus==='Bezahlt').reduce((acc,r)=>{acc[r.zahlart]=(acc[r.zahlart]||0)+(Number(r.brutto)||0);return acc},{})
    const w = window.open('','_blank','width=1200,height=900'); w.document.write(buildMonthlySummaryHtml({label:'Alle Rechnungen',total,bezahlt:paid,offen:offenM,methods})); w.document.close()
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e2d4f,#2f4b88)', color: 'white', borderRadius: 24, padding: 22, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.12em', opacity: .75, fontWeight: 700 }}>Bärenstarker Transport</div>
            <h2 style={{ margin: '6px 0 0', fontSize: 24 }}>Übersicht</h2>
          </div>
          <button onClick={onNeu} style={{ background: '#f7c948', color: '#1e2d4f', padding: '10px 16px', borderRadius: 12, border: 'none', fontWeight: 800 }}>+ Neue Rechnung</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[['Alle Dokumente', rechnungen.length, '#1a2744', '📄'],['Offen', `${offen.length} · ${fmtCHF(totalOffen)}`, '#d97706', '🟡'],['Bezahlt', `${bezahlt.length} · ${fmtCHF(totalBezahlt)}`, '#16a34a', '🟢']].map(([label, val, color, icon]) => (
          <div key={label} className="card" style={{ textAlign: 'center', padding: 18, borderRadius: 22 }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
            <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800, color }}>{val}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ borderRadius: 22, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Alle', 'Offen', 'Bezahlt'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? '#1a2744' : 'white', color: filter === f ? 'white' : '#1a2744', border: '1px solid #1a2744', fontWeight: 700, padding: '8px 16px', fontSize: 13, borderRadius: 12 }}>{f}</button>
            ))}
          </div>
          <div style={{ minWidth: 220 }}>
            <label>Monat filtern</label>
            <select value={filterMonat} onChange={e => setFilterMonat(e.target.value)}>
              <option value="Alle">Alle Monate</option>
              {monate.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {selectedSummary && (
        <div className="card" style={{ borderRadius: 22, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, color: '#1a2744', fontSize: 18 }}>Monatsbilanz: {selectedSummary.label}</p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>Total: {fmtCHF(selectedSummary.total)} · Bezahlt: {fmtCHF(selectedSummary.paid)} · Offen: {fmtCHF(selectedSummary.offen)}</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(selectedSummary.methods).map(([m, sum]) => (
                <div key={m} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '10px 12px', minWidth: 120 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{m}</p>
                  <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#1a2744' }}>{fmtCHF(sum)}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button onClick={downloadAllPdf} style={{ background: '#1a2744', color: 'white', border: 'none', padding: '10px 14px', borderRadius: 12, fontWeight: 800 }}>⬇️ Als PDF exportieren</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 46, color: '#9ca3af', borderRadius: 22 }}>
          <p style={{ fontSize: 40, marginBottom: 10 }}>📭</p>
          <p style={{ fontWeight: 700 }}>Keine Dokumente gefunden</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Klicken Sie auf «Neue Rechnung» um zu beginnen.</p>
        </div>
      ) : filtered.map(inv => (
        <div key={inv.firestoreId} className="card" style={{ marginBottom: 10, padding: '14px 18px', borderRadius: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{inv.kunde.name || '—'}</span>
                <span className={`badge badge-${inv.zahlstatus === 'Bezahlt' ? 'paid' : 'open'}`}>{inv.zahlstatus === 'Bezahlt' ? '✓ Bezahlt' : '● Offen'}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{inv.nr} · {fmtD(inv.datum)} · {inv.docTyp}{inv.zahlstatus === 'Bezahlt' && <span style={{ marginLeft: 6, color: '#16a34a' }}>· {inv.zahlart}</span>}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>{inv.positionen.map(p => p.leistung).join(', ')}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 16, color: '#1a2744' }}>{fmtCHF(inv.brutto)}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>inkl. MwSt.</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => onPrint(inv)} style={{ padding: '7px 12px', fontSize: 13 }}>🖨️</button>
              <button onClick={() => onEdit(inv)} style={{ padding: '7px 12px', fontSize: 13 }}>✏️</button>
              <button className="btn-danger" onClick={() => onDelete(inv)} style={{ padding: '7px 12px', fontSize: 13 }}>🗑️</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState('overview')
  const [rechnungen, setRechnungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [editInv, setEditInv] = useState(null)
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u ?? null))
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'rechnungen'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setRechnungen(snap.docs.map(d => ({ ...d.data(), firestoreId: d.id })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [user])

  const handleSave = async inv => {
    try {
      if (inv.firestoreId) {
        const ref = doc(db, 'rechnungen', inv.firestoreId)
        const { firestoreId, ...data } = inv
        await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() })
      } else {
        await addDoc(collection(db, 'rechnungen'), { ...inv, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      }
      setScreen('overview'); setEditInv(null)
    } catch (e) { alert('Fehler beim Speichern: ' + e.message) }
  }

  const handleDelete = async firestoreId => {
    try { await deleteDoc(doc(db, 'rechnungen', firestoreId)) }
    catch (e) { alert('Fehler beim Löschen: ' + e.message) }
  }

  const handlePrint = inv => {
    const w = window.open('', '_blank', 'width=1200,height=900')
    w.document.write(buildPrintHtml(inv))
    w.document.close()
  }

  const handleLogout = async () => { await signOut(auth); setRechnungen([]); setScreen('overview') }

  if (user === undefined) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1e2d4f,#2f4b88)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'white', textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 16 }}>🐻</div><p style={{ fontWeight: 700, fontSize: 16 }}>Laden…</p></div>
    </div>
  )

  if (!user) return <LoginScreen />

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb' }}>
      <header style={{ background: 'linear-gradient(135deg,#1e2d4f,#2f4b88)', color: 'white', padding: '0 20px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 10px 30px rgba(30,45,79,.18)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="BT" style={{ height: 36, width: 'auto', filter: 'brightness(0) invert(1)', flexShrink: 0 }} onError={e => e.target.style.display='none'} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>Bärenstarker Transport</p>
            <p style={{ margin: 0, fontSize: 11, opacity: 0.72 }}>Rechnungs-Manager</p>
          </div>
          {screen !== 'overview' && (
            <button onClick={() => { setScreen('overview'); setEditInv(null) }} style={{ background: 'rgba(255,255,255,0.16)', color: 'white', border: 'none', padding: '8px 14px', fontSize: 13, borderRadius: 12 }}>← Übersicht</button>
          )}
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 14px', fontSize: 13, borderRadius: 12 }}>🚪 Abmelden</button>
        </div>
      </header>

      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '14px 20px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1a2744' }}>
            {screen === 'overview' && '📋 Übersicht'}{screen === 'new' && '+ Neue Rechnung'}{screen === 'edit' && '✏️ Rechnung bearbeiten'}
          </h1>
        </div>
      </div>

      <main style={{ padding: '20px 16px', maxWidth: 1120, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 70 }}><div style={{ fontSize: 40, marginBottom: 16 }}>🔄</div><p style={{ color: '#6b7280', fontWeight: 500 }}>Daten werden geladen…</p></div>
        ) : screen === 'overview' ? (
          <Uebersicht rechnungen={rechnungen} onEdit={inv => { setEditInv(inv); setScreen('edit') }} onDelete={inv => { if (window.confirm('Wirklich löschen?')) handleDelete(inv.firestoreId) }} onNeu={() => { setEditInv(null); setScreen('new') }} onPrint={handlePrint} />
        ) : (screen === 'new' || screen === 'edit') ? (
          <RechnungForm initial={editInv} onSave={handleSave} onCancel={() => { setScreen('overview'); setEditInv(null) }} />
        ) : null}
      </main>
    </div>
  )
}
