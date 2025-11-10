// src/App.jsx
import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, serverTimestamp, getDoc, collection, query, orderBy, onSnapshot
} from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig"; // create this file with real values

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Use env var if set (Vite)
const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbzVK9p44w2qIB4zxTK-pEjxNEfzpL1GrCpVsVrYGLELQ9BbSdLGvKEm0GvdQesqW2QZ/exec";

const defaultForm = () => ({
  agentName: "",
  channel: "Call",
  conversationId: "",
  cxType: "Enquiry",
  simFlow: "Psim-esim",
  cxName: "",
  cxEmail: "",
  cxAddress: "",
  mdn: "",
  mno: "VZW",
  issueDescription: "",
  error: "",
  deviceModel: "",
  imeiMode: "IMEI 1",
  imei1: "",
  imei2: "",
  existingOrNew: "",
  planDetails: "",
  troubleshooting: [],
  simType: "",
  otaRegistered: "No",
  apnReset: "No",
  newApnSent: "No",
  iphoneReset: "No",
  simInserted: "",
  deviceChange: "No",
  newDeviceImei: "",
  issueLocation: "Home",
  paymentInvoiceShared: false,
  status: "Open",
  tsUpdate: "",
  extraFields: []
});

export default function App() {
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem("infimobile_draft");
    return saved ? JSON.parse(saved) : defaultForm();
  });
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState([]);
  const [duplicate, setDuplicate] = useState(null);

  useEffect(() => {
    // Firestore realtime listener for entries (for admin console)
    const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEntries(rows);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // autosave
    localStorage.setItem("infimobile_draft", JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    // local duplicate detection: check existing entries in Firestore (from state)
    if (!form.mdn && !form.conversationId) return setDuplicate(null);
    const found = entries.find(e => (form.mdn && e.mdn === form.mdn) || (form.conversationId && e.conversationId === form.conversationId));
    setDuplicate(found || null);
  }, [form.mdn, form.conversationId, entries]);

  function setField(k, v) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function addExtraField(label = "Note") {
    setForm(prev => ({ ...prev, extraFields: [...prev.extraFields, { id: `x_${Date.now()}`, label, value: "" }] }));
  }
  function setExtraValue(id, value) {
    setForm(prev => ({ ...prev, extraFields: prev.extraFields.map(x => x.id === id ? { ...x, value } : x) }));
  }

  function validate() {
    if (form.mdn && !/^\d{10}$/.test(form.mdn)) {
      alert("MDN must be 10 digits");
      return false;
    }
    return true;
  }

  async function submitToFirestore(payload) {
    // deterministic doc id
    let docId = payload.mdn ? `mdn_${payload.mdn}` : (payload.conversationId ? `conv_${payload.conversationId}` : `auto_${Date.now()}`);
    const ref = doc(db, "submissions", docId);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      // append update subcollection
      const updateId = `u_${Date.now()}`;
      const updateRef = doc(db, `submissions/${docId}/updates`, updateId);
      await setDoc(updateRef, {
        notes: payload.tsUpdate || "",
        updatedAt: serverTimestamp(),
        agent: payload.agentName || ""
      });
      return { duplicate: true, id: docId };
    }
    await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
    return { ok: true, id: docId };
  }

  async function handleSubmit(e) {
    e && e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const payload = { ...form };

    // 1) POST to Google Apps Script (Sheet)
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn("Sheet post failed:", err);
    }

    // 2) Write to Firestore
    try {
      const res = await submitToFirestore(payload);
      if (res.duplicate) {
        // show message to user/admin
        if (!confirm("A record exists with same MDN/ConversationID. Append update?")) {
          setSubmitting(false);
          return;
        }
      }
    } catch (err) {
      console.error("Firestore error:", err);
    }

    // Save local entry list for export
    setEntries(prev => [{ ...payload, submittedAt: new Date().toISOString() }, ...prev]);

    // Reset draft & form
    localStorage.removeItem("infimobile_draft");
    setForm(defaultForm());
    setSubmitting(false);
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(JSON.stringify(form, null, 2)).then(() => alert("Copied to clipboard"));
  }

  function exportCSV() {
    const keys = ["agentName","channel","conversationId","cxType","simFlow","cxName","cxEmail","cxAddress","mdn","mno","issueDescription","deviceModel","imeiMode","imei1","imei2","status","tsUpdate"];
    const rows = entries.map(r => keys.map(k => JSON.stringify(r[k] || "")).join(","));
    const csv = [keys.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "infimobile_entries.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div style={{ fontFamily: "Inter, Arial", minHeight: "100vh", background: "#000", color: "#fff", padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", background: "rgba(0,0,0,0.6)", padding: 18, borderRadius: 12 }}>
        <h1>INFIMOBILE — Live Form</h1>
        {duplicate && <div style={{ background: "rgba(255,0,0,0.08)", padding: 10, borderRadius: 8 }}>
          Duplicate detected: existing id {duplicate.id || duplicate.docId}
          <button onClick={() => { setForm(duplicate); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ marginLeft: 8 }}>Load</button>
        </div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>Agent Name<input value={form.agentName} onChange={e => setField("agentName", e.target.value)} /></label>
            <label>Channel<select value={form.channel} onChange={e => setField("channel", e.target.value)}><option>Call</option><option>Chat</option><option>Email</option></select></label>

            <label>Conversation ID<input value={form.conversationId} onChange={e => setField("conversationId", e.target.value)} /></label>
            <label>CX Type<select value={form.cxType} onChange={e => setField("cxType", e.target.value)}><option>Enquiry</option><option>Simswap</option><option>NetworkSwap</option><option>Service</option></select></label>

            <label>Sim Flow<select value={form.simFlow} onChange={e => setField("simFlow", e.target.value)}><option>Psim-esim</option><option>Esim-Esim</option></select></label>
            <label>Customer Name<input value={form.cxName} onChange={e => setField("cxName", e.target.value)} /></label>

            <label>Customer Email<input value={form.cxEmail} onChange={e => setField("cxEmail", e.target.value)} /></label>
            <label>Address<input value={form.cxAddress} onChange={e => setField("cxAddress", e.target.value)} /></label>

            <label>MDN<input value={form.mdn} onChange={e => setField("mdn", e.target.value)} placeholder="10 digits" maxLength={10}/></label>
            <label>MNO<select value={form.mno} onChange={e => setField("mno", e.target.value)}><option>VZW</option><option>PWG</option></select></label>

            <label>Issue Description<textarea value={form.issueDescription} onChange={e => setField("issueDescription", e.target.value)} /></label>
            <label>Device Model<input value={form.deviceModel} onChange={e => setField("deviceModel", e.target.value)} /></label>

            <label>IMEI Mode<select value={form.imeiMode} onChange={e => setField("imeiMode", e.target.value)}><option>IMEI 1</option><option>IMEI 2</option><option>Both</option></select></label>
            <label>IMEI1<input value={form.imei1} onChange={e => setField("imei1", e.target.value)} /></label>

            <label>IMEI2<input value={form.imei2} onChange={e => setField("imei2", e.target.value)} /></label>
            <label>Status<select value={form.status} onChange={e => setField("status", e.target.value)}><option>Open</option><option>Closed</option></select></label>

            <label>TS Update<textarea value={form.tsUpdate} onChange={e => setField("tsUpdate", e.target.value)} /></label>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <button type="submit" disabled={submitting} style={{ padding: "8px 12px" }}>{submitting ? "Submitting..." : "Submit"}</button>
            <button type="button" onClick={() => { localStorage.removeItem("infimobile_draft"); setForm(defaultForm()); }} style={{ padding: "8px 12px" }}>Reset</button>
            <button type="button" onClick={copyToClipboard} style={{ padding: "8px 12px" }}>Copy JSON</button>
            <button type="button" onClick={exportCSV} style={{ padding: "8px 12px" }}>Export CSV</button>
            <button type="button" onClick={() => addExtraField("Extra")} style={{ padding: "8px 12px" }}>Add Field</button>
          </div>
        </form>

        <div style={{ marginTop: 18 }}>
          <h3>Recent submissions (Firestore)</h3>
          <div style={{ maxHeight: 220, overflow: "auto", background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 8 }}>
            {entries.map((r, i) => (
              <div key={i} style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <div><strong>{r.cxName || r.agentName || "—"}</strong> • {r.mdn || r.conversationId}</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>{r.issueDescription}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
