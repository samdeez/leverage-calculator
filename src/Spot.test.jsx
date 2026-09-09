import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Spot from './Spot';

describe('Spot Component - Compound Trades Logic', () => {
  it('calculates initial default compound profit correctly', () => {
    render(<Spot />);

    // Default initial values:
    // invest = 200, percentPrice = 0.58, compoundTrades = 1
    // comp = 1 + (0.58 / 100) = 1.0058
    // sum = 200 * (1.0058 ^ 1) = 201.16
    // profit = 201.16 - 200 = 1.16
    // rounding to max fraction digits 0 = 1

    const profitText = screen.getByText(/\$1/i);
    expect(profitText).toBeInTheDocument();
  });

  it('calculates compound profit with updated inputs', () => {
    render(<Spot />);

    // Get input elements
    const buyAmountInput = screen.getByDisplayValue('200');
    const percentChangeInput = screen.getByDisplayValue('0.58');
    const compoundTradesInput = screen.getByDisplayValue('1');

    // Update input values
    // invest = 1000
    // percentPrice = 5
    // compoundTrades = 3
    fireEvent.change(buyAmountInput, { target: { value: '1000' } });
    fireEvent.change(percentChangeInput, { target: { value: '5' } });
    fireEvent.change(compoundTradesInput, { target: { value: '3' } });

    // Math expected:
    // comp = 1 + (5 / 100) = 1.05
    // sum = 1000 * (1.05 ^ 3) = 1000 * 1.157625 = 1157.625
    // profit = 1157.625 - 1000 = 157.625
    // Rounded: $158

    const updatedProfitText = screen.getByText(/\$158/i);
    expect(updatedProfitText).toBeInTheDocument();
  });

  it('calculates high volume compound profit correctly', () => {
    render(<Spot />);

    const buyAmountInput = screen.getByDisplayValue('200');
    const percentChangeInput = screen.getByDisplayValue('0.58');
    const compoundTradesInput = screen.getByDisplayValue('1');

    // Update input values
    // invest = 400
    // percentPrice = 7.5
    // compoundTrades = 20
    fireEvent.change(buyAmountInput, { target: { value: '400' } });
    fireEvent.change(percentChangeInput, { target: { value: '7.5' } });
    fireEvent.change(compoundTradesInput, { target: { value: '20' } });

    // Math expected:
    // comp = 1 + (7.5 / 100) = 1.075
    // sum = 400 * (1.075 ^ 20) = 400 * 4.2478511 = 1699.14044
    // profit = 1699.14044 - 400 = 1299.14044
    // Rounded: $1,299

    const updatedProfitText = screen.getByText(/\$1,299/i);
    expect(updatedProfitText).toBeInTheDocument();
  });

  it('calculates correctly when percentPrice is negative', () => {
    render(<Spot />);

    const buyAmountInput = screen.getByDisplayValue('200');
    const percentChangeInput = screen.getByDisplayValue('0.58');
    const compoundTradesInput = screen.getByDisplayValue('1');

    // Update input values
    // invest = 1000
    // percentPrice = -10
    // compoundTrades = 2
    fireEvent.change(buyAmountInput, { target: { value: '1000' } });
    fireEvent.change(percentChangeInput, { target: { value: '-10' } });
    fireEvent.change(compoundTradesInput, { target: { value: '2' } });

    // Math expected:
    // comp = 1 + (-10 / 100) = 0.90
    // sum = 1000 * (0.90 ^ 2) = 1000 * 0.81 = 810
    // profit = 810 - 1000 = -190
    // Rounded: $-190

    const updatedProfitText = screen.getByText(/\$-190/i);
    expect(updatedProfitText).toBeInTheDocument();
  });
});
