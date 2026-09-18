import React, { useState } from 'react';
import { BrainCircuit, Droplets, Flame, Sparkles, Wind, X, Zap } from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import { useAuth } from '../../../contexts/AuthContext';
import './WaterDivinationModal.css';

const NEN_TYPES = [
  { id: 'ENHANCER', label: 'Enhancer', icon: Flame, description: 'Direct, steady and hard to knock off course.' },
  { id: 'TRANSMUTER', label: 'Transmuter', icon: Zap, description: 'Adaptive, playful and comfortable changing shape.' },
  { id: 'CONJURER', label: 'Conjurer', icon: Droplets, description: 'Deliberate, structured and detail-oriented.' },
  { id: 'EMITTER', label: 'Emitter', icon: Wind, description: 'Expressive, immediate and comfortable reaching out first.' },
  { id: 'MANIPULATOR', label: 'Manipulator', icon: BrainCircuit, description: 'Strategic, observant and good at designing systems.' },
  { id: 'SPECIALIST', label: 'Specialist', icon: Sparkles, description: 'Hard to classify. You tend to make your own rules.' }
];

export const WaterDivinationModal = ({ isOpen = false, onClose = () => {} }) => {
  const { user, setNenType } = useAuth();
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !user || user.nenType) return null;
  const choice = NEN_TYPES.find((item) => item.id === selected);

  const save = async () => {
    if (!choice) return;
    setSaving(true);
    setError('');
    const result = await setNenType(choice.id);
    if (!result.success) {
      setError(result.error || 'Could not save your affinity');
    } else {
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="affinity-overlay" role="dialog" aria-modal="true" aria-labelledby="affinity-title">
      <div className="affinity-card">
        <button type="button" className="affinity-close" onClick={onClose} aria-label="Close affinity picker"><X size={18} /></button>
        <header className="affinity-header">
          <img src="/hakoware-mark-v2.png" alt="" />
          <div>
            <p className="affinity-kicker">Optional profile detail</p>
            <h2 id="affinity-title">Choose an affinity.</h2>
            <p>Pick the style that feels closest to you. It only changes your profile identity, not your contract rules.</p>
          </div>
        </header>

        <div className="affinity-grid">
          {NEN_TYPES.map((type) => (
            <button
              type="button"
              key={type.id}
              className={`affinity-option ${selected === type.id ? 'selected' : ''}`}
              onClick={() => setSelected(type.id)}
              aria-pressed={selected === type.id}
            >
              <span className="affinity-icon"><type.icon size={20} strokeWidth={1.8} /></span>
              <span className="affinity-copy"><strong>{type.label}</strong><small>{type.description}</small></span>
            </button>
          ))}
        </div>

        {error && <p className="affinity-error" role="alert">{error}</p>}

        <div className="affinity-footer">
          <p>{choice ? `${choice.label} will be attached to your profile.` : 'Optional, but the choice is permanent once saved.'}</p>
          <Button variant="aura" loading={saving} disabled={!choice} onClick={save}>
            {choice ? `Choose ${choice.label}` : 'Choose an affinity'}
          </Button>
        </div>
      </div>
    </div>
  );
};
