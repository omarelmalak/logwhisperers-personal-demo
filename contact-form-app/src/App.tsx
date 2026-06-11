import { useState } from 'react';

const API_KEY = import.meta.env.VITE_HUBSPOT_API_KEY ?? '';
const APP_ID = 39193691;

interface ContactForm {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
}

type Status = { type: 'idle' } | { type: 'loading' } | { type: 'success'; id: string } | { type: 'error'; message: string };
type LookupStatus = { type: 'idle' } | { type: 'loading' } | { type: 'success'; contact: Record<string, unknown> } | { type: 'error'; message: string };
type LineItemsStatus = { type: 'idle' } | { type: 'loading' } | { type: 'success'; items: Record<string, unknown>[] } | { type: 'error'; message: string };
type AnalyzeStatus = { type: 'idle' } | { type: 'loading' } | { type: 'success'; result: string } | { type: 'error'; message: string };

export default function App() {
  const [form, setForm] = useState<ContactForm>({ firstname: '', lastname: '', email: '', phone: '' });
  const [status, setStatus] = useState<Status>({ type: 'idle' });
  const [lookupId, setLookupId] = useState('');
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>({ type: 'idle' });
  const [lineItemIds, setLineItemIds] = useState('');
  const [lineItemsStatus, setLineItemsStatus] = useState<LineItemsStatus>({ type: 'idle' });

  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [analyzeRepo, setAnalyzeRepo] = useState('');
  const [analyzeBranch, setAnalyzeBranch] = useState('main');
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>({ type: 'idle' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: 'loading' });

    const properties: Record<string, string> = {};
    if (form.firstname) properties.firstname = form.firstname;
    if (form.lastname) properties.lastname = form.lastname;
    if (form.email) properties.email = form.email;
    if (form.phone) properties.phone = form.phone;

    try {
      const res = await fetch('/api/hubspot/crm/v3/objects/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ properties }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus({ type: 'error', message: data.message ?? `HTTP ${res.status}` });
        return;
      }

      setStatus({ type: 'success', id: data.id });
      setForm({ firstname: '', lastname: '', email: '', phone: '' });
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupId.trim()) return;
    setLookupStatus({ type: 'loading' });

    try {
      const res = await fetch(`/api/hubspot/crm/v3/objects/contacts/${encodeURIComponent(lookupId.trim())}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setLookupStatus({ type: 'error', message: data.message ?? `HTTP ${res.status}` });
        return;
      }

      setLookupStatus({ type: 'success', contact: data });
    } catch (err) {
      setLookupStatus({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const handleLineItemsLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const ids = lineItemIds.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return;
    setLineItemsStatus({ type: 'loading' });

    try {
      const items: Record<string, unknown>[] = [];
      for (const id of ids) {
        const res = await fetch(`/api/hubspot/crm/v3/objects/line_items/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${API_KEY}` },
        });

        const data = await res.json();

        if (!res.ok) {
          setLineItemsStatus({ type: 'error', message: `Line item ${id}: ${data.message ?? `HTTP ${res.status}`}` });
          return;
        }

        items.push(data);
      }
      setLineItemsStatus({ type: 'success', items });
    } catch (err) {
      setLineItemsStatus({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const handleAnalyze = async () => {
    if (!analyzeRepo.trim() || !analyzeBranch.trim()) return;
    setAnalyzeStatus({ type: 'loading' });

    try {
      const res = await fetch('/api/logwhisperers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: analyzeRepo.trim(),
          branch: analyzeBranch.trim(),
          pattern: 'line_items_n_plus_one',
          appId: APP_ID,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAnalyzeStatus({ type: 'error', message: data.message ?? `HTTP ${res.status}` });
        return;
      }

      setAnalyzeStatus({ type: 'success', result: data.prUrl ?? 'Analysis complete' });
    } catch (err) {
      setAnalyzeStatus({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.col}>
        <div style={styles.card}>
          <h1 style={styles.title}>Add HubSpot Contact</h1>

          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>First name
              <input name="firstname" value={form.firstname} onChange={handleChange} style={styles.input} />
            </label>
            <label style={styles.label}>Last name
              <input name="lastname" value={form.lastname} onChange={handleChange} style={styles.input} />
            </label>
            <label style={styles.label}>Email *
              <input name="email" type="email" required value={form.email} onChange={handleChange} style={styles.input} />
            </label>
            <label style={styles.label}>Phone
              <input name="phone" type="tel" value={form.phone} onChange={handleChange} style={styles.input} />
            </label>

            <button type="submit" disabled={status.type === 'loading'} style={styles.button}>
              {status.type === 'loading' ? 'Adding...' : 'Add Contact'}
            </button>
          </form>

          {status.type === 'success' && (
            <p style={styles.success}>Contact created! ID: {status.id}</p>
          )}
          {status.type === 'error' && (
            <p style={styles.error}>Error: {status.message}</p>
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.title}>Get Contact by ID</h2>

          <form onSubmit={handleLookup} style={styles.form}>
            <label style={styles.label}>Contact ID
              <input
                value={lookupId}
                onChange={e => setLookupId(e.target.value)}
                placeholder="e.g. 12345"
                style={styles.input}
              />
            </label>
            <button type="submit" disabled={lookupStatus.type === 'loading'} style={{ ...styles.button, background: '#0091ae' }}>
              {lookupStatus.type === 'loading' ? 'Looking up...' : 'Get Contact'}
            </button>
          </form>

          {lookupStatus.type === 'success' && (
            <div style={styles.result}>
              <p style={styles.success}>Found contact</p>
              <pre style={styles.pre}>{JSON.stringify(lookupStatus.contact, null, 2)}</pre>
            </div>
          )}
          {lookupStatus.type === 'error' && (
            <p style={styles.error}>Error: {lookupStatus.message}</p>
          )}
        </div>

        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ ...styles.title, margin: 0 }}>Get Deal Line Items</h2>
            <button
              onClick={() => setAnalyzeOpen(true)}
              style={styles.analyzeButton}
            >
              Analyze with LogWhisperers
            </button>
          </div>

          <form onSubmit={handleLineItemsLookup} style={styles.form}>
            <label style={styles.label}>Line Item IDs (comma-separated)
              <input
                value={lineItemIds}
                onChange={e => setLineItemIds(e.target.value)}
                placeholder="e.g. 101, 102, 103"
                style={styles.input}
              />
            </label>
            <button type="submit" disabled={lineItemsStatus.type === 'loading'} style={{ ...styles.button, background: '#516f90' }}>
              {lineItemsStatus.type === 'loading' ? 'Fetching...' : 'Get Line Items'}
            </button>
          </form>

          {lineItemsStatus.type === 'success' && (
            <div style={styles.result}>
              <p style={styles.success}>Found {lineItemsStatus.items.length} line items</p>
              <pre style={styles.pre}>{JSON.stringify(lineItemsStatus.items, null, 2)}</pre>
            </div>
          )}
          {lineItemsStatus.type === 'error' && (
            <p style={styles.error}>Error: {lineItemsStatus.message}</p>
          )}
        </div>
      </div>

      {analyzeOpen && (
        <div style={styles.overlay} onClick={() => setAnalyzeOpen(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#33475b' }}>Analyze with LogWhisperers</h2>
              <button onClick={() => setAnalyzeOpen(false)} style={styles.closeButton}>&times;</button>
            </div>
            <p style={{ color: '#516f90', fontSize: 14, marginBottom: 20 }}>
              LogWhisperers will scan your repository for the N+1 line items pattern,
              generate a batch read fix, and open a pull request with the corrected code.
            </p>
            <div style={styles.form}>
              <label style={styles.label}>
                Repository
                <input
                  value={analyzeRepo}
                  onChange={e => setAnalyzeRepo(e.target.value)}
                  placeholder="your-org/your-repo"
                  style={styles.input}
                />
              </label>
              <label style={styles.label}>
                Branch
                <input
                  value={analyzeBranch}
                  onChange={e => setAnalyzeBranch(e.target.value)}
                  placeholder="main"
                  style={styles.input}
                />
              </label>

              {analyzeStatus.type === 'success' && (
                <p style={styles.success}>
                  PR created: <a href={analyzeStatus.result} target="_blank" rel="noopener noreferrer">{analyzeStatus.result}</a>
                </p>
              )}
              {analyzeStatus.type === 'error' && (
                <p style={styles.error}>Error: {analyzeStatus.message}</p>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={() => { setAnalyzeOpen(false); setAnalyzeStatus({ type: 'idle' }); }}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={!analyzeRepo.trim() || analyzeStatus.type === 'loading'}
                  style={{
                    ...styles.button,
                    background: analyzeRepo.trim() ? '#00a4bd' : '#cbd6e2',
                    padding: '10px 24px',
                    marginTop: 0,
                  }}
                >
                  {analyzeStatus.type === 'loading' ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f8fa', fontFamily: 'sans-serif', padding: 24 },
  col: { display: 'flex', flexDirection: 'column', gap: 24, width: 420 },
  card: { background: '#fff', borderRadius: 8, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' },
  title: { margin: '0 0 24px', fontSize: 20, color: '#33475b' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, fontWeight: 600, color: '#33475b' },
  input: { padding: '8px 12px', border: '1px solid #cbd6e2', borderRadius: 4, fontSize: 14, outline: 'none' },
  button: { marginTop: 8, padding: '10px 0', background: '#ff7a59', color: '#fff', border: 'none', borderRadius: 4, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  analyzeButton: { padding: '6px 14px', background: '#00a4bd', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  success: { marginTop: 16, color: '#00a4bd', fontWeight: 600 },
  error: { marginTop: 16, color: '#f2545b', fontWeight: 600 },
  result: { marginTop: 16 },
  pre: { background: '#f5f8fa', border: '1px solid #e0e5ec', borderRadius: 4, padding: 12, fontSize: 12, overflowX: 'auto', marginTop: 8 },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 8, padding: 32, width: 440, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  closeButton: { background: 'none', border: 'none', fontSize: 24, color: '#516f90', cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
  cancelButton: { padding: '10px 24px', background: 'none', color: '#516f90', border: '1px solid #cbd6e2', borderRadius: 4, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
};
