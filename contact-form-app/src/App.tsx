import { useState } from 'react';

const API_KEY = import.meta.env.VITE_HUBSPOT_API_KEY ?? '';
const APP_ID = 39193691;
const BATCH_SIZE = 100;

interface ContactForm {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
}

type Status = { type: 'idle' } | { type: 'loading' } | { type: 'success'; id: string } | { type: 'error'; message: string };
type LookupStatus = { type: 'idle' } | { type: 'loading' } | { type: 'success'; contact: Record<string, unknown> } | { type: 'error'; message: string };
type LineItemsStatus = { type: 'idle' } | { type: 'loading' } | { type: 'success'; items: Record<string, unknown>[] } | { type: 'error'; message: string };

export default function App() {
  const [form, setForm] = useState<ContactForm>({ firstname: '', lastname: '', email: '', phone: '' });
  const [status, setStatus] = useState<Status>({ type: 'idle' });
  const [lookupId, setLookupId] = useState('');
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>({ type: 'idle' });
  const [lineItemIds, setLineItemIds] = useState('');
  const [lineItemsStatus, setLineItemsStatus] = useState<LineItemsStatus>({ type: 'idle' });

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
      // Use batch read endpoint instead of individual GETs to avoid N+1 rate limiting.
      // HubSpot batch/read accepts up to 100 IDs per request.
      const allItems: Record<string, unknown>[] = [];

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        const res = await fetch('/api/hubspot/crm/v3/objects/line_items/batch/read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            inputs: chunk.map(id => ({ id })),
            properties: ['name', 'quantity', 'price', 'amount', 'hs_product_id'],
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setLineItemsStatus({ type: 'error', message: data.message ?? `HTTP ${res.status}` });
          return;
        }

        allItems.push(...(data.results ?? []));
      }

      setLineItemsStatus({ type: 'success', items: allItems });
    } catch (err) {
      setLineItemsStatus({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
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
          <h2 style={styles.title}>Get Deal Line Items</h2>

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
  success: { marginTop: 16, color: '#00a4bd', fontWeight: 600 },
  error: { marginTop: 16, color: '#f2545b', fontWeight: 600 },
  result: { marginTop: 16 },
  pre: { background: '#f5f8fa', border: '1px solid #e0e5ec', borderRadius: 4, padding: 12, fontSize: 12, overflowX: 'auto', marginTop: 8 },
};
