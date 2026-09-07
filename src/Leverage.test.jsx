import { describe, it, expect } from 'vitest';
import { calculateLeverage } from './Leverage.jsx';

describe('calculateLeverage', () => {
  it('should calculate correct positive PnL for a long position', () => {
    // Invest: 1000
    // Leverage: 10
    // Enter Price: 50000
    // Exit Price: 60000
    // Fees Percent: 0.1
    // Funding Hour: 0.01
    // Hours: 24

    // Pnl = ((1000 * 10) / 50000) * (60000 - 50000) = (10000 / 50000) * 10000 = 0.2 * 10000 = 2000
    // Fees = (1000 * 10 * 0.1) / 100 = 10
    // Funding = ((1000 * 10 * 0.01) / 100) * 24 = (100 / 100) * 24 = 24
    // Result = 2000 - 10 - 24 = 1966

    const result = calculateLeverage(1000, 10, 50000, 60000, 0.1, 0.01, 24);

    expect(Number(result)).toBeCloseTo(1966, 2);
  });

  it('should calculate correct negative PnL for a long position', () => {
    // Invest: 1000
    // Leverage: 10
    // Enter Price: 60000
    // Exit Price: 50000
    // Fees Percent: 0.1
    // Funding Hour: 0.01
    // Hours: 24

    // Pnl = ((1000 * 10) / 60000) * (50000 - 60000) = (10000 / 60000) * -10000 = 0.16666... * -10000 = -1666.67
    // Fees = (1000 * 10 * 0.1) / 100 = 10
    // Funding = ((1000 * 10 * 0.01) / 100) * 24 = (100 / 100) * 24 = 24
    // Result = -1666.67 - 10 - 24 = -1700.67

    const result = calculateLeverage(1000, 10, 60000, 50000, 0.1, 0.01, 24);

    expect(Number(result)).toBeCloseTo(-1700.67, 2);
  });

  it('should handle zero leverage', () => {
    // If leverage is 0, PnL should be 0, fees 0, funding 0
    const result = calculateLeverage(1000, 0, 50000, 60000, 0.1, 0.01, 24);
    expect(Number(result)).toBe(0);
  });

  it('should handle zero investment', () => {
    // If invest is 0, PnL should be 0, fees 0, funding 0
    const result = calculateLeverage(0, 10, 50000, 60000, 0.1, 0.01, 24);
    expect(Number(result)).toBe(0);
  });

  it('should parse string inputs correctly', () => {
    const result = calculateLeverage("1000", "10", "50000", "60000", "0.1", "0.01", "24");
    expect(Number(result)).toBeCloseTo(1966, 2);
  });
});
