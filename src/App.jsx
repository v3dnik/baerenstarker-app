import { useState, useEffect, useMemo } from 'react'
import { db, auth } from './firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'fi
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLoca
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
const LEISTUNGEN = ['Transport', 'Umzug', 'Räumung', 'Entsorgung', 'Montage', 'Reinigung', 'S
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
const fmtD = s => { try { return new Date(s).toLocaleDateString('de-CH') } catch { return s }
const fmtCHF = n => `CHF ${Number(n).toLocaleString('de-CH', { minimumFractionDigits: 2, maxi
const emptyPos = () => ({ id: Date.now() + Math.random(), leistung: 'Transport', beschreibung
const monthKey = s => (s ? s.slice(0, 7) : '')
const monthLabel = m => {
if (!m) return ''
const [y, mm] = m.split('-')
const names = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'Sept
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
60, wi
Anmeld
=> set
return (
<div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1e2d4f,#2f4b88)',
<div style={{ background: 'white', borderRadius: 28, padding: '40px 36px', width: '100%
<div style={{ textAlign: 'center', marginBottom: 32 }}>
<img src="/logo_full.png" alt="Bärenstarker Transport GmbH" style={{ height: <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Rechnungs-Manager · </div>
<form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap:
<div>
<label>E-Mail</label>
<input type="email" placeholder="ihre@email.com" value={email} onChange={e </div>
<div>
<label>Passwort</label>
<div style={{ position: 'relative' }}>
<input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={passwo
<button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'ab
{showPw ? ' ' : ' '}
</button>
</div>
</div>
{error && (
<div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 1
{error}
</div>
)}
<button type="submit" disabled={loading} style={{ background: 'linear-gradient(135d
{loading ? ' Anmelden…' : ' Anmelden'}
</button>
</form>
<p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 20 </div>
</div>
}}>Zug
)
}
function buildPrintHtml(inv) {
const quittung = inv.zahlstatus === 'Bezahlt'
const posTotal = pos => Number(pos.menge ?? pos.stunden ?? 0) * Number(pos.preis ?? pos.ans
const einheitLabel = pos => pos.einheit || (pos.ansatz ? 'Stunde' : 'Stück')
return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"/><title>${inv.docTyp} ${
<div class="toolbar"><button class="btn-print" id="btnPrint"> Print / PDF speichern</butt
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom
<div><img src="${window.location.origin}/logo_full.png" alt="Logo" style="height:65px;wid
<div style="text-align:right;font-size:11.5px;color:#555;line-height:1.9;"><p style="marg
</div>
${quittung?`<div class="green-box"><p style="font-weight:800;font-size:16px;color:#16a34a;"
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
<div style="font-size:12px;color:#555;line-height:2;">
<div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#
<div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#
<div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#
<div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#
<div style="display:flex;gap:8px;"><span style="font-weight:600;min-width:130px;color:#
</div>
<div style="font-size:13px;line-height:1.9;"><p style="color:#888;font-size:12px;">${inv.
</div>
<p style="font-weight:800;font-size:16px;border-bottom:1px solid #ddd;padding-bottom:6px;ma
<p style="font-size:13px;margin-bottom:20px;line-height:1.7;">Sehr geehrte${inv.anrede==='H
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
</tbody>
</table>
${inv.positionen.map((pos,idx)=>`<tr><td style="color:#888;">${idx+1}</td><td><strong>${p
<p style="font-size:11.5px;color:#666;margin-bottom:20px;">Alle Preise inkl. 8.1% MwSt. in
<div style="display:flex;justify-content:flex-end;margin-bottom:24px;"><div style="min-widt
<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px so
<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px so
<div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:800;fon
${quittung?`<div style="background:#dcfce7;border-radius:6px;padding:8px 12px;text-align:
</div></div>
<p style="font-size:13px;color:#555;margin-top:8px;">Besten Dank für Ihren Auftrag.</p>
<!-- FOOTER -->
<div style="margin-top:40px;border-top:2px solid #1a2744;padding-top:16px;">
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;font-size:11px;color:
<div>
<p style="font-weight:800;color:#1a2744;font-size:12px;margin-bottom:4px;">${CO.name}
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
<p style="text-align:center;margin-top:14px;font-size:11px;color:#9ca3af;font-style:itali
</div>
<script>document.getElementById('btnPrint').addEventListener('click',()=>window.print());do
</body></html>`
}
function buildMonthlySummaryHtml({ label, total, offen, bezahlt, methods }) {
const rows = Object.entries(methods||{}).map(([k,v])=>`<div style="display:flex;justify-con
return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"/><title>Monatsbilanz ${l
<div class="bar"><button class="btn-print" id="btnPrint"> Print / PDF speichern</button><
<div class="sheet">
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bott
<div><img src="/logo_full.png" alt="Logo" style="height:55px;width:auto;margin-bottom:6
<div style="text-align:right;font-size:11.5px;color:#555;line-height:1.9;"><p style="ma
</div>
<p style="font-size:22px;font-weight:800;color:#1a2744;margin-bottom:10px;">Monatsbilanz
<div class="cards">
<div class="card"><div style="color:#6b7280;font-size:12px;">Total</div><div style="fon
<div class="card"><div style="color:#6b7280;font-size:12px;">Bezahlt</div><div style="f
<div class="card"><div style="color:#6b7280;font-size:12px;">Offen</div><div style="fon
</div>
<div class="card" style="margin-bottom:16px;"><div style="font-weight:700;margin-bottom:8
</div>
<script>document.getElementById('btnPrint').addEventListener('click',()=>window.print());do
</body></html>`
}
function RechnungForm({ initial, onSave, onCancel }) {
const [docTyp, setDocTyp] = useState(initial?.docTyp || 'Rechnung')
const [nr, setNr] = useState(initial?.nr || genNr('Rechnung'))
const [datum, setDatum] = useState(initial?.datum || heute())
const [anrede, setAnrede] = useState(initial?.anrede || 'Herr')
const [kunde, setKunde] = useState(initial?.kunde || { name: '', strasse: '', plz: '', ort:
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
const ucp = (id, f, v) => setPositionen(p => p.map(i => i.id === id ? { ...i, [f]: v const addPos = () => setPositionen(p => [...p, emptyPos()])
const delPos = id => setPositionen(p => p.length > 1 ? p.filter(i => i.id !== id) : p)
const chgTyp = t => { setDocTyp(t); setNr(genNr(t)) }
} : i)
const netto = positionen.reduce((s, p) => s + Number(p.menge) * Number(p.preis), 0)
const mwst = netto * VAT
const brutto = netto + mwst
const handleSave = () => {
if (!kunde.name.trim()) { alert('Bitte Kundenname eingeben.'); return }
onSave({ id: initial?.id || Date.now(), docTyp, nr, datum, anrede, kunde, positionen, zah
}
return (
<div style={{ maxWidth: 760, margin: '0 auto', padding: '0 0 44px' }}>
<div style={{ background: 'linear-gradient(135deg,#1e2d4f,#2f4b88)', color: 'white', bo
<div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems:
<div>
<div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.12em', o
<h2 style={{ margin: '6px 0 0', fontSize: 24 }}>{initial ? 'Rechnung bearbeiten'
</div>
<div style={{ display: 'flex', gap: 10 }}>
<button onClick={onCancel} style={{ background: 'rgba(255,255,255,.12)', color: '
<button onClick={handleSave} style={{ background: '#f7c948', color: '#1e2d4f', pa
</div>
</div>
</div>
<div style={{ display: 'grid', gap: 16 }}>
<div className="card" style={{ borderRadius: 22 }}>
<p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform:
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }} class
<div><label>Dokumenttyp</label><select value={docTyp} onChange={e => chgTyp(e.tar
<div><label>Nummer</label><input value={nr} onChange={e => setNr(e.target.value)}
<div><label>Datum</label><input type="date" value={datum} onChange={e => setDatum
</div>
</div>
<div className="card" style={{ borderRadius: 22 }}>
<p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform:
<div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, marginBot
<div><label>Anrede</label><select value={anrede} onChange={e => setAnrede(e.targe
<div><label>Name / Firma</label><input placeholder="Vorname Nachname" value={kund
</div>
<div style={{ marginBottom: 12 }}><label>Strasse & Nr.</label><input placeholder="S
<div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
<div><label>PLZ</label><input placeholder="PLZ" value={kunde.plz} onChange={e =>
<div><label>Ort</label><input placeholder="Ort" value={kunde.ort} onChange={e =>
</div>
</div>
<div className="card" style={{ borderRadius: 22 }}>
<p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform:
{positionen.map((pos, idx) => (
<div key={pos.id} style={{ background: '#f8fafc', borderRadius: 18, padding: 16,
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'ce
<span style={{ fontSize: 12, fontWeight: 700, color: '#1a2744' }}>Position {i
<button className="btn-danger" onClick={() => delPos(pos.id)}>✕</button>
</div>
{/* Leistungsart + Beschreibung */}
<div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 10, margi
<div>
<label>Leistungsart</label>
<select value={pos.leistung} onChange={e => ucp(pos.id, 'leistung', e.targe
{LEISTUNGEN.map(l => <option key={l}>{l}</option>)}
</select>
</div>
<div>
<label>{pos.leistung === 'Sonstiges' ? 'Beschreibung (Pflicht)' : 'Beschrei
<input
placeholder={pos.leistung === 'Sonstiges' ? 'Was wurde gemacht?' : value={pos.beschreibung}
onChange={e => ucp(pos.id, 'beschreibung', e.target.value)}
style={{ borderColor: pos.leistung === 'Sonstiges' && !pos.beschreibung ?
'z.B.
/>
</div>
</div>
{/* Menge / Einheit / Preis / Total */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10
<div>
<label>Menge</label>
<input type="number" min="0" step="0.5" value={pos.menge} onChange={e => uc
</div>
<div>
<label>Einheit</label>
<select value={pos.einheit} onChange={e => ucp(pos.id, 'einheit', e.target.
{EINHEITEN.map(e => <option key={e}>{e}</option>)}
</select>
</div>
<div>
<label>Preis pro Einheit</label>
<input type="number" min="0" step="0.5" value={pos.preis} onChange={e => uc
</div>
<div>
<label>Total CHF</label>
<div style={{ padding: '9px 12px', background: 'white', border: '1px {fmtCHF(Number(pos.menge) * Number(pos.preis))}
</div>
</div>
</div>
</div>
solid
))}
</div>
<button onClick={addPos} style={{ marginTop: 4, border: '1px dashed #9ca3af', color
<div className="card" style={{ borderRadius: 22 }}>
<p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform:
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
<div><label>Zahlungsstatus</label><select value={zahlstatus} onChange={e => setZa
<div><label>Zahlungsart</label><select value={zahlart} onChange={e => setZahlart(
</div>
{zahlstatus === 'Bezahlt' && <div style={{ marginTop: 12, background: '#dcfce7', bo
</div>
<div className="card" style={{ borderRadius: 22, maxWidth: 340, marginLeft: 'auto' }}
<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fo
<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fo
<div style={{ borderTop: '2px solid #1a2744', paddingTop: 10, display: 'flex', just
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
const monate = Array.from(new Set(rechnungen.map(r => monthKey(r.datum)).filter(Boolean))).
const byStatus = filter === 'Alle' ? rechnungen : rechnungen.filter(r => r.zahlstatus === f
const filtered = filterMonat === 'Alle' ? byStatus : byStatus.filter(r => monthKey(r.datum)
const selectedMonth = filterMonat !== 'Alle' ? filterMonat : (monate[0] || null)
const selectedSummary = useMemo(() => {
if (!selectedMonth) return null
const rows = rechnungen.filter(r => monthKey(r.datum) === selectedMonth)
const total = rows.reduce((s, r) => s + (Number(r.brutto) || 0), 0)
const paid = rows.filter(r => r.zahlstatus === 'Bezahlt').reduce((s, r) => s + (Number(r.
const offenM = rows.filter(r => r.zahlstatus === 'Offen').reduce((s, r) => s + (Number(r.
const methods = rows.filter(r => r.zahlstatus === 'Bezahlt').reduce((acc, r) => { acc[r.z
return { label: monthLabel(selectedMonth), total, paid, offen: offenM, methods }
}, [rechnungen, selectedMonth])
const openPdf = () => { if (!selectedSummary) return; const w = window.open('','_blank','wi
const downloadAllPdf = () => {
const total = rechnungen.reduce((s,r)=>s+(Number(r.brutto)||0),0)
const paid = rechnungen.filter(r=>r.zahlstatus==='Bezahlt').reduce((s,r)=>s+(Number(r.bru
const offenM = rechnungen.filter(r=>r.zahlstatus==='Offen').reduce((s,r)=>s+(Number(r.bru
const methods = rechnungen.filter(r=>r.zahlstatus==='Bezahlt').reduce((acc,r)=>{acc[r.zah
const w = window.open('','_blank','width=1200,height=900'); w.document.write(buildMonthly
}
return (
<div style={{ maxWidth: 1120, margin: '0 auto' }}>
<div style={{ background: 'linear-gradient(135deg,#1e2d4f,#2f4b88)', color: 'white', bo
<div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems:
<div>
<div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.12em', o
<h2 style={{ margin: '6px 0 0', fontSize: 24 }}>Übersicht</h2>
</div>
</div>
</div>
<button onClick={onNeu} style={{ background: '#f7c948', color: '#1e2d4f', padding:
border
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBo
{[['Alle Dokumente', rechnungen.length, '#1a2744', ' '],['Offen', `${offen.length}
<div key={label} className="card" style={{ textAlign: 'center', padding: 18, <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
<p style={{ margin: 0, fontSize: 11, color: '#6b7280', fontWeight: 700, textTrans
<p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800, color }}>{val}</p>
</div>
))}
</div>
<div className="card" style={{ borderRadius: 22, marginBottom: 14 }}>
<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
<div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
{['Alle', 'Offen', 'Bezahlt'].map(f => (
<button key={f} onClick={() => setFilter(f)} style={{ background: filter ))}
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
=== f
{selectedSummary && (
<div className="card" style={{ borderRadius: 22, marginBottom: 14 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start'
<div>
<p style={{ margin: 0, fontWeight: 800, color: '#1a2744', fontSize: 18 }}>Monat
<p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>Total: {fmtCHF
</div>
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
{Object.entries(selectedSummary.methods).map(([m, sum]) => (
<div key={m} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', bor
<p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{m}</p>
<p style={{ margin: '4px 0 0', fontWeight: 800, color: '#1a2744' }}>{fmtCHF
</div>
))}
</div>
</div>
<div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
<button onClick={downloadAllPdf} style={{ background: '#1a2744', color: 'white',
</div>
</div>
)}
zu beg
{filtered.length === 0 ? (
<div className="card" style={{ textAlign: 'center', padding: 46, color: '#9ca3af', bo
<p style={{ fontSize: 40, marginBottom: 10 }}> </p>
<p style={{ fontWeight: 700 }}>Keine Dokumente gefunden</p>
<p style={{ fontSize: 13, marginTop: 4 }}>Klicken Sie auf «Neue Rechnung» um </div>
) : filtered.map(inv => (
<div key={inv.firestoreId} className="card" style={{ marginBottom: 10, padding: '14px
<div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
<div style={{ flex: 1, minWidth: 180 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
<span style={{ fontWeight: 800, fontSize: 14 }}>{inv.kunde.name || '—'}</span
<span className={`badge badge-${inv.zahlstatus === 'Bezahlt' ? 'paid' : 'open
</div>
<p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{inv.nr} · {fmtD(inv.d
<p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>{inv.positione
</div>
<div style={{ textAlign: 'right' }}>
<p style={{ margin: 0, fontWeight: 900, fontSize: 16, color: '#1a2744' }}>{fmtC
<p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>inkl. MwSt.</p
</div>
<div style={{ display: 'flex', gap: 6 }}>
<button onClick={() => onPrint(inv)} style={{ padding: '7px 12px', fontSize: 13
<button onClick={() => onEdit(inv)} style={{ padding: '7px 12px', fontSize: 13
<button className="btn-danger" onClick={() => onDelete(inv)} style={{ padding:
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
await addDoc(collection(db, 'rechnungen'), { ...inv, createdAt: new Date().toISOStrin
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
const handleLogout = async () => { await signOut(auth); setRechnungen([]); setScreen('overv
if (user === undefined) return (
<div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1e2d4f,#2f4b88)',
<div style={{ color: 'white', textAlign: 'center' }}><div style={{ fontSize: 48, </div>
margin
)
if (!user) return <LoginScreen />
return (
<div style={{ minHeight: '100vh', background: '#f4f6fb' }}>
<header style={{ background: 'linear-gradient(135deg,#1e2d4f,#2f4b88)', color: 'white',
<div style={{ maxWidth: 1120, margin: '0 auto', height: 64, display: 'flex', alignIte
<img src="/logo.png" alt="BT" style={{ height: 36, width: 'auto', filter: 'brightne
<div style={{ flex: 1 }}>
<p style={{ margin: 0, fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>Bärensta
<p style={{ margin: 0, fontSize: 11, opacity: 0.72 }}>Rechnungs-Manager</p>
</div>
{screen !== 'overview' && (
<button onClick={() => { setScreen('overview'); setEditInv(null) }} style={{ back
)}
</div>
</header>
<button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.12)', color
<div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '14px 20
<div style={{ maxWidth: 1120, margin: '0 auto' }}>
<h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1a2744' }}>
{screen === 'overview' && ' Übersicht'}{screen === 'new' && '+ Neue Rechnung'}{
</h1>
</div>
</div>
<main style={{ padding: '20px 16px', maxWidth: 1120, margin: '0 auto' }}>
{loading ? (
<div style={{ textAlign: 'center', padding: 70 }}><div style={{ fontSize: 40, margi
) : screen === 'overview' ? (
<Uebersicht rechnungen={rechnungen} onEdit={inv => { setEditInv(inv); setScreen('ed
) : (screen === 'new' || screen === 'edit') ? (
<RechnungForm initial={editInv} onSave={handleSave} onCancel={() => { setScreen('ov
) : null}
</main>
</div>
)
}