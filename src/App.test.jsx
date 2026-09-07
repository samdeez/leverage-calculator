import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Component', () => {
  it('renders default state with Spot visible and Leverage hidden', () => {
    const { container } = render(<App />);

    // Check header
    expect(screen.getByText('$ Leverage Calculator $')).toBeInTheDocument();

    // Both buttons exist
    const spotButton = screen.getByRole('button', { name: 'Spot' });
    const leverageButton = screen.getByRole('button', { name: 'Leverage' });

    expect(spotButton).toBeInTheDocument();
    expect(leverageButton).toBeInTheDocument();

    // Spot component (with input spot trade) should be visible
    expect(screen.getByText('input spot trade:')).toBeVisible();

    // Leverage component (with input leverage trade) should be hidden
    expect(screen.getByText('input leverage trade:')).not.toBeVisible();
  });

  it('toggles to Leverage view when Leverage button is clicked', () => {
    render(<App />);

    const leverageButton = screen.getByRole('button', { name: 'Leverage' });
    fireEvent.click(leverageButton);

    expect(screen.getByText('input leverage trade:')).toBeVisible();
    expect(screen.getByText('input spot trade:')).not.toBeVisible();
  });

  it('toggles back to Spot view when Spot button is clicked', () => {
    render(<App />);

    const leverageButton = screen.getByRole('button', { name: 'Leverage' });
    fireEvent.click(leverageButton);

    const spotButton = screen.getByRole('button', { name: 'Spot' });
    fireEvent.click(spotButton);

    expect(screen.getByText('input spot trade:')).toBeVisible();
    expect(screen.getByText('input leverage trade:')).not.toBeVisible();
  });
});
