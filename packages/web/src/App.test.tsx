import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from './App';

test('renders headline', () => {
  render(<App />);
  const linkElement = screen.getByText(/CheckIt/i);
  expect(linkElement).toBeInTheDocument();
});
