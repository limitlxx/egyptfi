'use client';

import { useEffect, useState } from 'react';

const taglines = [
  "QR Payments",
  "Wallet Checkout",
  "One-Line API",
  "Refundable Crypto",
  "Gas-Free Transactions",
];

const RotatingTagline = () => {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % taglines.length);
        setFade(true);
      }, 300);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent transition-opacity duration-300 ${
        fade ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {taglines[index]}
    </span>
  );
};

export default RotatingTagline;