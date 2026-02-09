/**
 * Tools - Utility Features
 * 
 * Contains utility/gameplay tools:
 * - Ghost Predictor
 * - Debt Trend Chart (future)
 * - Other analysis tools
 */

import { useState } from 'react';
import GhostPredictor from './GhostPredictor';
import { CrystalBallIcon, ChevronRightIcon, TrendingUpIcon } from './icons/Icons';

const Tools = ({ friendships }) => {
  const [activeTool, setActiveTool] = useState(null);

  const tools = {
    predictor: {
      id: 'predictor',
      name: 'Ghost Predictor',
      description: 'AI-powered bankruptcy forecasting',
      icon: <CrystalBallIcon size={24} color="#9c27b0" />,
      color: '#9c27b0',
      component: GhostPredictor
    },
    trends: {
      id: 'trends',
      name: 'Debt Trends',
      description: 'Analyze your debt patterns over time',
      icon: <TrendingUpIcon size={24} color="#33b5e5" />,
      color: '#33b5e5',
      component: null // Placeholder for future
    }
  };

  if (activeTool) {
    const tool = tools[activeTool];
    const ToolComponent = tool.component;

    return (
      <div>
        {/* Back Navigation */}
        <button
          onClick={() => setActiveTool(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: 'transparent',
            border: '1px solid #333',
            borderRadius: '8px',
            color: '#888',
            fontSize: '0.85rem',
            cursor: 'pointer',
            marginBottom: '15px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = '#444';
            e.target.style.color = '#aaa';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = '#333';
            e.target.style.color = '#888';
          }}
        >
          <span>←</span>
          Back to Tools
        </button>

        {/* Tool Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          padding: '15px 20px',
          background: 'linear-gradient(145deg, #111, #0a0a0a)',
          border: `1px solid ${tool.color}30`,
          borderRadius: '12px'
        }}>
          <div style={{
            width: '45px',
            height: '45px',
            borderRadius: '12px',
            background: `${tool.color}15`,
            border: `1px solid ${tool.color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {tool.icon}
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>{tool.name}</h2>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.75rem' }}>
              {tool.description}
            </p>
          </div>
        </div>

        {/* Tool Content */}
        {ToolComponent ? (
          <ToolComponent friendships={friendships} />
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'linear-gradient(145deg, #111, #0a0a0a)',
            border: '1px dashed #333',
            borderRadius: '16px'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🚧</div>
            <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>Coming Soon</h3>
            <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>
              This tool is under development.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Tools Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '45px',
            height: '45px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #33b5e5, #0099cc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(51,181,229,0.3)'
          }}>
            <CrystalBallIcon size={24} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.3rem' }}>TOOLS</h2>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.75rem' }}>
              Analyze • Predict • Optimize
            </p>
          </div>
        </div>
      </div>

      {/* Tools List */}
      <div style={{ padding: '20px' }}>
        {Object.values(tools).map((tool) => (
          <ToolCard 
            key={tool.id} 
            tool={tool} 
            onClick={() => setActiveTool(tool.id)} 
          />
        ))}
      </div>
    </div>
  );
};

// Tool Card Component
const ToolCard = ({ tool, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...cardStyle,
        borderColor: isHovered ? tool.color : '#222',
        boxShadow: isHovered ? `0 0 20px ${tool.color}15` : 'none',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{
          ...iconContainerStyle,
          background: `${tool.color}15`,
          borderColor: `${tool.color}30`
        }}>
          {tool.icon}
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <h3 style={{ margin: '0 0 6px 0', color: '#fff', fontSize: '1rem' }}>
            {tool.name}
          </h3>
          <p style={{ margin: 0, color: '#666', fontSize: '0.8rem', lineHeight: 1.4 }}>
            {tool.description}
          </p>
        </div>
        <ChevronRightIcon size={20} color="#444" />
      </div>
    </button>
  );
};

// Styles
const containerStyle = {
  background: 'linear-gradient(145deg, #0a0a0a, #111)',
  border: '1px solid #222',
  borderRadius: '16px',
  overflow: 'hidden',
  marginBottom: '20px'
};

const headerStyle = {
  padding: '20px 25px',
  borderBottom: '1px solid #222',
  background: 'linear-gradient(90deg, rgba(51,181,229,0.05) 0%, transparent 100%)'
};

const cardStyle = {
  width: '100%',
  background: 'linear-gradient(145deg, #111, #0a0a0a)',
  border: '1px solid #222',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '15px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  textAlign: 'left'
};

const iconContainerStyle = {
  width: '50px',
  height: '50px',
  borderRadius: '12px',
  border: '1px solid',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

export default Tools;
