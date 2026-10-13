import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Circle, Landmark, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '../../shared/components/Button';
import { Modal } from '../../shared/components/Modal';
import { changeAuraBank, getAuraBank } from '../../services/auraBankService';
import { playGameSound } from '../../lib/gameSounds';
import { clearBankRetry, readBankRetry, saveBankRetry } from '../../lib/auraBankRetry';
import './AuraBank.css';

const date = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const RETRY_MESSAGE = 'Your last request still needs confirmation. Retry it safely before starting another.';
export const AuraBank = ({ userId, walletBalance, onChanged, onExploreDuo }) => {
  const [bank, setBank] = useState(null), [error, setError] = useState('');
  const [dialog, setDialog] = useState(null), [amount, setAmount] = useState(25), [busy, setBusy] = useState(false);
  const busyRef = useRef(false), alive = useRef(true), version = useRef(0), ownerVersion = useRef(0), retry = useRef(null);
  const load = useCallback(async () => {
    const request = ++version.current;
    try { const data = await getAuraBank(); if (alive.current && request === version.current) { setBank(data); setError(current => retry.current ? current : ''); } }
    catch (failure) { if (alive.current && request === version.current) setError(failure.message || 'Could not open your bank.'); }
  }, []);
  useEffect(() => { alive.current = true; ownerVersion.current += 1; busyRef.current = false; retry.current = readBankRetry(userId); setBusy(false); setDialog(null); setBank(null); setError(retry.current ? RETRY_MESSAGE : ''); return () => { alive.current = false; version.current += 1; }; }, [userId]);
  useEffect(() => { if (!busyRef.current) void load(); }, [userId, walletBalance, load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && !busyRef.current) void load(); };
    const timer = setInterval(refresh, 60000); window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  const open = (action, preset = null) => {
    if (retry.current) {
      setDialog(retry.current.action); setAmount(retry.current.amount); setError(RETRY_MESSAGE); return;
    }
    setDialog(action); setAmount(preset ?? (action === 'borrow' ? Math.min(50, bank.maxLoan) : Math.min(bank.outstanding, bank.balance)));
    setError('');
  };
  const submit = async event => {
    event.preventDefault(); if (busyRef.current) return;
    const value = Number(amount);
    const confirming = retry.current?.action === dialog && retry.current?.amount === value;
    if (!Number.isSafeInteger(value) || value <= 0 || !confirming && dialog === 'repay' && value > Math.min(bank.outstanding, bank.balance)) return setError('Choose a whole-Aura amount within your available balance and remaining loan.');
    if (retry.current && !confirming) return setError(RETRY_MESSAGE);
    if (!retry.current) {
      retry.current = { action: dialog, amount: value, id: crypto.randomUUID() };
      saveBankRetry(userId, retry.current);
    }
    busyRef.current = true; version.current += 1; setBusy(true); setError('');
    const owner = ownerVersion.current, soundId = retry.current.id;
    try {
      const result = await changeAuraBank(dialog, value, retry.current.id);
      if (!alive.current || owner !== ownerVersion.current) return;
      setBank(result.bank); setDialog(null); retry.current = null; clearBankRetry(userId); playGameSound('bank', userId, soundId); void onChanged?.();
    } catch (failure) { if (alive.current && owner === ownerVersion.current) { if ([400, 409].includes(failure.status)) { retry.current = null; clearBankRetry(userId); } setError(failure.message || RETRY_MESSAGE); if (failure.status === 409) void load(); } }
    finally { if (owner === ownerVersion.current) { busyRef.current = false; if (alive.current) setBusy(false); } }
  };
  const repaymentMax = bank ? Math.min(bank.outstanding, bank.balance) : 0;
  const presets = bank ? [...new Map([
    { amount: Math.min(25, repaymentMax), label: '25 Aura' },
    { amount: Math.ceil(bank.outstanding / 2), label: 'Half the loan' },
    { amount: repaymentMax, label: repaymentMax === bank.outstanding ? 'Clear the loan' : 'Use my balance' }
  ].filter(value => value.amount > 0 && value.amount <= repaymentMax).map(value => [value.amount, { ...value, label: value.label === '25 Aura' ? `${value.amount} Aura` : value.label }])).values()] : [];
  const confirming = Boolean(retry.current?.action === dialog && retry.current?.amount === Number(amount));
  const valid = Number.isSafeInteger(Number(amount)) && Number(amount) > 0 && (confirming || (dialog === 'borrow' ? bank?.eligible && bank?.amounts.includes(Number(amount)) : Number(amount) <= repaymentMax));
  return <section className="aura-bank" aria-label="Aura bank">
    <header><span className="aura-bank-mark"><Landmark size={23} strokeWidth={1.5} /></span><div><p className="eyebrow">HAKOWARE / AURA BANK</p><h2>A little room to move.</h2></div><span className="aura-bank-interest">0% interest</span></header>
    {!bank ? <div className="aura-bank-loading" role="status">{error || 'Opening your bank…'}{error && <button type="button" onClick={() => void load()}>Retry</button>}</div> : <>
      <div className={`aura-bank-hero ${bank.outstanding ? 'has-loan' : ''}`}>
        <div className="aura-bank-credit"><span className="aura-bank-tier"><Sparkles size={13} />{bank.tier?.name || 'Starter'} credit</span><span className="aura-bank-number-label">{bank.outstanding ? 'Left to repay' : 'Your earned loan limit'}</span><strong className="aura-bank-credit-number">{bank.outstanding || bank.maxLoan}<small>Aura</small></strong><p>{bank.outstanding ? 'One step closer to clear.' : bank.eligible ? 'A small boost. On your terms.' : 'Your next boost starts here.'}</p></div>
        <div className="aura-bank-wallet"><span>Your wallet</span><strong>{bank.balance}<small>Aura</small></strong><small>Available for cards and play.</small></div>
        <div className="aura-bank-private"><ShieldCheck size={13} />Your loan details stay private.</div>
      </div>
      {bank.outstanding > 0 ? <div className="aura-bank-repayment">
        <div className="aura-bank-progress-heading"><strong>Your way back</strong><span>{bank.principal ? `${bank.repaid} of ${bank.principal} Aura repaid` : `${bank.outstanding} Aura remaining`}</span></div>
        {bank.repaymentProgress !== null && bank.repaymentProgress !== undefined && <div className="aura-bank-progress" role="progressbar" aria-label="Loan repaid" aria-valuenow={bank.repaymentProgress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${bank.repaymentProgress}%` }} /></div>}
        <div className="aura-bank-autopay"><span>50% of eligible earnings</span><ArrowUpRight size={15} /><strong>Automatic repayment</strong></div>
        <p className="aura-bank-copy">Daily bonuses, Chaos bonuses, and bounty rewards chip away at your loan. On a 10 Aura reward, {Math.min(5, bank.outstanding)} repays it and {10 - Math.min(5, bank.outstanding)} stays in your wallet.</p>
        <div className="aura-bank-actions"><Button variant="aura" icon={ArrowUpRight} disabled={repaymentMax < 1} onClick={() => open('repay')}>Repay Aura</Button>{repaymentMax < 1 && <small>Keep playing; automatic repayments still work.</small>}</div>
        {presets.length > 0 && <div className="aura-bank-quick" role="group" aria-label="Quick repayment choices">{presets.map(preset => <button type="button" key={preset.amount} aria-label={`Review repayment of ${preset.amount} Aura`} onClick={() => open('repay', preset.amount)}>{preset.label}<span>{preset.amount} Aura <ArrowUpRight size={12} /></span></button>)}</div>}
      </div> : <div className="aura-bank-borrow-panel"><div><h3>{bank.eligible ? 'Pick your boost.' : 'Build a little trust.'}</h3><p className="aura-bank-copy">{bank.eligible ? 'Borrow a little now. Future earnings help you pay it back.' : bank.reason}</p></div><Button variant="aura" icon={ArrowDownLeft} disabled={!bank.eligible} onClick={() => open('borrow')}>Borrow Aura</Button>{!bank.checks?.find(check => check.id === 'duo')?.done && onExploreDuo && <button className="aura-bank-duo-link" type="button" onClick={onExploreDuo}>Go to your Circle <ArrowUpRight size={14} /></button>}</div>}
      <div className="aura-bank-tier-heading"><h3>More trust. More room.</h3><span>{bank.completedLoans || 0} {(bank.completedLoans || 0) === 1 ? 'loan' : 'loans'} repaid</span></div>
      <ol className="aura-bank-tiers">{(bank.tiers || []).map(tier => <li key={tier.id} className={`${tier.unlocked ? 'is-earned' : ''} ${bank.tier?.id === tier.id ? 'is-current' : ''}`} aria-current={bank.tier?.id === tier.id ? 'step' : undefined}><span>{tier.unlocked ? <Check size={13} /> : <LockKeyhole size={13} />}{tier.name}</span><strong>{tier.limit}<small>Aura</small></strong><p>{tier.requirement}</p></li>)}</ol>
      <details className="aura-bank-eligibility"><summary><span>{bank.outstanding ? 'Your next loan checklist' : bank.eligible ? 'You’re ready to borrow' : 'What unlocks borrowing?'}</span><ChevronDown size={16} /></summary><ul>{(bank.checks || []).map(check => <li key={check.id} className={check.done ? 'is-done' : ''}>{check.done ? <Check size={15} /> : <Circle size={15} />}<span>{check.label}{check.id === 'cooldown' && !check.done && <small>Opens {date(bank.nextBorrowAt)}.</small>}</span><small>{check.done ? 'Done' : 'Needed'}</small></li>)}</ul></details>
      {bank.recent?.length > 0 && <div className="aura-bank-recent"><h3>Bank activity</h3>{bank.recent.slice(0, 3).map(event => <div key={event.id}><span>{event.kind === 'BORROW' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span><div><strong>{event.kind === 'BORROW' ? 'Loan received' : event.kind === 'AUTOPAY' ? 'Repaid from earnings' : 'Early repayment'}</strong><small>{date(event.createdAt)}</small></div><b>{event.amount}<small>Aura</small></b></div>)}</div>}
      {retry.current && !dialog && <p className="aura-bank-retry-note" role="status">{RETRY_MESSAGE}<button type="button" onClick={() => open(retry.current.action)}>Confirm last request</button></p>}
      {error && !dialog && !retry.current && <p className="aura-bank-error" role="alert">{error}<button type="button" onClick={() => void load()}>Refresh bank</button></p>}
      <p className="aura-bank-terms">One loan at a time · Seven days between loans · No fees or deadline penalties · Borrowing never raises your Aura rank</p>
    </>}
    {dialog && <Modal isOpen title={dialog === 'borrow' ? 'Your interest-free boost' : 'A little closer to clear'} onClose={() => { if (!busy) setDialog(null); }} initialFocusSelector={confirming ? 'button[type="submit"]' : dialog === 'repay' ? 'input' : 'button[aria-pressed="true"]'}><form className="aura-bank-form" onSubmit={submit}>
      {confirming && <p className="aura-bank-retry-note">Retry this amount to confirm the last request. A completed payment or loan won’t run twice.</p>}
      {dialog === 'borrow' ? <><p className="aura-bank-form-lead">Your {bank.tier?.name} limit is {bank.maxLoan} Aura. Choose only what you need.</p><div className="aura-bank-choices" role="group" aria-label="Loan amount">{bank.amounts.map(value => <button type="button" key={value} aria-pressed={Number(amount) === value} disabled={busy || confirming} onClick={() => setAmount(value)}>{value}<small>Aura</small></button>)}</div><dl><div><dt>{confirming ? 'Current wallet' : 'Wallet after borrowing'}</dt><dd>{confirming ? bank.balance : bank.balance + Number(amount)} Aura</dd></div><div><dt>Total to repay</dt><dd>{amount} Aura</dd></div><div><dt>Interest and fees</dt><dd>0 Aura</dd></div></dl><p>Half of future daily bonuses, Chaos bonuses, and bounty rewards repays your loan, rounded up to whole Aura. Refunds and returned bonds stay yours. Repay early whenever you like. Your next loan opens seven days after this one.</p></> : <><p className="aura-bank-form-lead">Pay at your pace. Every Aura brings the balance down.</p><label htmlFor="aura-bank-repay">Aura to repay</label><input id="aura-bank-repay" type="number" inputMode="numeric" min="1" max={confirming ? undefined : repaymentMax} step="1" value={amount} disabled={busy || confirming} onChange={event => setAmount(event.target.value)} /><div className="aura-bank-form-presets" role="group" aria-label="Repayment amount">{presets.map(preset => <button type="button" key={preset.amount} aria-pressed={Number(amount) === preset.amount} disabled={busy || confirming} onClick={() => setAmount(preset.amount)}>{preset.label}</button>)}</div><dl><div><dt>{confirming ? 'Current loan' : 'Loan after repayment'}</dt><dd>{confirming ? bank.outstanding : Math.max(0, bank.outstanding - Number(amount || 0))} Aura</dd></div><div><dt>{confirming ? 'Current wallet' : 'Wallet after repayment'}</dt><dd>{confirming ? bank.balance : Math.max(0, bank.balance - Number(amount || 0))} Aura</dd></div></dl><p>{bank.outstanding} Aura owed · {bank.balance} Aura in your wallet. Automatic repayment carries on for anything left.</p></>}
      {error && <p className="aura-bank-error" role="alert">{error}</p>}<div className="aura-bank-form-actions"><Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</Button><Button variant="aura" type="submit" loading={busy} disabled={!valid}>{dialog === 'borrow' ? `Borrow ${amount} Aura` : `Repay ${amount || 0} Aura`}</Button></div>
    </form></Modal>}
  </section>;
};
