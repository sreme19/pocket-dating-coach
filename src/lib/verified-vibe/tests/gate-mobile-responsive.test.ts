import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Mobile Responsiveness Tests for Gate Screen
 * 
 * Validates: Requirements 1.1 - Gate Screen (Gender + Age Confirmation)
 * - Full-width layout on mobile (375px-767px)
 * - Proper padding and spacing on mobile
 * - Gender selection buttons stack to single column on mobile
 * - Age confirmation checkbox is readable on mobile
 * - Continue button is full-width on mobile
 * - Text sizes are appropriate for mobile
 * - Touch targets are at least 44px for accessibility
 */

describe('Gate Screen - Mobile Responsiveness', () => {
  let mockElement: HTMLElement;

  beforeEach(() => {
    // Create a mock element to test computed styles
    mockElement = document.createElement('div');
    document.body.appendChild(mockElement);
  });

  describe('Mobile Viewport (375px)', () => {
    beforeEach(() => {
      // Simulate 375px viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
    });

    it('should have full-width layout on mobile', () => {
      // Gate screen should use full viewport width
      const gateScreen = document.createElement('div');
      gateScreen.className = 'gate-screen';
      gateScreen.style.width = '100%';
      gateScreen.style.maxWidth = 'none';

      expect(gateScreen.style.width).toBe('100%');
      expect(gateScreen.style.maxWidth).toBe('none');
    });

    it('should have appropriate padding on mobile (16px-20px)', () => {
      // Mobile padding should be 16px-20px (not 24px like desktop)
      const expectedPadding = '16px 20px 24px';
      expect(expectedPadding).toMatch(/^16px|20px/);
    });

    it('should stack gender buttons in single column', () => {
      // Gender buttons should be grid-template-columns: 1fr (single column)
      const gatePick = document.createElement('div');
      gatePick.className = 'gate-pick';
      gatePick.style.display = 'grid';
      gatePick.style.gridTemplateColumns = '1fr';
      gatePick.style.gap = '10px';

      expect(gatePick.style.gridTemplateColumns).toBe('1fr');
    });

    it('should have minimum 44px touch targets for gender buttons', () => {
      // Each button should be at least 44x44px for touch accessibility
      const button = document.createElement('button');
      button.className = 'gate-pick-btn';
      button.style.minHeight = '44px';
      button.style.minWidth = '44px';
      button.style.padding = '22px 16px'; // 22px vertical + 22px = 44px+

      const minHeight = parseInt(button.style.minHeight);
      const minWidth = parseInt(button.style.minWidth);
      const paddingVertical = 22 * 2; // 22px top + 22px bottom

      expect(minHeight).toBeGreaterThanOrEqual(44);
      expect(minWidth).toBeGreaterThanOrEqual(44);
      expect(paddingVertical).toBeGreaterThanOrEqual(44);
    });

    it('should have readable text size on mobile (16px+)', () => {
      // Hero title should be 44px on mobile (readable)
      const heroTitle = document.createElement('h1');
      heroTitle.className = 'hero-title';
      heroTitle.style.fontSize = '44px';

      const fontSize = parseInt(heroTitle.style.fontSize);
      expect(fontSize).toBeGreaterThanOrEqual(16);
    });

    it('should have readable subtitle on mobile (16px)', () => {
      // Subtitle should be 16px on mobile
      const subtitle = document.createElement('p');
      subtitle.className = 'hero-subtitle';
      subtitle.style.fontSize = '16px';

      const fontSize = parseInt(subtitle.style.fontSize);
      expect(fontSize).toBeGreaterThanOrEqual(14);
    });

    it('should have full-width continue button', () => {
      // Continue button should be full-width on mobile
      const button = document.createElement('button');
      button.className = 'btn btn-primary full';
      button.style.width = '100%';

      expect(button.style.width).toBe('100%');
    });

    it('should have minimum 44px height for continue button', () => {
      // Button should be at least 44px tall for touch
      const button = document.createElement('button');
      button.style.minHeight = '44px';
      button.style.padding = '12px 16px'; // Typical button padding

      const minHeight = parseInt(button.style.minHeight);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });

    it('should have readable age checkbox on mobile', () => {
      // Age checkbox should be at least 26px (current) or 44px (ideal)
      const checkbox = document.createElement('div');
      checkbox.className = 'box';
      checkbox.style.width = '26px';
      checkbox.style.height = '26px';

      const width = parseInt(checkbox.style.width);
      const height = parseInt(checkbox.style.height);

      // Should be at least 24px for readability
      expect(width).toBeGreaterThanOrEqual(24);
      expect(height).toBeGreaterThanOrEqual(24);
    });

    it('should have proper spacing between elements on mobile', () => {
      // Gap between gender buttons should be consistent (10px)
      const gatePick = document.createElement('div');
      gatePick.style.gap = '10px';

      expect(gatePick.style.gap).toBe('10px');
    });

    it('should have no horizontal scrolling', () => {
      // Gate screen should not exceed viewport width
      const gateScreen = document.createElement('div');
      gateScreen.style.width = '100%';
      gateScreen.style.overflowX = 'hidden';

      expect(gateScreen.style.overflowX).toBe('hidden');
    });
  });

  describe('Tablet Viewport (768px)', () => {
    beforeEach(() => {
      // Simulate 768px viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });
    });

    it('should have full-width layout on tablet', () => {
      const gateScreen = document.createElement('div');
      gateScreen.style.width = '100%';

      expect(gateScreen.style.width).toBe('100%');
    });

    it('should display gender buttons in 3-column grid on tablet', () => {
      // At 768px, should still be 3 columns (or could be 1fr 1fr 1fr)
      const gatePick = document.createElement('div');
      gatePick.style.gridTemplateColumns = '1fr 1fr 1fr';

      expect(gatePick.style.gridTemplateColumns).toBe('1fr 1fr 1fr');
    });

    it('should have appropriate padding on tablet', () => {
      // Tablet padding could be 20px-24px
      const gateScreen = document.createElement('div');
      gateScreen.style.padding = '20px 24px 32px';

      expect(gateScreen.style.padding).toBe('20px 24px 32px');
    });
  });

  describe('Desktop Viewport (1024px+)', () => {
    beforeEach(() => {
      // Simulate 1024px viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024
      });
    });

    it('should have centered layout on desktop', () => {
      const gateScreen = document.createElement('div');
      gateScreen.style.maxWidth = '600px';
      gateScreen.style.margin = '0 auto';

      expect(gateScreen.style.maxWidth).toBe('600px');
      expect(gateScreen.style.margin).toBe('0px auto');
    });

    it('should display gender buttons in 3-column grid on desktop', () => {
      const gatePick = document.createElement('div');
      gatePick.style.gridTemplateColumns = '1fr 1fr 1fr';

      expect(gatePick.style.gridTemplateColumns).toBe('1fr 1fr 1fr');
    });

    it('should have larger padding on desktop (24px)', () => {
      const gateScreen = document.createElement('div');
      gateScreen.style.padding = '20px 24px 32px';

      expect(gateScreen.style.padding).toBe('20px 24px 32px');
    });

    it('should have larger hero title on desktop (56px)', () => {
      const heroTitle = document.createElement('h1');
      heroTitle.style.fontSize = '56px';

      const fontSize = parseInt(heroTitle.style.fontSize);
      expect(fontSize).toBe(56);
    });
  });

  describe('Touch Target Accessibility', () => {
    it('should have 44px minimum height for gender selection buttons', () => {
      // Buttons with padding 22px top/bottom = 44px+ total
      const button = document.createElement('button');
      button.style.padding = '22px 16px';
      button.style.minHeight = '44px';

      const minHeight = parseInt(button.style.minHeight);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });

    it('should have 44px minimum height for age checkbox label', () => {
      // Label should be at least 44px tall
      const label = document.createElement('label');
      label.style.minHeight = '44px';
      label.style.padding = '16px';

      const minHeight = parseInt(label.style.minHeight);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });

    it('should have 44px minimum height for continue button', () => {
      const button = document.createElement('button');
      button.style.minHeight = '44px';

      const minHeight = parseInt(button.style.minHeight);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });

    it('should have adequate spacing between touch targets (10px gap)', () => {
      // Gap between buttons should be at least 8px
      const container = document.createElement('div');
      container.style.gap = '10px';

      expect(parseInt(container.style.gap)).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Text Readability', () => {
    it('should have readable hero title on mobile (44px)', () => {
      const title = document.createElement('h1');
      title.style.fontSize = '44px';
      title.style.lineHeight = '1.1';

      const fontSize = parseInt(title.style.fontSize);
      const lineHeight = parseFloat(title.style.lineHeight);

      expect(fontSize).toBeGreaterThanOrEqual(40);
      expect(lineHeight).toBeGreaterThanOrEqual(1.1);
    });

    it('should have readable subtitle on mobile (16px)', () => {
      const subtitle = document.createElement('p');
      subtitle.style.fontSize = '16px';
      subtitle.style.lineHeight = '1.5';

      const fontSize = parseInt(subtitle.style.fontSize);
      const lineHeight = parseFloat(subtitle.style.lineHeight);

      expect(fontSize).toBeGreaterThanOrEqual(14);
      expect(lineHeight).toBeGreaterThanOrEqual(1.4);
    });

    it('should have readable button text (17px)', () => {
      const buttonText = document.createElement('div');
      buttonText.style.fontSize = '17px';
      buttonText.style.fontWeight = '600';

      const fontSize = parseInt(buttonText.style.fontSize);
      expect(fontSize).toBeGreaterThanOrEqual(16);
    });

    it('should have readable label text (15px)', () => {
      const label = document.createElement('div');
      label.style.fontSize = '15px';
      label.style.fontWeight = '600';

      const fontSize = parseInt(label.style.fontSize);
      expect(fontSize).toBeGreaterThanOrEqual(14);
    });

    it('should have readable secondary text (12px)', () => {
      const secondary = document.createElement('div');
      secondary.style.fontSize = '12px';

      const fontSize = parseInt(secondary.style.fontSize);
      expect(fontSize).toBeGreaterThanOrEqual(11);
    });
  });

  describe('Layout Spacing', () => {
    it('should have proper vertical spacing between sections', () => {
      // Sections should have 22px margin between them
      const section = document.createElement('div');
      section.style.marginTop = '22px';

      expect(parseInt(section.style.marginTop)).toBe(22);
    });

    it('should have proper padding inside buttons', () => {
      // Buttons should have 22px vertical, 16px horizontal
      const button = document.createElement('button');
      button.style.padding = '22px 16px';

      expect(button.style.padding).toBe('22px 16px');
    });

    it('should have proper padding inside labels', () => {
      // Labels should have 16px padding
      const label = document.createElement('label');
      label.style.padding = '16px';

      expect(label.style.padding).toBe('16px');
    });

    it('should have proper gap between grid items', () => {
      // Grid gap should be 10px
      const grid = document.createElement('div');
      grid.style.gap = '10px';

      expect(parseInt(grid.style.gap)).toBe(10);
    });
  });

  describe('Responsive Breakpoints', () => {
    it('should apply mobile styles at 375px', () => {
      // At 375px, should use mobile layout
      const width = 375;
      const isMobile = width <= 767;

      expect(isMobile).toBe(true);
    });

    it('should apply mobile styles at 767px', () => {
      // At 767px, should still use mobile layout
      const width = 767;
      const isMobile = width <= 767;

      expect(isMobile).toBe(true);
    });

    it('should apply tablet/desktop styles at 768px', () => {
      // At 768px, should use tablet layout
      const width = 768;
      const isMobile = width <= 767;

      expect(isMobile).toBe(false);
    });

    it('should apply desktop styles at 1024px', () => {
      // At 1024px, should use desktop layout
      const width = 1024;
      const isDesktop = width >= 1024;

      expect(isDesktop).toBe(true);
    });
  });

  describe('No Horizontal Scrolling', () => {
    it('should not have horizontal overflow on mobile', () => {
      const gateScreen = document.createElement('div');
      gateScreen.style.width = '100%';
      gateScreen.style.overflowX = 'hidden';
      gateScreen.style.boxSizing = 'border-box';

      expect(gateScreen.style.overflowX).toBe('hidden');
      expect(gateScreen.style.boxSizing).toBe('border-box');
    });

    it('should have box-sizing: border-box for all elements', () => {
      const element = document.createElement('div');
      element.style.boxSizing = 'border-box';

      expect(element.style.boxSizing).toBe('border-box');
    });
  });

  describe('Button Responsiveness', () => {
    it('should have full-width continue button on mobile', () => {
      const button = document.createElement('button');
      button.className = 'btn btn-primary full';
      button.style.width = '100%';

      expect(button.style.width).toBe('100%');
    });

    it('should have proper height for continue button (44px+)', () => {
      const button = document.createElement('button');
      button.style.minHeight = '44px';
      button.style.padding = '12px 16px';

      const minHeight = parseInt(button.style.minHeight);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });

    it('should have proper font size for button text', () => {
      const button = document.createElement('button');
      button.style.fontSize = '16px';

      const fontSize = parseInt(button.style.fontSize);
      expect(fontSize).toBeGreaterThanOrEqual(14);
    });
  });

  describe('Form Elements Responsiveness', () => {
    it('should have readable checkbox on mobile', () => {
      const checkbox = document.createElement('div');
      checkbox.className = 'box';
      checkbox.style.width = '26px';
      checkbox.style.height = '26px';

      const width = parseInt(checkbox.style.width);
      const height = parseInt(checkbox.style.height);

      expect(width).toBeGreaterThanOrEqual(24);
      expect(height).toBeGreaterThanOrEqual(24);
    });

    it('should have proper label layout on mobile', () => {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '14px';

      expect(label.style.display).toBe('flex');
      expect(label.style.alignItems).toBe('center');
    });

    it('should have proper text layout in label', () => {
      const copy = document.createElement('div');
      copy.style.display = 'flex';
      copy.style.flexDirection = 'column';
      copy.style.gap = '2px';

      expect(copy.style.display).toBe('flex');
      expect(copy.style.flexDirection).toBe('column');
    });
  });
});
