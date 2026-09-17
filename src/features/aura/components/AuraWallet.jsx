import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  ShieldCheck,
  TrendingUp,
  History,
  Activity,
  ShoppingBag,
  Package
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../lib/api';
import { Button } from '../../../shared/components/Button';
import { MarketplaceModal } from './MarketplaceModal';
import { InventoryModal } from './InventoryModal';
import './AuraWallet.css';

export const AuraWallet = ({ friendships, showToast }) => {
  const { user } = useAuth();
  const [data, setData] = useState({ balance: 0, history: [], weeklyChangePercent: 0 });
  const [loading, setLoading] = useState(true);
  const [showMarket, setShowMarket] = useState(false);
  const [showInventory, setShowInventory] = useState(false);

  const loadAuraData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get(`/aura/${user.uid || user.id}`);
      setData(res);
    } catch (error) {
      console.error('Failed to load aura data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuraData();
  }, []);

  const transactions = data.history || [];
  const score = user?.auraScore || 850;
  const scoreProgress = Math.min(100, Math.max(0, (score / 999) * 100));
  const weeklyChange = data.weeklyChangePercent || 0;

  return (
    <div className="aura-wallet-container">
      <div className="wallet-actions-bar">
        <Button variant="secondary" icon={Package} onClick={() => setShowInventory(true)}>
          Collection
        </Button>
        <Button variant="aura" icon={ShoppingBag} onClick={() => setShowMarket(true)}>
          Greed Island Market
        </Button>
      </div>

      <div className="wallet-grid">
        <section className="balance-card" aria-labelledby="aura-balance-title">
          <div className="card-top">
            <div className="label-group">
              <span id="aura-balance-title" className="label">Aura balance</span>
              <p className="description">Available for contracts and settlements</p>
            </div>
            <div className="icon-circle gold">
              <Zap size={21} strokeWidth={1.8} />
            </div>
          </div>

          <div className="balance-display">
            <span className="amount">{(data.balance || 0).toLocaleString()}</span>
            <span className="unit">Aura</span>
          </div>

          <div className="card-footer">
            <div className={`footer-stat ${weeklyChange >= 0 ? 'positive' : 'negative'}`}>
              <TrendingUp size={14} strokeWidth={1.8} className={weeklyChange < 0 ? 'trend-down' : ''} />
              <span>{weeklyChange >= 0 ? '+' : ''}{weeklyChange}% this week</span>
            </div>
          </div>
        </section>

        <section className="score-card" aria-labelledby="aura-score-title">
          <div className="card-top">
            <div className="label-group">
              <span id="aura-score-title" className="label">Hunter credit score</span>
              <p className="description">Based on repayment history</p>
            </div>
            <div className="icon-circle blue">
              <ShieldCheck size={21} strokeWidth={1.8} />
            </div>
          </div>

          <div className="score-display">
            <span className="amount">{score}</span>
            <div className="score-badge">Rank A</div>
          </div>

          <div className="score-bar-container" aria-label={`Credit score ${score} out of 999`}>
            <div className="score-bar-bg">
              <div className="score-bar-fill" style={{ width: `${scoreProgress}%` }} />
            </div>
          </div>
        </section>
      </div>

      <section className="history-section" aria-labelledby="transaction-log-title">
        <header className="section-header">
          <div className="title-group">
            <History size={18} strokeWidth={1.8} />
            <h3 id="transaction-log-title">Transaction log</h3>
          </div>
          <button className="view-all" onClick={loadAuraData} disabled={loading}>Refresh</button>
        </header>

        <div className="transaction-list">
          {loading ? (
            <div className="loading-state" aria-live="polite">
              <div className="loading-spinner" />
              <p>Syncing Aura…</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="empty-state-inner">
              <Activity size={30} strokeWidth={1.6} />
              <p>No recent activity</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id || tx._id} className="tx-item">
                <div className={`tx-icon ${tx.amount > 0 ? 'up' : 'down'}`}>
                  {tx.amount > 0 ? <ArrowDownLeft size={16} strokeWidth={1.8} /> : <ArrowUpRight size={16} strokeWidth={1.8} />}
                </div>
                <div className="tx-info">
                  <span className="tx-title">{tx.description || 'System adjustment'}</span>
                  <span className="tx-date">{new Date(tx.createdAt).toLocaleDateString()}</span>
                </div>
                <div className={`tx-amount ${tx.amount > 0 ? 'positive' : 'negative'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <MarketplaceModal
        isOpen={showMarket}
        onClose={() => setShowMarket(false)}
        friendships={friendships}
        showToast={showToast}
      />

      <InventoryModal
        isOpen={showInventory}
        onClose={() => setShowInventory(false)}
        friendships={friendships}
        showToast={showToast}
      />
    </div>
  );
};
