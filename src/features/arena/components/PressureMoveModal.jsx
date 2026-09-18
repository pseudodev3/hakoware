import React from 'react';
import { ShieldCheck, Target, Zap } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';

export const PressureMoveModal = ({ bounty, moves = [], loading, onClose, onSend }) => {
  if (!bounty) return null;

  return (
    <Modal isOpen={Boolean(bounty)} onClose={onClose} title={`Pressure ${bounty.targetName}`} size="md">
      <div className="pressure-move-content">
        <div className="pressure-proof-explainer">
          <ShieldCheck size={19} strokeWidth={1.8} />
          <div>
            <strong>Arm the proof.</strong>
            <p>One pressure move. The target decides whether you earned credit when they check in.</p>
          </div>
        </div>

        <div className="pressure-stakes">
          <span><Target size={15} /><small>Target</small><strong>{bounty.targetName}</strong></span>
          <span><Zap size={15} /><small>Reward</small><strong>{bounty.amount} Aura</strong></span>
          <span><ShieldCheck size={15} /><small>Your bond</small><strong>{bounty.hunterBond || 0} Aura</strong></span>
        </div>

        <div className="pressure-moves">
          {moves.map((move) => (
            <button type="button" key={move.id} disabled={loading} onClick={() => onSend(move.id)}>
              <strong>{move.label}</strong>
              <span>{move.message}</span>
            </button>
          ))}
        </div>

        <div className="pressure-footer">
          <p>No custom messages. Pressure stays game-like, bounded, and never becomes harassment.</p>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
};
