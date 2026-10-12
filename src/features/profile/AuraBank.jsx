import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Landmark, ShieldCheck } from 'lucide-react';
import { Button } from '../../shared/components/Button';
import { Modal } from '../../shared/components/Modal';
import { changeAuraBank, getAuraBank } from '../../services/auraBankService';
import './AuraBank.css';

export const AuraBank = ({ userId, walletBalance, onChanged }) => {
  const [bank, setBank] = useState(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const version = useRef(0);
  const ownerVersion = useRef(0);
  const retry = useRef(null);
  const load = useCallback(async () => {
    const request = ++version.current;
    try { const data = await getAuraBank(); if (alive.current && request === version.current) { setBank(data); setError(''); } }
    catch (failure) { if (alive.current && request === version.current) setError(failure.message); }
  }, []);
  useEffect(() => { alive.current = true; ownerVersion.current += 1; busyRef.current = false; retry.current = null; setBusy(false); setDialog(null); setBank(null); return () => { alive.current = false; version.current += 1; }; }, [userId]);
  useEffect(() => { if (!busyRef.current) void load(); }, [userId, walletBalance, load]);
  useEffect(() => {
    if (!dialog || !window.visualViewport) return undefined;
    const viewport = window.visualViewport, root = document.documentElement;
    const update = () => { if (viewport.scale === 1) { root.style.setProperty('--bank-viewport-height', `${viewport.height}px`); root.style.setProperty('--bank-viewport-top', `${viewport.offsetTop}px`); } };
    update(); viewport.addEventListener('resize', update); viewport.addEventListener('scroll', update);
    return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update); root.style.removeProperty('--bank-viewport-height'); root.style.removeProperty('--bank-viewport-top'); };
  }, [dialog]);
  const open = action => { setDialog(action); setAmount(action === 'borrow' ? 50 : Math.min(bank.outstanding, bank.balance)); retry.current = null; setError(''); };
  const submit = async event => {
    event.preventDefault(); if (busyRef.current) return;
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0) return setError('Choose a whole-Aura amount greater than zero.');
    if (!retry.current || retry.current.action !== dialog || retry.current.amount !== value) retry.current = { action: dialog, amount: value, id: crypto.randomUUID() };
    busyRef.current = true; version.current += 1; setBusy(true); setError('');
    const owner = ownerVersion.current;
    try {
      const result = await changeAuraBank(dialog, value, retry.current.id);
      if (!alive.current || owner !== ownerVersion.current) return;
      setBank(result.bank); setDialog(null); retry.current = null; void onChanged?.();
    } catch (failure) { if (alive.current && owner === ownerVersion.current) { setError(failure.message); if (failure.status === 409) void load(); } }
    finally { if (owner === ownerVersion.current) { busyRef.current = false; if (alive.current) setBusy(false); } }
  };
  return <section className="aura-bank" aria-label="Aura bank">
    <header><span className="aura-bank-mark"><Landmark size={24} /></span><div><p className="eyebrow">Aura bank</p><h2>A little room to move.</h2></div><span className="aura-bank-interest">0% interest</span></header>
    {!bank ? <div className="aura-bank-loading" role="status">{error || 'Opening your bank…'}{error && <button type="button" onClick={() => void load()}>Retry</button>}</div> : <>
      <div className="aura-bank-numbers"><div><span>{bank.outstanding ? 'Left to repay' : bank.eligible ? 'Available loan' : 'Loan limit'}</span><strong>{bank.outstanding || bank.maxLoan}<small>Aura</small></strong></div><div><span>Your balance</span><strong>{bank.balance}<small>Aura</small></strong></div></div>
      <p className="aura-bank-copy">{bank.outstanding ? 'Half of new daily, Chaos, and bounty earnings repay your loan. The rest stays yours.' : 'Borrow 25, 50, or 100 Aura when you need a small boost. Repay from future play or your balance.'}</p>
      {bank.reason && <p className="aura-bank-rule">{bank.reason}{bank.nextBorrowAt && new Date(bank.nextBorrowAt) > new Date() && <span>Opens {new Date(bank.nextBorrowAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.</span>}</p>}
      <div className="aura-bank-actions">{bank.outstanding ? <Button variant="aura" icon={ArrowUpRight} disabled={bank.balance < 1} onClick={() => open('repay')}>Repay Aura</Button> : <Button variant="aura" icon={ArrowDownLeft} disabled={!bank.eligible} onClick={() => open('borrow')}>Borrow Aura</Button>}<small><ShieldCheck size={13} />Your bank balance stays private.</small></div>
      <p className="aura-bank-terms">One loan at a time · Seven days between loans · Borrowing never raises your Aura rank</p>
    </>}
    {dialog && <Modal isOpen title={dialog === 'borrow' ? 'Your Aura loan, clearly' : 'Repay your Aura loan'} onClose={() => { if (!busy) setDialog(null); }} initialFocusSelector={dialog === 'repay' ? 'input' : 'button[aria-pressed="true"]'}><form className="aura-bank-form" onSubmit={submit}>
      {dialog === 'borrow' ? <><div className="aura-bank-choices" role="group" aria-label="Loan amount">{bank.amounts.map(value => <button type="button" key={value} aria-pressed={Number(amount) === value} disabled={busy} onClick={() => setAmount(value)}>{value}<small>Aura</small></button>)}</div><dl><div><dt>You receive now</dt><dd>{amount} Aura</dd></div><div><dt>Total to repay</dt><dd>{amount} Aura</dd></div><div><dt>Interest and fees</dt><dd>0 Aura</dd></div></dl><p>Half of future daily bonuses, Chaos bonuses, and bounty rewards repays this loan, rounded up to whole Aura. Refunds and returned bonds stay untouched. You can repay early, and there is no growing interest or deadline penalty.</p></> : <><label htmlFor="aura-bank-repay">Aura to repay</label><input id="aura-bank-repay" type="number" min="1" max={Math.min(bank.outstanding, bank.balance)} step="1" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} /><p>{bank.outstanding} Aura remaining · {bank.balance} Aura available</p><dl><div><dt>After this repayment</dt><dd>{Math.max(0, bank.outstanding - Number(amount || 0))} Aura owed</dd></div></dl></>}
      {error && <p className="aura-bank-error" role="alert">{error}</p>}<div className="aura-bank-form-actions"><Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</Button><Button variant="aura" type="submit" loading={busy}>{dialog === 'borrow' ? `Borrow ${amount} Aura` : `Repay ${amount || 0} Aura`}</Button></div>
    </form></Modal>}
  </section>;
};
