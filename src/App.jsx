import { useState, useEffect } from 'react'
import { db } from './firebase'
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore'

// ─── Constants ───────────────────────────────────────────────────────────────
const CO = {
  name: 'Bärenstarker Transport GmbH',
  addr: 'Fürtiring 16a · 6018 Buttisholz',
  contact: 'Zef Mirakaj',
  title: 'Geschäftsführer',
  email: 'baeren_stark@hotmail.com',
  phone: '075 558 33 33',
  uid: 'CHE-459.842.475 MwSt.',
  svcs: [
    'Transporte',
    'Umzüge',
    'Räumungen',
    'Montagen',
    'Reinigungen',
    'Entsorgungen'
  ],
}

const LEISTUNGEN = [
  'Transport',
  'Umzug',
  'Räumung',
  'Entsorgung',
  'Montage',
  'Reinigung',
  'Sonstiges'
]
const DOC_TYPEN = ['Rechnung','Auftragsbestätigung','Offerte']
const ANREDEN = ['Herr','Frau','Firma']
const ZAHLARTEN = ['Barzahlung','Kartenzahlung','Twint','Überweisung']
const VAT = 0.081
const STUECK_LEISTUNGEN = ['Sonstiges'] // leistungen, die als Stück zählen

function genNr(type) {
  const y = new Date().getFullYear()
  const p = type === 'Rechnung' ? 'RE' : type === 'Auftragsbestätigung' ? 'AB' : 'OF'
  return `${p}-${y}-${String(Math.floor(Math.random() * 900) + 100)}`
}

const heute = () => new Date().toISOString().split('T')[0]

const fmtD = s => { 
  try { 
    return new Date(s).toLocaleDateString('de-CH') 
  } catch { 
    return s 
  } 
}

