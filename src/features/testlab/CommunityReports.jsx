import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export const CommunityReports = () => {
  const [reports, setReports] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api.get('/people/reports').then(value => { if (active) setReports(value); }).catch(err => { if (active) setError(err.message); }); return () => { active = false; }; }, []);
  const review = async id => { if (busy) return; setBusy(true); setError(''); try { await api.post(`/people/reports/${id}/review`, {}); setReports(await api.get('/people/reports')); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <section className="founder-card"><h2>Community reports</h2><p>Review reports here. Marking one reviewed records your review; it does not change either account.</p>{reports?.map(report => <article key={report._id} style={{ padding: '20px 0', borderBottom: '1px solid var(--border-subtle)' }}><strong>@{report.reporterId?.username || 'unknown'} reported @{report.targetId?.username || 'unknown'}</strong><p>{report.reason} · {new Date(report.createdAt).toLocaleString()}</p><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report.note}</p><button type="button" className="people-text-button" disabled={busy} onClick={() => void review(report._id)}>Mark reviewed</button></article>)}{reports?.length === 0 && <p>No reports waiting.</p>}{!reports && !error && <p role="status">Loading reports…</p>}{error && <p role="alert">{error}</p>}</section>;
};
