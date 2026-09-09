import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Leverage from './Leverage';

describe('Leverage Component - shortCalc', () => {
  it('renders default short liquidation correctly based on initial empty/default state', () => {
    render(<Leverage />);
    // With enterPrice = "" (evaluates to 0), shortLiq = 0 / 6 + 0 = 0
    // Because there are multiple elements matching "0 $", we can assert that at least one exists
    expect(screen.getAllByText('0 $').length).toBeGreaterThan(0);
  });

  it('calculates short liquidation price correctly for a standard scenario', () => {
    render(<Leverage />);

    // Default leverage is 6. Let's change enterPrice to 12000.
    // shortLiq = 12000 / 6 + 12000 = 2000 + 12000 = 14000
    // Using getByLabelText or similar is better, but since the label and input are siblings not linked by htmlFor,
    // we can find the parent container or use a regular expression for the expected text.
    const entryPriceInput = screen.getByText('Entry Price:').nextElementSibling;
    fireEvent.change(entryPriceInput, { target: { value: '12000' } });

    // toLocaleString() format is dependent on locale. We check for numeric values or regex
    // We will just match the text 14,000 $ or 14.000 $ or 14000 $
    const result = screen.getByText(/14[,.\s]?000 \$/);
    expect(result).toBeInTheDocument();
  });

  it('calculates short liquidation correctly when leverage changes', () => {
    render(<Leverage />);

    // Change Entry Price to 10000
    const entryPriceInput = screen.getByText('Entry Price:').nextElementSibling;
    fireEvent.change(entryPriceInput, { target: { value: '10000' } });

    // Change Leverage to 2
    const leverageInput = screen.getByText('Leverage:').nextElementSibling;
    fireEvent.change(leverageInput, { target: { value: '2' } });

    // shortLiq = 10000 / 2 + 10000 = 5000 + 10000 = 15000
    const result = screen.getByText(/15[,.\s]?000 \$/);
    expect(result).toBeInTheDocument();
  });
});
