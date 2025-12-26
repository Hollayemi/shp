/**
 * Tests for AST-based className updater
 *
 * These tests validate that the AST approach correctly handles all className patterns,
 * especially the complex cn() scenarios that the regex-based approach fails on.
 */

import { describe, it, expect } from 'vitest';
import { updateClassNameAST } from '../ast-classname-updater';

describe('updateClassNameAST', () => {
  describe('cn() call handling - HIGH priority fix', () => {
    it('should update classes across multiple string literals in cn()', () => {
      const fileContent = `
function Button() {
  return (
    <button className={cn('btn', 'btn-primary')}>
      Click me
    </button>
  );
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'Button.tsx',
        {
          currentClasses: ['btn', 'btn-primary'],
        },
        {
          classesToAdd: ['btn-lg'],
          classesToRemove: ['btn-primary'],
        }
      );

      expect(result).toContain('btn');
      expect(result).toContain('btn-lg');
      expect(result).not.toContain('btn-primary');
    });

    it('should handle cn() with conditional classes', () => {
      const fileContent = `
function Card({ isActive }: Props) {
  return (
    <div className={cn('card', isActive && 'card-active', 'card-shadow')}>
      Content
    </div>
  );
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'Card.tsx',
        {
          currentClasses: ['card'],
        },
        {
          classesToAdd: ['card-bordered'],
          classesToRemove: ['card-shadow'],
        }
      );

      expect(result).toContain('card');
      expect(result).toContain('card-bordered');
      expect(result).toContain('isActive && \'card-active\'');
      expect(result).not.toContain('card-shadow');
    });

    it('should handle cn() with object conditionals', () => {
      const fileContent = `
function Badge({ variant }: Props) {
  return (
    <span className={cn('badge', { 'badge-primary': variant === 'primary' })}>
      Text
    </span>
  );
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'Badge.tsx',
        {
          currentClasses: ['badge'],
        },
        {
          classesToAdd: ['badge-sm'],
          classesToRemove: [],
        }
      );

      expect(result).toContain('badge');
      expect(result).toContain('badge-sm');
      expect(result).toContain('badge-primary');
    });

    it('should handle cn() with template literals', () => {
      const fileContent = `
function Alert({ type }: Props) {
  return (
    <div className={cn(\`alert alert-\${type}\`, 'alert-dismissible')}>
      Message
    </div>
  );
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'Alert.tsx',
        {
          currentClasses: ['alert'],
        },
        {
          classesToAdd: ['alert-bordered'],
          classesToRemove: ['alert-dismissible'],
        }
      );

      expect(result).toContain('alert');
      expect(result).toContain('alert-bordered');
      expect(result).toContain('`alert alert-${type}`');
      expect(result).not.toContain('alert-dismissible');
    });

    it('should handle cn() with mixed argument types', () => {
      const fileContent = `
function Component({ size, disabled }: Props) {
  return (
    <button className={cn(
      'btn',
      \`btn-\${size}\`,
      disabled && 'btn-disabled',
      { 'btn-loading': isLoading }
    )}>
      Submit
    </button>
  );
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['btn'],
        },
        {
          classesToAdd: ['btn-primary'],
          classesToRemove: [],
        }
      );

      expect(result).toContain('btn');
      expect(result).toContain('btn-primary');
      // Should preserve all other arguments
      expect(result).toContain('`btn-${size}`');
      expect(result).toContain('disabled && \'btn-disabled\'');
      expect(result).toContain('{ \'btn-loading\': isLoading }');
    });
  });

  describe('Simple className patterns', () => {
    it('should handle string literal className', () => {
      const fileContent = `
function Component() {
  return <div className="container mx-auto">Content</div>;
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['container', 'mx-auto'],
        },
        {
          classesToAdd: ['p-4'],
          classesToRemove: ['mx-auto'],
        }
      );

      expect(result).toContain('container');
      expect(result).toContain('p-4');
      expect(result).not.toContain('mx-auto');
    });

    it('should handle className in JSX expression', () => {
      const fileContent = `
function Component() {
  return <div className={"flex items-center"}>Content</div>;
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['flex', 'items-center'],
        },
        {
          classesToAdd: ['gap-2'],
          classesToRemove: [],
        }
      );

      expect(result).toContain('flex');
      expect(result).toContain('items-center');
      expect(result).toContain('gap-2');
    });

    it('should add className attribute when missing', () => {
      const fileContent = `function Component() {
  return <div id="container">Content</div>;
}`;

      const result = updateClassNameAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: [],
          shipperId: 'Component:2:10', // Line 2 is where <div starts
        },
        {
          classesToAdd: ['bg-white', 'rounded'],
          classesToRemove: [],
        }
      );

      expect(result).toContain('className="bg-white rounded"');
      expect(result).toContain('id="container"');
    });
  });

  describe('Template literal className', () => {
    it('should wrap template literal with cn() when updating', () => {
      const fileContent = `
function Component({ size }: Props) {
  return <div className={\`card card-\${size}\`}>Content</div>;
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['card'],
        },
        {
          classesToAdd: ['card-bordered'],
          classesToRemove: [],
        }
      );

      expect(result).toContain('cn(');
      expect(result).toContain('`card card-${size}`');
      expect(result).toContain('card-bordered');
    });
  });

  describe('Element finding strategies', () => {
    it('should find element by shipper ID (precise positioning)', () => {
      const fileContent = `
function App() {
  return (
    <>
      <div className="first">First</div>
      <div className="second">Second</div>
      <div className="third">Third</div>
    </>
  );
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'App.tsx',
        {
          currentClasses: ['second'],
          shipperId: 'App:5:7', // Points to second div
        },
        {
          classesToAdd: ['updated'],
          classesToRemove: [],
        }
      );

      expect(result).toContain('first');
      expect(result).toContain('second updated');
      expect(result).toContain('third');
      // Should only update the second div
      expect(result).not.toContain('first updated');
      expect(result).not.toContain('third updated');
    });

    it('should find element by className when shipper ID unavailable', () => {
      const fileContent = `
function Component() {
  return (
    <div className="unique-class">
      Content
    </div>
  );
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['unique-class'],
        },
        {
          classesToAdd: ['another-class'],
          classesToRemove: [],
        }
      );

      expect(result).toContain('unique-class');
      expect(result).toContain('another-class');
    });

    it('should match element with best className overlap', () => {
      const fileContent = `
function Component() {
  return (
    <>
      <div className="btn">Partial</div>
      <div className="btn btn-primary">Good</div>
      <div className="btn btn-primary btn-lg">Best</div>
    </>
  );
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['btn', 'btn-primary', 'btn-lg'],
        },
        {
          classesToAdd: ['updated'],
          classesToRemove: [],
        }
      );

      // Should update the best match (all 3 classes)
      expect(result).toMatch(/btn btn-primary btn-lg updated/);
      // Others should remain unchanged
      expect(result).toContain('<div className="btn">Partial</div>');
      expect(result).toContain('<div className="btn btn-primary">Good</div>');
    });
  });

  describe('Class removal patterns', () => {
    it('should remove classes by exact match', () => {
      const fileContent = `
function Component() {
  return <div className="btn btn-primary btn-lg">Button</div>;
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['btn', 'btn-primary', 'btn-lg'],
        },
        {
          classesToAdd: ['btn-sm'],
          classesToRemove: ['btn-lg'],
        }
      );

      expect(result).toContain('btn');
      expect(result).toContain('btn-primary');
      expect(result).toContain('btn-sm');
      expect(result).not.toContain('btn-lg');
    });

    it('should remove classes by prefix pattern', () => {
      const fileContent = `
function Component() {
  return <div className="text-red-500 text-lg">Text</div>;
}
      `.trim();

      const result = updateClassNameAST(
        fileContent,
        'Component.tsx',
        {
          currentClasses: ['text-red-500', 'text-lg'],
        },
        {
          classesToAdd: ['text-blue-600'],
          classesToRemove: ['text-'], // Should remove all text-* classes
        }
      );

      expect(result).toContain('text-blue-600');
      expect(result).not.toContain('text-red-500');
      expect(result).not.toContain('text-lg');
    });
  });
});
