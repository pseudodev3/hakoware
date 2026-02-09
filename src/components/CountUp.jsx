import { useState, useEffect } from 'react';

const CountUp = ({ end, duration = 2000, onFinish }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = null;
    let animationFrameId;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // "Ease Out" logic: Starts fast, slows down at the end (Slot Machine style)
      const ease = 1 - Math.pow(1 - progress, 3);
      
      setCount(Math.floor(ease * end));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        if (onFinish) onFinish();
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [end, duration]);

  return <span>{count}</span>;
};

export default CountUp;
