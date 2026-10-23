import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from '../Card.js';

describe('Card Component - Collapsible & Accessibility', () => {
  it('renders title, subtitle and body content by default', () => {
    render(
      <Card headerTitle="Bóvedas Institucionales" headerSubtitle="Subtítulo descriptivo">
        <p>Contenido interno de la tarjeta</p>
      </Card>
    );

    expect(screen.getByText('Bóvedas Institucionales')).toBeDefined();
    expect(screen.getByText('Subtítulo descriptivo')).toBeDefined();
    expect(screen.getByText('Contenido interno de la tarjeta')).toBeDefined();
  });

  it('toggles collapse on header click when collapsible=true', () => {
    const handleToggle = vi.fn();
    render(
      <Card
        collapsible
        defaultExpanded={true}
        headerTitle="Tarjeta Colapsable"
        onToggleExpanded={handleToggle}
      >
        <div data-testid="card-content">Información protegida</div>
      </Card>
    );

    const header = screen.getByRole('button', { name: /Tarjeta Colapsable/i });
    expect(header.getAttribute('aria-expanded')).toBe('true');

    // Click header to collapse
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(handleToggle).toHaveBeenCalledWith(false);

    // Click header again to re-expand
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(handleToggle).toHaveBeenCalledWith(true);
  });

  it('supports keyboard navigation via Enter and Space keys', () => {
    render(
      <Card collapsible defaultExpanded={true} headerTitle="Navegación Teclado">
        <div>Contenido accesible</div>
      </Card>
    );

    const header = screen.getByRole('button', { name: /Navegación Teclado/i });
    expect(header.getAttribute('aria-expanded')).toBe('true');

    // Press Enter to toggle
    fireEvent.keyDown(header, { key: 'Enter', code: 'Enter' });
    expect(header.getAttribute('aria-expanded')).toBe('false');

    // Press Space to toggle
    fireEvent.keyDown(header, { key: ' ', code: 'Space' });
    expect(header.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not trigger card toggle when headerAction button is clicked', () => {
    const handleActionClick = vi.fn();
    const handleToggle = vi.fn();

    render(
      <Card
        collapsible
        defaultExpanded={true}
        headerTitle="Tarjeta con Acción"
        onToggleExpanded={handleToggle}
        headerAction={
          <button data-testid="custom-action-btn" onClick={handleActionClick}>
            Acción Externa
          </button>
        }
      >
        <div>Contenido</div>
      </Card>
    );

    const actionBtn = screen.getByTestId('custom-action-btn');
    fireEvent.click(actionBtn);

    expect(handleActionClick).toHaveBeenCalledTimes(1);
    // Card should still be expanded and onToggleExpanded not called
    const header = screen.getByRole('button', { name: /Tarjeta con Acción/i });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(handleToggle).not.toHaveBeenCalled();
  });

  it('renders collapsed by default when defaultExpanded=false', () => {
    render(
      <Card collapsible defaultExpanded={false} headerTitle="Inicialmente Colapsada">
        <div>Contenido oculto</div>
      </Card>
    );

    const header = screen.getByRole('button', { name: /Inicialmente Colapsada/i });
    expect(header.getAttribute('aria-expanded')).toBe('false');
  });
});
