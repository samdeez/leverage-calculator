import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import Spot from './Spot';

describe('Spot Component levCalc logic', () => {
  beforeEach(() => {
    render(<Spot />);
  });

  const getInputs = () => {
    const inputs = screen.getAllByRole('spinbutton');
    return {
      investInput: inputs[0], // Buy Amount
      enterPriceInput: inputs[1], // Buy Price
      exitPriceInput: inputs[2], // Sell Price
      feesInput: inputs[4], // Fees
    };
  };

  it('calculates P&L correctly for a profitable trade without fees', () => {
    const { investInput, enterPriceInput, exitPriceInput, feesInput } = getInputs();

    fireEvent.change(investInput, { target: { value: '100' } });
    fireEvent.change(enterPriceInput, { target: { value: '100' } });
    fireEvent.change(exitPriceInput, { target: { value: '150' } });
    fireEvent.change(feesInput, { target: { value: '0' } });

    // P&L calculation: (100 * 1 / 100) * (150 - 100) = 50
    const resultsDiv = screen.getByText('P&L:').nextElementSibling;
    expect(within(resultsDiv).getByText('50')).toBeInTheDocument();
    expect(within(resultsDiv).getByText('+$')).toBeInTheDocument();

    // ROI should be 50.0%
    expect(within(resultsDiv).getByText((content, element) => {
      return element.textContent === '50.0% ROI' || content === '50.0';
    })).toBeInTheDocument();
  });

  it('calculates P&L correctly for a losing trade without fees', () => {
    const { investInput, enterPriceInput, exitPriceInput, feesInput } = getInputs();

    fireEvent.change(investInput, { target: { value: '100' } });
    fireEvent.change(enterPriceInput, { target: { value: '100' } });
    fireEvent.change(exitPriceInput, { target: { value: '50' } });
    fireEvent.change(feesInput, { target: { value: '0' } });

    // P&L calculation: (100 * 1 / 100) * (50 - 100) = -50
    const resultsDiv = screen.getByText('P&L:').nextElementSibling;
    expect(within(resultsDiv).getByText('-50')).toBeInTheDocument();

    // ROI should be -50.0%
    expect(within(resultsDiv).getByText((content, element) => {
      return element.textContent === '-50.0% ROI' || content === '-50.0';
    })).toBeInTheDocument();
  });

  it('calculates P&L correctly for a profitable trade with fees', () => {
    const { investInput, enterPriceInput, exitPriceInput, feesInput } = getInputs();

    fireEvent.change(investInput, { target: { value: '100' } });
    fireEvent.change(enterPriceInput, { target: { value: '100' } });
    fireEvent.change(exitPriceInput, { target: { value: '150' } });
    fireEvent.change(feesInput, { target: { value: '10' } }); // 10% fee

    // P&L calculation: 50 * (1 - 0.1) = 45
    const resultsDiv = screen.getByText('P&L:').nextElementSibling;
    expect(within(resultsDiv).getByText('45')).toBeInTheDocument();
    expect(within(resultsDiv).getByText('+$')).toBeInTheDocument();

    // ROI should be 45.0%
    expect(within(resultsDiv).getByText((content, element) => {
      return element.textContent === '45.0% ROI' || content === '45.0';
    })).toBeInTheDocument();
  });
});
