import { useEffect, useRef, useState } from 'react';
import { ChartIcon } from './icons/Icons';

const DebtTrendChart = ({ data = [] }) => {
  const canvasRef = useRef(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Sample data if none provided
  const chartData = data.length > 0 ? data : [
    { day: 'Mon', debt: 5 },
    { day: 'Tue', debt: 8 },
    { day: 'Wed', debt: 12 },
    { day: 'Thu', debt: 10 },
    { day: 'Fri', debt: 15 },
    { day: 'Sat', debt: 18 },
    { day: 'Sun', debt: 22 }
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 30, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate scales
    const maxDebt = Math.max(...chartData.map(d => d.debt));
    const minDebt = 0;
    const xStep = chartWidth / (chartData.length - 1);

    // Draw grid lines
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw Y-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '11px Space Grotesk, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = Math.round(maxDebt - (maxDebt / 5) * i);
      const y = padding.top + (chartHeight / 5) * i;
      ctx.fillText(value, padding.left - 10, y + 4);
    }

    // Create gradient for the area
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(255, 68, 68, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 68, 68, 0)');

    // Draw the area under the line
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    chartData.forEach((point, index) => {
      const x = padding.left + index * xStep;
      const y = padding.top + chartHeight - (point.debt / maxDebt) * chartHeight;
      if (index === 0) {
        ctx.lineTo(x, y);
      } else {
        // Smooth curve
        const prevX = padding.left + (index - 1) * xStep;
        const prevY = padding.top + chartHeight - (chartData[index - 1].debt / maxDebt) * chartHeight;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    });
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw the line
    ctx.beginPath();
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    chartData.forEach((point, index) => {
      const x = padding.left + index * xStep;
      const y = padding.top + chartHeight - (point.debt / maxDebt) * chartHeight;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = padding.left + (index - 1) * xStep;
        const prevY = padding.top + chartHeight - (chartData[index - 1].debt / maxDebt) * chartHeight;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    });
    ctx.stroke();

    // Draw glow effect on the line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 68, 68, 0.5)';
    ctx.lineWidth = 8;
    ctx.filter = 'blur(4px)';
    chartData.forEach((point, index) => {
      const x = padding.left + index * xStep;
      const y = padding.top + chartHeight - (point.debt / maxDebt) * chartHeight;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = padding.left + (index - 1) * xStep;
        const prevY = padding.top + chartHeight - (chartData[index - 1].debt / maxDebt) * chartHeight;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    });
    ctx.stroke();
    ctx.filter = 'none';

    // Draw points
    chartData.forEach((point, index) => {
      const x = padding.left + index * xStep;
      const y = padding.top + chartHeight - (point.debt / maxDebt) * chartHeight;
      
      // Outer glow
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 68, 68, 0.3)';
      ctx.fill();
      
      // Inner point
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4444';
      ctx.fill();
      
      // White center
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    });

    // Draw X-axis labels
    ctx.fillStyle = '#888';
    ctx.font = '11px Space Grotesk, sans-serif';
    ctx.textAlign = 'center';
    chartData.forEach((point, index) => {
      const x = padding.left + index * xStep;
      ctx.fillText(point.day, x, height - padding.bottom + 20);
    });

  }, [chartData]);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <ChartIcon size={24} color="#ff4444" />
        <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>DEBT TREND</h3>
        <span style={{ 
          color: '#ff4444', 
          fontSize: '0.85rem',
          background: 'rgba(255,68,68,0.1)',
          padding: '4px 10px',
          borderRadius: '4px'
        }}>
          +{chartData[chartData.length - 1]?.debt - chartData[0]?.debt} this week
        </span>
      </div>
      
      <div style={{ position: 'relative', height: '200px' }}>
        <canvas 
          ref={canvasRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            cursor: 'crosshair'
          }}
        />
      </div>

      <div style={legendStyle}>
        <div style={legendItemStyle}>
          <div style={{ ...legendDotStyle, background: '#ff4444' }} />
          <span style={{ color: '#666', fontSize: '0.75rem' }}>Your Debt</span>
        </div>
        <div style={legendItemStyle}>
          <div style={{ ...legendDotStyle, background: '#444' }} />
          <span style={{ color: '#666', fontSize: '0.75rem' }}>Network Average</span>
        </div>
      </div>
    </div>
  );
};

const containerStyle = {
  background: 'linear-gradient(145deg, #0a0a0a, #111)',
  border: '1px solid #222',
  borderRadius: '16px',
  padding: '20px',
  marginBottom: '20px'
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '15px',
  paddingBottom: '15px',
  borderBottom: '1px solid #1a1a1a'
};

const legendStyle = {
  display: 'flex',
  gap: '20px',
  marginTop: '15px',
  paddingTop: '15px',
  borderTop: '1px solid #1a1a1a'
};

const legendItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
};

const legendDotStyle = {
  width: '8px',
  height: '8px',
  borderRadius: '50%'
};

export default DebtTrendChart;