const fmtCHF = n => `CHF ${Number(n).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const emptyPos = (leistung = 'Transport') => ({ 
  id: Date.now() + Math.random(), 
  leistung, 
  beschreibung: '', 
  stunden: 2, 
  ansatz: 80 
})

// ─── Invoice Form ─────────────────────────────────────────────────────────────
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
  const addPos = () => setPositionen(p => [...p, emptyPos(positionen[0]?.leistung)])
  const delPos = id => setPositionen(p => p.length > 1 ? p.filter(i => i.id !== id) : p)
  const chgTyp = t => { setDocTyp(t); setNr(genNr(t)) }

  const netto = positionen.reduce((s, p) => s + Number(p.stunden) * Number(p.ansatz), 0)
  const mwst = netto * VAT
  const brutto = netto + mwst

  const handleSave = () => {
    if (!kunde.name.trim()) { alert('Bitte Kundenname eingeben.'); return }
    onSave({ 
      id: initial?.id || Date.now(), 
      docTyp, 
      nr, 
      datum, 
      anrede, 
      kunde, 
      positionen, 
      zahlstatus, 
      zahlart, 
      netto, 
      mwst, 
      brutto, 
      createdAt: initial?.createdAt || new Date().toISOString() 
    })
  }

  const getLabel = (pos) => {
    const istStueck = STUECK_LEISTUNGEN.includes(pos.leistung)
    return istStueck ? 'Menge (Stück/Pauschale)' : 'Stunden/Stück'
  }

  const getUnitLabel = (pos) => {
    const istStueck = STUECK_LEISTUNGEN.includes(pos.leistung)
    return istStueck ? 'CHF pro Stück' : 'CHF pro Stunde'
  }

  const getPlaceholder = (pos) => {
    const istStueck = STUECK_LEISTUNGEN.includes(pos.leistung)
    return istStueck ? 'z.B. 10 Stück' : 'z.B. 2.0 Stunden'
  }

  const handleChangeLeistung = (id, e) => {
    const leistung = e.target.value
    const istStueck = STUECK_LEISTUNGEN.includes(leistung)
    const posToUpdate = positionen.find(p => p.id === id)
    
    // For Sonstiges, default to 1.0 as quantity (Stück), for others keep current Stunden
    const neueStunden = istStueck ? 1.0 : (posToUpdate?.stunden || 2.0)
    
    ucp(id, 'leistung', leistung)
    ucp(id, 'stunden', neueStunden)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 0 40px' }}>
      {/* Doc meta */}
      <div className="card">
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 14 }}>Dokumentdetails</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }} className="grid-3">
          <div>
            <label>Dokumenttyp</label>
            <select value={docTyp} onChange={e => chgTyp(e.target.value)}>
              {DOC_TYPEN.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label>Nummer</label>
            <input value={nr} onChange={e => setNr(e.target.value)} />
          </div>
          <div>
            <label>Datum</label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Customer */}
      <div className="card">
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 14 }}>Kunde / Empfänger</p>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label>Anrede</label>
            <select value={anrede} onChange={e => setAnrede(e.target.value)}>
              {ANREDEN.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label>Name / Firma</label>
            <input placeholder="z.B. Mario Roos" value={kunde.name} onChange={e => uck('name', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label>Strasse & Nr.</label>
            <input placeholder="Grünfeld 1" value={kunde.strasse} onChange={e => uck('strasse', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
          <div>
            <label>PLZ</label>
            <input placeholder="6208" value={kunde.plz} onChange={e => uck('plz', e.target.value)} />
          </div>
          <div>
            <label>Ort</label>
            <input placeholder="Oberkirch" value={kunde.ort} onChange={e => uck('ort', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Positions */}
      <div className="card">
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 14 }}>Positionen</p>
        {positionen.map((pos, idx) => (
          <div key={pos.id} style={{ background: '#f8f9fc', borderRadius: 8, padding: 14, marginBottom: 10, border: '1px solid #e8ebf0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2744' }}>Position {idx + 1}</span>
              <button className="btn-danger" onClick={() => delPos(pos.id)} title="Entfernen">✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label>Leistungsart</label>
                <select 
                  value={pos.leistung} 
                  onChange={e => handleChangeLeistung(pos.id, e)}
                >
                  {LEISTUNGEN.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label>
                  {pos.leistung === 'Sonstiges' ? 'Beschreibung (Pflicht)' : 'Beschreibung (optional)'}
                </label>
                <input
                  placeholder={pos.leistung === 'Sonstiges' ? 'Was wurde gemacht?' : 'z.B. 2 Schränke, 3. OG ohne Lift...'}
                  value={pos.beschreibung}
                  onChange={e => ucp(pos.id, 'beschreibung', e.target.value)}
                  style={{ borderColor: pos.leistung === 'Sonstiges' && !pos.beschreibung ? '#dc2626' : undefined }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label>{getLabel(pos)}</label>
                <input 
                  type="number"
                  min="0.5"
                  step={STUECK_LEISTUNGEN.includes(pos.leistung) ? "1" : "0.5"}
                  value={pos.stunden}
                  placeholder={getPlaceholder(pos)}
                  onChange={e => ucp(pos.id, 'stunden', e.target.value)}
                  style={{ textAlign: 'right' }}
                />
              </div>
              <div>
                <label>{getUnitLabel(pos)}</label>
                <input 
                  type="number"
                  min="0"
                  step="5"
                  value={pos.ansatz}
                  onChange={e => ucp(pos.id, 'ansatz', e.target.value)}
                  style={{ textAlign: 'right' }}
                />
              </div>
              <div>
                <label>Positionspreis</label>
                <div style={{ padding: '9px 12px', background: 'white', border: '1px solid #e2e5ec', borderRadius: 6, fontWeight: 700, textAlign: 'right', fontSize: 14, color: '#1a2744' }}>
                  {fmtCHF(Number(pos.stunden) * Number(pos.ansatz))}
                </div>
              </div>
            </div>
          </div>
        ))}
        <button onClick={addPos} style={{ marginTop: 4, border: '1px dashed #c8a84b', color: '#c8a84b', background: 'transparent', width: '100%', padding: 10 }}>
          + Position hinzufügen
        </button>
      </div>

      {/* Payment */}
      <div className="card">
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 14 }}>Zahlungsdetails</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label>Zahlungsstatus</label>
            <select 
              value={zahlstatus} 
              onChange={e => setZahlstatus(e.target.value)}
              style={{ 
                borderColor: zahlstatus === 'Bezahlt' ? '#16a34a' : '#d97706', 
                color: zahlstatus === 'Bezahlt' ? '#16a34a' : '#d97706', 
                fontWeight: 600 
              }}
            >
              <option value="Offen">🟡 Offen</option>
              <option value="Bezahlt">🟢 Bezahlt</option>
            </select>
          </div>
          <div>
            <label>Zahlungsart</label>
            <select 
              value={zahlart} 
              onChange={e => setZahlart(e.target.value)} 
              disabled={zahlstatus === 'Offen'}
              style={{ opacity: zahlstatus === 'Offen' ? 0.5 : 1 }}
            >
              {ZAHLARTEN.map(z => <option key={z}>{z}</option>)}
            </select>
          </div>
        </div>
        {zahlstatus === 'Bezahlt' && (
          <div style={{ marginTop: 12, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
            ✓ Das PDF wird als Quittung mit «Betrag dankend erhalten» ausgestellt.
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="card" style={{ maxWidth: 300, marginLeft: 'auto' }}>
        {[['Nettobetrag', netto], ['MwSt. 8.1 %', mwst]].map(([l, a]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#6b7280' }}>
            <span>{l}</span><span style={{ color: '#1a2744' }}>{fmtCHF(a)}</span>
          </div>
        ))}
        <div style={{ borderTop: '2px solid #1a2744', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, color: '#1a2744' }}>
          <span>Gesamtbetrag</span><span>{fmtCHF(brutto)}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button onClick={onCancel} style={{ padding: '10px 20px' }}>Abbrechen</button>
        <button className="btn-primary" onClick={handleSave}>
          {initial ? 'Aktualisieren' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

// ─── Print/PDF View ───────────────────────────────────────────────────────────
function PrintView({ inv }) {
  const quittung = inv.zahlstatus === 'Bezahlt'
  const istStueckLeistung = (leistung) => STUECK_LEISTUNGEN.includes(leistung)
  const getUnitLabelPrint = (leistung) => istStueckLeistung(leistung) ? 'Stück' : 'Std.'
  const getRateLabelPrint = (leistung) => istStueckLeistung(leistung) ? 'CHF pro Stück' : 'CHF/h'
  const getAmountLabelPrint = (leistung) => istStueckLeistung(leistung) ? 'Menge' : 'Std.'
  const getQuantity = (pos) => pos.stunden
  const getPrice = (pos) => Number(pos.stunden) * Number(pos.ansatz)

  return (
    <div id="print-area" style={{ background: 'white', maxWidth: 800, margin: '0 auto', padding: '40px', fontFamily: 'Arial, sans-serif', color: '#222' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1a2744', paddingBottom: 16, marginBottom: 24 }}>
        <div>
          <div style={{ marginBottom: 8 }}>
            <img src="/logo_full.png" alt="Bärenstarker Transport GmbH" style={{ height: 70, width: 'auto' }} />
          </div>
          <p style={{ fontSize: 11, color: '#666', margin: 0 }}>{CO.svcs.map((s, i) => <span key={s}>{i > 0 ? ' · ' : ''}●{s}</span>)}</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11.5, color: '#555', lineHeight: 1.9 }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#1a2744' }}>{CO.name}</p>
          <p style={{ margin: 0 }}>{CO.addr}</p>
          <p style={{ margin: 0 }}>Tel. {CO.phone}</p>
          <p style={{ margin: 0 }}>{CO.email}</p>
          <p style={{ margin: 0 }}>UID: {CO.uid}</p>
        </div>
      </div>

      {/* QUITTUNG banner */}
      {quittung && (
        <div style={{ background: '#dcfce7', border: '2px solid #16a34a', borderRadius: 10, padding: '12px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>✅</span>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#16a34a' }}>BETRAG DANKEND ERHALTEN</p>
            <p style={{ margin: 0, fontSize: 12, color: '#166534' }}>Zahlungsart: {inv.zahlart} · {fmtD(inv.datum)}</p>
          </div>
        </div>
      )}

      {/* Meta + Kunde */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 12, lineHeight: 2, color: '#555' }}>
          {[['Datum', fmtD(inv.datum)], ['Ansprechpartner', CO.contact], ['E-Mail', CO.email], ['Telefon', CO.phone], ['Nummer', inv.nr]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontWeight: 600, minWidth: 130, color: '#333' }}>{k}:</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.9 }}>
          <p style={{ margin: 0, color: '#888', fontSize: 12 }}>{inv.anrede}</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{inv.kunde.name}</p>
          {inv.kunde.strasse && <p style={{ margin: 0 }}>{inv.kunde.strasse}</p>}
          {(inv.kunde.plz || inv.kunde.ort) && <p style={{ margin: 0 }}>{inv.kunde.plz} {inv.kunde.ort}</p>}
        </div>
      </div>

      {/* Title */}
      <p style={{ fontWeight: 800, fontSize: 16, borderBottom: '1px solid #ddd', paddingBottom: 6, marginBottom: 14 }}>
        {inv.docTyp} {quittung ? '/ Quittung' : ''}
      </p>
      <p style={{ fontSize: 13, marginBottom: 20, lineHeight: 1.7 }}>
        Sehr geehrte{inv.anrede === 'Herr' ? 'r' : ''} {inv.anrede !== 'Firma' ? inv.anrede + ' ' : ''}{inv.kunde.name},<br />
        vielen Dank für Ihr Vertrauen. Wir freuen uns, den Auftrag ausgeführt zu haben.
      </p>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#1a2744', color: 'white' }}>
            {[['Pos', '40px', 'left'], [getAmountLabelPrint(inv.positionen[0]?.leistung), '100px', 'right'], ['Bezeichnung', 'auto', 'left'], [getRateLabelPrint(inv.positionen[0]?.leistung), '100px', 'right'], ['Positionspreis', '120px', 'right']].map(([h, w, a]) => (
              <th key={h} style={{ padding: '8px 10px', textAlign: a, fontWeight: 500, width: w, fontSize: 12 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inv.positionen.map((pos, idx) => (
            <tr key={pos.id} style={{ borderBottom: '1px solid #eee', background: idx % 2 === 0 ? '#fafafa' : 'white' }}>
              <td style={{ padding: '8px 10px', color: '#888' }}>{idx + 1}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{getQuantity(pos)}</td>
              <td style={{ padding: '8px 10px' }}>
                <span style={{ fontWeight: 600 }}>{pos.leistung}</span>
                {pos.beschreibung && <span style={{ color: '#555' }}> – {pos.beschreibung}</span>}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Number(pos.ansatz).toFixed(2)}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtCHF(getPrice(pos))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ fontSize: 11.5, color: '#666', marginBottom: 20 }}>Alle Preise inkl. 8.1% MwSt. in CHF.</p>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <div style={{ minWidth: 280, fontSize: 13 }}>
          {[['Nettobetrag (exkl. MwSt.)', inv.netto], ['MwSt. 8.1 %', inv.mwst]].map(([l, a]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ color: '#555' }}>{l}</span><span>{fmtCHF(a)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 800, fontSize: 16, color: '#1a2744', borderTop: '2px solid #1a2744', marginTop: 4 }}>
            <span>Gesamtbetrag</span><span>{fmtCHF(inv.brutto)}</span>
          </div>
          {quittung && (
            <div style={{ background: '#dcfce7', borderRadius: 6, padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#16a34a', fontSize: 13, marginTop: 8 }}>
              ✓ Betrag dankend erhalten — {inv.zahlart}
            </div>
          )}
        </div>
      </div>

      {/* AGB */}
      <div style={{ borderTop: '1px solid #ddd', paddingTop: 14, fontSize: 11, color: '#666', lineHeight: 1.8 }}>
        <p style={{ fontWeight: 700, textDecoration: 'underline', marginBottom: 8, color: '#333' }}>Allgemein</p>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '2px 12px' }}>
          <span style={{ fontWeight: 600 }}>Zahlungskonditionen:</span>
          <span>Barzahlung vor Ort nach Erledigung des Auftrags. Alle Preise zzgl. MwSt. 8.1%</span>
          <span style={{ fontWeight: 600 }}>Im Preis inbegriffen:</span>
          <span>Betriebshaftpflichtversicherung (CHF 5'000'000.–), Transportversicherung (CHF 50'000.–), keine Benzin- oder Kilometerkosten, keine LSVA</span>
          <span style={{ fontWeight: 600 }}>Vertragsrücktritt:</span>
          <span>30% ab 48h · 60% ab 14 Tage · 100% ab 7 Tage vor geplantem Einsatz</span>
        </div>
      </div>

      {/* Signature */}
      <div style={{ marginTop: 28, fontSize: 12, color: '#555' }}>
        <p>Für Rückfragen steht Ihnen {CO.contact} unter {CO.phone} gerne zur Verfügung.</p>
        <p style={{ margin: '14px 0 32px' }}>Wir bedanken uns für den Auftrag und freuen uns auf die weitere Zusammenarbeit.</p>
        <p>Freundliche Grüsse</p>
        <p style={{ marginTop: 24, fontWeight: 700, fontSize: 13, color: '#1a2744', marginBottom: 2 }}>{CO.contact}</p>
        <p style={{ margin: 0 }}>{CO.title}</p>
        <p style={{ margin: 0, fontStyle: 'italic' }}>{CO.name}</p>
      </div>
    </div>
  )
}

// ─── Overview / Dashboard ─────────────────────────────────────────────────────
function Uebersicht({ rechnungen, onEdit, onDelete, onNeu, onPrint }) {
  const [filter, setFilter] = useState('Alle')
  const [filterMonat, setFilterMonat] = useState('Alle')

  const offen = rechnungen.filter(r => r.zahlstatus === 'Offen')
  const bezahlt = rechnungen.filter(r => r.zahlstatus === 'Bezahlt')
  const totalOffen = offen.reduce((s, r) => s + r.brutto, 0)
  const totalBezahlt = bezahlt.reduce((s, r) => s + r.brutto, 0)

  // Pomembno: pretvori datum v `YYYY-MM`
  const byMonat = (r) => r.datum.split('-').slice(0, 2).join('-')

  const filteredByStatus = filter === 'Alle'
    ? rechnungen
    : rechnungen.filter(r => r.zahlstatus === filter)

  const filtered = filterMonat === 'Alle'
    ? filteredByStatus
    : filteredByStatus.filter(r => byMonat(r) === filterMonat)

  // seznam vseh unikatnih `YYYY-MM` (urejeno od zadnjega naprej)
  const monateList = Array.from(new Set(rechnungen.map(byMonat)))
    .sort((a, b) => b.localeCompare(a))

  const mts = [
    'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
  ]

  const formatMonat = (m) => {
    const [y, mm] = m.split('-')
    return `${mts[Number(mm) - 1]} ${y}`
  }

  // Monthly summary totals
  const monthlyTotals = filtered.reduce((acc, r) => {
    const monat = byMonat(r)
    if (!acc[monat]) {
      acc[monat] = { brutto: 0, zahzahlungen: { Barzahlung: 0, Kartenzahlung: 0, Twint: 0, Überweisung: 0 } }
    }
    acc[monat].brutto += r.brutto
    if (r.zahlstatus === 'Bezahlt' && ZAHLARTEN.includes(r.zahlart)) {
      acc[monat].zahzahlungen[r.zahlart] += r.brutto
    }
    return acc
  }, {})

  const currentMonat = filterMonat !== 'Alle' ? filterMonat : byMonat(new Date())

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        {[
          ['Alle Dokumente', rechnungen.length, '#1a2744', '📄'],
          ['Offen', `${offen.length} · ${fmtCHF(totalOffen)}`, '#d97706', '🟡'],
          ['Bezahlt', `${bezahlt.length} · ${fmtCHF(totalBezahlt)}`, '#16a34a', '🟢'],
        ].map(([label, val, color, icon]) => (
          <div key={label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filter + New */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', gap: 6 }}>
          {['Alle', 'Offen', 'Bezahlt'].map(f => (
            <button key={f} onClick={() => { setFilter(f); setFilterMonat('Alle') }}
              style={{ background: filter === f ? '#1a2744' : 'white', color: filter === f ? 'white' : '#1a2744', border: '1px solid #1a2744', fontWeight: 500, padding: '7px 16px', fontSize: 13 }}>
              {f}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={onNeu} style={{ padding: '9px 20px', fontSize: 14 }}>
          + Neue Rechnung
        </button>
      </div>

      {/* Filter po mesecu */}
      <div style={{ marginBottom: 14 }}>
        <select 
          value={filterMonat} 
          onChange={e => setFilterMonat(e.target.value)} 
          style={{ padding: '6px 12px', fontSize: 13, width: '220px' }}
        >
          <option value="Alle">Alle Monate</option>
          {monateList.map(m => (
            <option key={m} value={m}>{formatMonat(m)}</option>
          ))}
        </select>
      </div>

      {/* Monthly Summary Card */}
      {filterMonat !== 'Alle' && monthlyTotals[currentMonat] && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px', background: '#f8f9fc' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 12 }}>
            Monatsbilanz {formatMonat(currentMonat)}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Total: {fmtCHF(monthlyTotals[currentMonat].brutto)}</p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#555', margin: '12px 0 8px', fontWeight: 600 }}>Zahlungsmethoden im Monat:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {ZAHLARTEN.map(z => {
              const sum = monthlyTotals[currentMonat].zahzahlungen[z] || 0
              if (sum === 0) return null
              const color = z === 'Barzahlung' ? '#3b82f6' : z === 'Kartenzahlung' ? '#059669' : z === 'Twint' ? '#0b57d0' : '#ea580c'
              return (
                <div key={z} style={{ padding: '10px 14px', background: 'white', border: '1px solid #e2e5ec', borderRadius: 8, minWidth: '140px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#555' }}>{z}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 700, color }}>{fmtCHF(sum)}</p>
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '12px 0 0', fontStyle: 'italic' }}>
            Diese Zusammenfassung zeigt alle Rechnungen des Monats und die Zahlungsmethoden der bezahlten Rechnungen.
          </p>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <p style={{ fontSize: 40, marginBottom: 10 }}>📭</p>
          <p style={{ fontWeight: 600 }}>Keine Dokumente gefunden</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Klicken Sie auf «Neue Rechnung» um zu beginnen.</p>
        </div>
      ) : (
        filtered.map(inv => (
          <div key={inv.firestoreId} className="card" style={{ marginBottom: 10, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{inv.kunde.name || '—'}</span>
                  <span className={`badge badge-${inv.zahlstatus === 'Bezahlt' ? 'paid' : 'open'}`}>
                    {inv.zahlstatus === 'Bezahlt' ? '✓ Bezahlt' : '● Offen'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                  {inv.nr} · {fmtD(inv.datum)} · {inv.docTyp}
                  {inv.zahlstatus === 'Bezahlt' && <span style={{ marginLeft: 6, color: '#16a34a' }}>· {inv.zahlart}</span>}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>
                  {inv.positionen.map(p => p.leistung).join(', ')}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#1a2744' }}>{fmtCHF(inv.brutto)}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>inkl. MwSt.</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onPrint(inv)} title="Drucken / PDF" style={{ padding: '7px 12px', fontSize: 13 }}>🖨️</button>
                <button onClick={() => onEdit(inv)} title="Bearbeiten" style={{ padding: '7px 12px', fontSize: 13 }}>✏️</button>
                <button className="btn-danger" onClick={() => onDelete(inv)} title="Löschen" style={{ padding: '7px 12px', fontSize: 13 }}>🗑️</button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('overview')
  const [rechnungen, setRechnungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [editInv, setEditInv] = useState(null)
  const [printInv, setPrintInv] = useState(null)

  // ── Realtime listener from Firestore ──
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
        // Update existing
        const ref = doc(db, 'rechnungen', inv.firestoreId)
        const { firestoreId, ...data } = inv
        await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() })
      } else {
        // New document
        await addDoc(collection(db, 'rechnungen'), {
          ...inv,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
      setScreen('overview')
      setEditInv(null)
    } catch (e) {
      alert('Fehler beim Speichern: ' + e.message)
    }
  }

  const handleDelete = async (firestoreId) => {
    try {
      await deleteDoc(doc(db, 'rechnungen', firestoreId))
    } catch (e) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  const handlePrint = inv => {
    // Build HTML in new window for reliable PDF/print
    const printHTML = `<!DOCTYPE html>
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
    .total-row { font-weight: 700; font-size: 15px; color: #1a2744; border-top: 2px solid #1a2744; padding-top: 8px; }
    .muted { color: '#666'; }
    .agb { font-size: 11px; color: #666; line-height: 1.7; border-top: 1px solid #ddd; padding-top: 14px; margin-top: 20px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a2744;padding-bottom:16px;margin-bottom:24px;">
    <div>
      <img src="${window.location.origin}/logo_full.png" alt="Bärenstarker Transport GmbH" style="height:65px;width:auto;margin-bottom:6px;" />
      <p style="font-size:11px;color:#666;">●Transporte ·●Umzüge ·●Räumungen ·●Montagen ·●Reinigungen ·●Entsorgungen</p>
    </div>
    <div style="text-align:right;font-size:11.5px;color:#555;line-height:1.9;">
      <p style="font-weight:700;color:#1a2744;">Bärenstarker Transport GmbH</p>
      <p>Fürtiring 16a · 6018 Buttisholz</p>
      <p>Tel. 075 558 33 33</p>
      <p>baeren_stark@hotmail.com</p>
      <p>UID: CHE-459.842.475 MwSt.</p>
    </div>
  </div>

  ${inv.zahlstatus === 'Bezahlt' ? `
  <div class="green-box">
    <p style="font-weight:800;font-size:16px;color:#16a34a;">✅ BETRAG DANKEND ERHALTEN</p>
    <p style="font-size:12px;color:#166534;margin-top:4px;">Zahlungsart: ${inv.zahlart} · ${new Date(inv.datum).toLocaleDateString('de-CH')}</p>
  </div>` : ''}

  <!-- META + KUNDE -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
    <div style="font-size:12px;color:#555;line-height:2;">
      <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">Datum:</span><span>${new Date(inv.datum).toLocaleDateString('de-CH')}</span></div>
      <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">Ansprechpartner:</span><span>Zef Mirakaj</span></div>
      <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">E-Mail:</span><span>baeren_stark@hotmail.com</span></div>
      <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">Telefon:</span><span>075 558 33 33</span></div>
      <div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#333;">Nummer:</span><span>${inv.nr}</span></div>
    </div>
    <div style="font-size:13px;line-height:1.9;">
      <p style="color:#888;font-size:12px;">${inv.anrede}</p>
      <p style="font-weight:700;font-size:15px;">${inv.kunde.name}</p>
      ${inv.kunde.strasse ? `<p>${inv.kunde.strasse}</p>` : ''}
      ${(inv.kunde.plz || inv.kunde.ort) ? `<p>${inv.kunde.plz} ${inv.kunde.ort}</p>` : ''}
    </div>
  </div>

  <!-- TITLE -->
  <p style="font-weight:800;font-size:15px;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:14px;">
    ${inv.docTyp}${inv.zahlstatus === 'Bezahlt' ? ' / Quittung' : ''}
  </p>
  <p style="font-size:13px;margin-bottom:20px;line-height:1.7;">
    Sehr geehrte${inv.anrede === 'Herr' ? 'r' : ''} ${inv.anrede !== 'Firma' ? inv.anrede + ' ' : ''}${inv.kunde.name},<br/>
    vielen Dank für Ihr Vertrauen. Wir freuen uns, den Auftrag ausgeführt zu haben.
  </p>

  <!-- TABLE -->
  <table style="margin-bottom:12px;">
    <thead>
      <tr>
        <th style="width:40px;">Pos</th>
        <th>Bezeichnung</th>
        <th class="right" style="width:100px;">${getAmountLabelPrint(inv.positionen[0]?.leistung)}</th>
        <th class="right" style="width:100px;">${getRateLabelPrint(inv.positionen[0]?.leistung)}</th>
        <th class="right" style="width:120px;">Positionspreis</th>
      </tr>
    </thead>
    <tbody>
      ${inv.positionen.map((pos, idx) => `
      <tr>
        <td style="color:#888;">${idx + 1}</td>
        <td><strong>${pos.leistung}</strong>${pos.beschreibung ? ' – ' + pos.beschreibung : ''}</td>
        <td class="right">${getQuantity(pos)}</td>
        <td class="right">${Number(pos.ansatz).toFixed(2)}</td>
        <td class="right" style="font-weight:700;">CHF ${(Number(pos.stunden) * Number(pos.ansatz)).toLocaleString('de-CH', {minimumFractionDigits:2})}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <p style="font-size:11.5px;color:#666;margin-bottom:20px;">Alle Preise inkl. 8.1% MwSt. in CHF.</p>

  <!-- TOTALS -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
    <div style="min-width:280px;font-size:13px;">
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;">
        <span class="muted">Nettobetrag (exkl. MwSt.)</span>
        <span>CHF ${inv.netto.toLocaleString('de-CH', {minimumFractionDigits:2})}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;">
        <span class="muted">MwSt. 8.1 %</span>
        <span>CHF ${inv.mwst.toLocaleString('de-CH', {minimumFractionDigits:2})}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:800;font-size:16px;color:#1a2744;border-top:2px solid #1a2744;margin-top:4px;">
        <span>Gesamtbetrag</span>
        <span>CHF ${inv.brutto.toLocaleString('de-CH', {minimumFractionDigits:2})}</span>
      </div>
      ${inv.zahlstatus === 'Bezahlt' ? `
      <div style="background:#dcfce7;border-radius:6px;padding:8px 12px;text-align:center;font-weight:700;color:#16a34a;font-size:13px;margin-top:8px;">
        ✓ Betrag dankend erhalten — ${inv.zahlart}
      </div>` : ''}
    </div>
  </div>

  <!-- AGB -->
  <div class="agb">
    <p style="font-weight:700;text-decoration:underline;margin-bottom:8px;color:#333;">Allgemein</p>
    <table style="font-size:11px;color:#666;">
      <tr><td style="font-weight:600;color:#444;width:160px;padding:2px 12px 2px 0;border:none;">Zahlungskonditionen:</td><td style="border:none;">Barzahlung vor Ort nach Erledigung des Auftrags. Alle Preise zzgl. MwSt. 8.1%</td></tr>
      <tr><td style="font-weight:600;color:#444;padding:2px 12px 2px 0;border:none;">Im Preis inbegriffen:</td><td style="border:none;">Betriebshaftpflichtversicherung (CHF 5'000'000.–), Transportversicherung (CHF 50'000.–), keine Benzin- oder Kilometerkosten, keine LSVA</td></tr>
      <tr><td style="font-weight:600;color:#444;padding:2px 12px 2px 0;border:none;">Vertragsrücktritt:</td><td style="border:none;">30% ab 48h · 60% ab 14 Tage · 100% ab 7 Tage vor geplantem Einsatz</td></tr>
    </table>
  </div>

  <!-- SIGNATURE -->
  <div style="margin-top:28px;font-size:12px;color:#555;">
    <p>Für Rückfragen steht Ihnen Zef Mirakaj unter 075 558 33 33 gerne zur Verfügung.</p>
    <p style="margin:14px 0 32px;">Wir bedanken uns für den Auftrag und freuen uns auf die weitere Zusammenarbeit.</p>
    <p>Freundliche Grüsse</p>
    <p style="margin-top:24px;font-weight:700;font-size:13px;color:#1a2744;margin-bottom:2px;">Zef Mirakaj</p>
    <p>Geschäftsführer</p>
    <p style="font-style:italic;">Bärenstarker Transport GmbH</p>
  </div>

  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`

    const w = window.open('', '_blank')
    w.document.write(printHTML)
    w.document.close()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f7' }}>
      <div id="app-shell">
        {/* Top Nav */}
        <header style={{ background: '#1a2744', color: 'white', padding: '0 20px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo.png" alt="Bärenstarker Transport GmbH" style={{ height: 36, width: 'auto', flexShrink: 0, filter: 'brightness(0) invert(1)' }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Bärenstarker Transport</p>
              <p style={{ margin: 0, fontSize: 11, opacity: 0.65 }}>Rechnungs-Manager</p>
            </div>
            {screen !== 'overview' && (
              <button onClick={() => { setScreen('overview'); setEditInv(null); setPrintInv(null) }}
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', padding: '7px 14px', fontSize: 13 }}>
                ← Übersicht
              </button>
            )}
          </div>
        </header>

        {/* Page Title */}
        <div style={{ background: 'white', borderBottom: '1px solid #e2e5ec', padding: '12px 20px' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a2744' }}>
              {screen === 'overview' && '📋 Übersicht'}
              {screen === 'new' && '+ Neue Rechnung'}
              {screen === 'edit' && '✏️ Rechnung bearbeiten'}
            </h1>
          </div>
        </div>

        {/* Content */}
        <main style={{ padding: '20px 16px', maxWidth: 800, margin: '0 auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔄</div>
              <p style={{ color: '#6b7280', fontWeight: 500 }}>Daten werden geladen…</p>
            </div>
          ) : screen === 'overview' ? (
            <Uebersicht
              rechnungen={rechnungen}
              onEdit={inv => { setEditInv(inv); setScreen('edit') }}
              onDelete={inv => { if (window.confirm('Wirklich löschen?')) handleDelete(inv.firestoreId) }}
              onNeu={() => { setEditInv(null); setScreen('new') }}
              onPrint={handlePrint}
            />
          ) : (screen === 'new' || screen === 'edit') ? (
            <RechnungForm
              initial={editInv}
              onSave={handleSave}
              onCancel={() => { setScreen('overview'); setEditInv(null) }}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}
