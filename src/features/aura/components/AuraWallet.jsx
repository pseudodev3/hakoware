import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Wallet, 
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

/**
 * Professional Aura Wallet module.
 * Visualizes currency and financial standing within the HxH system.
 */
export const AuraWallet = ({ showToast }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMarket, setShowMarket] = useState(false);
  const [showInventory, setShowInventory] = useState(false);

  const loadAuraData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/aura/transactions');
      setTransactions(res || []);
    } catch (error) {
      console.error('Failed to load aura data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuraData();
  }, []);

  return (
    <div className="aura-wallet-container">
      <div className="wallet-actions-bar" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-16px', gap: '12px' }}>
        <Button variant="secondary" icon={Package} onClick={() => setShowInventory(true)}>
          COLLECTION
        </Button>
        <Button variant="aura" icon={ShoppingBag} onClick={() => setShowMarket(true)}>
          GREED ISLAND MARKET
        </Button>
      </div>
      <div className="wallet-grid">
        {/* Main Balance Card */}
        <motion.div 
          className="balance-card glass aura-pulse"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="card-top">
            <div className="label-group">
              <span className="label">TOTAL AURA BALANCE</span>
              <p className="description">AVAILABLE FOR DEBT SETTLEMENT</p>
            </div>
            <div className="icon-circle">
              <Zap size={24} color="var(--aura-gold)" />
            </div>
          </div>
          <div className="balance-display">
            <span className="amount">{(user?.auraBalance || 0).toLocaleString()}</span>
            <span className="unit">AURA</span>
          </div>
          <div className="card-footer">
            <div className="footer-stat">
              <TrendingUp size={14} color="var(--aura-green)" />
              <span>+12% THIS WEEK</span>
            </div>
          </div>
        </motion.div>

        {/* Credit Score Card */}
        <motion.div 
          className="score-card glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="card-top">
            <div className="label-group">
              <span className="label">HUNTER CREDIT SCORE</span>
              <p className="description">BASED ON REPAYMENT HISTORY</p>
            </div>
            <div className="icon-circle">
              <ShieldCheck size={24} color="var(--aura-blue)" />
            </div>
          </div>
          <div className="score-display">
            <span className="amount">{user?.auraScore || 850}</span>
            <div className="score-badge">RANK A</div>
          </div>
          <div className="score-bar-container">
            <div className="score-bar-bg">
              <motion.div 
                className="score-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${((user?.auraScore || 850) / 999) * 100}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Transaction History */}
      <div className="history-section">
        <header className="section-header">
          <div className="title-group">
            <History size={18} color="var(--text-muted)" />
            <h3>TRANSACTION LOGS</h3>
          </div>
          <button className="view-all" onClick={loadAuraData}>REFRESH SYNC</button>
        </header>

        <div className="transaction-list">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p>ACCESSING BLOCKCHAIN...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="empty-state-inner">
              <Activity size={32} opacity={0.2} />
              <p>NO RECENT MOVEMENTS DETECTED</p>
            </div>
          ) : (
            transactions.map((tx, idx) => (
              <motion.div 
                key={tx.id || tx._id} 
                className="tx-item"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div className={`tx-icon ${tx.amount > 0 ? 'up' : 'down'}`}>
                  {tx.amount > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </div>
                <div className="tx-info">
                  <span className="tx-title">{tx.description || 'System Adjustment'}</span>
                  <span className="tx-date">{new Date(tx.createdAt).toLocaleDateString()}</span>
                </div>
                <div className={`tx-amount ${tx.amount > 0 ? 'positive' : 'negative'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
      
      <MarketplaceModal 
        isOpen={showMarket}
        onClose={() => setShowMarket(false)}
        showToast={showToast}
      />

      <InventoryModal 
        isOpen={showInventory}
        onClose={() => setShowInventory(false)}
      />
    </div>
  );
};
