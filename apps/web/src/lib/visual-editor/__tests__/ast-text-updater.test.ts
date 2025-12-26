/**
 * Tests for AST-based text updater
 *
 * These tests demonstrate edge cases that the string-based approach
 * cannot handle correctly, but the AST-based approach can.
 */

import { describe, it, expect } from 'vitest';
import { updateFileWithTextAST } from '../ast-text-updater';

describe('updateFileWithTextAST', () => {
  describe('Edge cases that string-based parsing struggles with', () => {
    it('should handle JSX fragments', () => {
      const fileContent = `
function Component() {
  return (
    <>
      Old text
      <Icon />
    </>
  );
}
      `.trim();

      const result = updateFileWithTextAST(
        fileContent,
        'test.tsx',
        {
          currentClasses: [],
          shipperId: 'test:3:5', // Points to the fragment
        },
        'New text'
      );

      expect(result).toContain('New text');
      expect(result).toContain('<Icon />');
      expect(result).not.toContain('Old text');
    });

    it('should preserve JSX elements while updating text', () => {
      const fileContent = `
function Button() {
  return (
    <button className="btn">
      Click me
      <ChevronRight />
    </button>
  );
}
      `.trim();

      const result = updateFileWithTextAST(
        fileContent,
        'Button.tsx',
        {
          currentClasses: ['btn'],
        },
        'Submit'
      );

      expect(result).toContain('Submit');
      expect(result).toContain('<ChevronRight />');
      expect(result).not.toContain('Click me');
    });

    it('should handle complex nested expressions in attributes', () => {
      const fileContent = `
function Card() {
  return (
    <div className={cn("card", {
      "card-active": isActive,
      "card-disabled": !enabled
    })}>
      Original text
    </div>
  );
}
      `.trim();

      const result = updateFileWithTextAST(
        fileContent,
        'Card.tsx',
        {
          currentClasses: ['card'],
        },
        'Updated text'
      );

      expect(result).toContain('Updated text');
      expect(result).not.toContain('Original text');
      // Should preserve the complex className expression
      expect(result).toContain('cn("card"');
      expect(result).toContain('"card-active": isActive');
    });

    it('should handle arrow functions in JSX', () => {
      const fileContent = `
function List() {
  return (
    <div className="list">
      Header text
      {items.map((item) => (
        <Item key={item.id} {...item} />
      ))}
    </div>
  );
}
      `.trim();

      const result = updateFileWithTextAST(
        fileContent,
        'List.tsx',
        {
          currentClasses: ['list'],
        },
        'New header'
      );

      expect(result).toContain('New header');
      expect(result).not.toContain('Header text');
      // Should preserve the map function
      expect(result).toContain('items.map');
      expect(result).toContain('<Item key={item.id}');
    });

    it('should handle multi-line attributes', () => {
      const fileContent = `
function Component() {
  return (
    <div
      className="container"
      onClick={() => {
        handleClick();
        doSomething();
      }}
      data-testid="test"
    >
      Old content
    </div>
  );
}
      `.trim();

      const result = updateFileWithTextAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['container'],
        },
        'New content'
      );

      expect(result).toContain('New content');
      expect(result).not.toContain('Old content');
      // Should preserve multi-line onClick
      expect(result).toContain('handleClick()');
      expect(result).toContain('doSomething()');
    });

    it('should throw error for self-closing elements', () => {
      const fileContent = `
function Component() {
  return <div className="test" />;
}
      `.trim();

      expect(() => {
        updateFileWithTextAST(
          fileContent,
          'Component.tsx',
          {
            currentClasses: ['test'],
          },
          'New text'
        );
      }).toThrow('Cannot update text content: element is self-closing');
    });

    it('should handle elements with comments', () => {
      const fileContent = `
function Component() {
  return (
    <div className="wrapper">
      {/* This is a comment */}
      Old text
      {/* Another comment */}
      <Icon />
    </div>
  );
}
      `.trim();

      const result = updateFileWithTextAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['wrapper'],
        },
        'New text'
      );

      expect(result).toContain('New text');
      expect(result).not.toContain('Old text');
      expect(result).toContain('<Icon />');
      // Comments are JSX expressions, they should be preserved
      expect(result).toContain('This is a comment');
    });

    it('should handle template literals in className', () => {
      const fileContent = `
function Component({ size }: Props) {
  return (
    <div className={\`card card-\${size}\`}>
      Original
    </div>
  );
}
      `.trim();

      const result = updateFileWithTextAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['card'],
        },
        'Updated'
      );

      expect(result).toContain('Updated');
      expect(result).not.toContain('Original');
      // Should preserve template literal
      expect(result).toContain('`card card-${size}`');
    });
  });

  describe('Shipper ID positioning', () => {
    it('should find element by exact position', () => {
      const fileContent = `
function App() {
  return (
    <div className="first">First</div>
    <div className="second">Second</div>
    <div className="third">Third</div>
  );
}
      `.trim();

      // Line 4, column 5 points to the second div
      const result = updateFileWithTextAST(
        fileContent,
        'App.tsx',
        {
          currentClasses: ['second'],
          shipperId: 'App:4:5',
        },
        'Updated second'
      );

      expect(result).toContain('Updated second');
      expect(result).toContain('First'); // Should not modify first
      expect(result).toContain('Third'); // Should not modify third
      expect(result).not.toContain('Second');
    });
  });

  describe('Fallback to className matching', () => {
    it('should fall back to className when shipper ID is invalid', () => {
      const fileContent = `
function Component() {
  return (
    <div className="unique-class">
      Old text
    </div>
  );
}
      `.trim();

      const result = updateFileWithTextAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['unique-class'],
          shipperId: 'invalid-id', // Invalid format
        },
        'New text'
      );

      expect(result).toContain('New text');
      expect(result).not.toContain('Old text');
    });

    it('should match element with best className overlap', () => {
      const fileContent = `
function Component() {
  return (
    <>
      <div className="btn">Partial match</div>
      <div className="btn btn-primary btn-lg">Best match</div>
      <div className="btn btn-primary">Good match</div>
    </>
  );
}
      `.trim();

      const result = updateFileWithTextAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['btn', 'btn-primary', 'btn-lg'],
        },
        'Updated'
      );

      // Should update the element with all three classes
      expect(result).toContain('Updated');
      expect(result).not.toContain('Best match');
      // Other elements should remain unchanged
      expect(result).toContain('Partial match');
      expect(result).toContain('Good match');
    });
  });
});
