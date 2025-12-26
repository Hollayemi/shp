/**
 * Tests for Syntax Checker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { quickSyntaxCheck } from './syntax-checker.js';

describe('Syntax Checker', () => {
  describe('JavaScript/TypeScript', () => {
    it('should accept valid TypeScript code', async () => {
      const code = `
        import React from 'react';
        
        export const MyComponent = () => {
          const [count, setCount] = React.useState(0);
          return <div>{count}</div>;
        };
      `;

      const result = await quickSyntaxCheck('src/MyComponent.tsx', code);
      expect(result.valid).toBe(true);
    });

    it('should reject truncated code (too small)', async () => {
      const code = 'import';

      const result = await quickSyntaxCheck('src/App.tsx', code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too small');
    });

    it('should detect unclosed braces', async () => {
      const code = `
        export const Component = () => {
          return <div>
            <h1>Title</h1>
          </div>
      `;

      const result = await quickSyntaxCheck('src/Component.tsx', code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unclosed');
    });

    it('should detect mismatched brackets', async () => {
      const code = `
        const arr = [1, 2, 3};
      `;

      const result = await quickSyntaxCheck('src/utils.ts', code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Mismatched');
    });

    it('should detect unclosed parentheses', async () => {
      const code = `
        function test() {
          console.log("test"
        }
      `;

      const result = await quickSyntaxCheck('src/test.ts', code);
      expect(result.valid).toBe(false);
      // Can be either "Unclosed" or "Mismatched bracket" depending on detection order
      expect(result.error).toMatch(/Unclosed|Mismatched bracket/);
    });

    it('should handle strings with brackets', async () => {
      const code = `
        const message = "This has { braces } in string";
        const valid = true;
      `;

      const result = await quickSyntaxCheck('src/strings.ts', code);
      expect(result.valid).toBe(true);
    });

    it('should handle comments with brackets', async () => {
      const code = `
        // This comment has { braces }
        /* Multi-line comment
           with { more } braces */
        const valid = true;
      `;

      const result = await quickSyntaxCheck('src/comments.ts', code);
      expect(result.valid).toBe(true);
    });

    it('should detect incomplete statements', async () => {
      const code = `
        const value = 1 +
      `;

      const result = await quickSyntaxCheck('src/incomplete.ts', code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('incomplete statement');
    });

    it('should detect truncation markers', async () => {
      const code = `
        export const Component = () => {
          return <div>
            /* File truncated - 500 characters omitted */
          </div>
        };
      `;

      const result = await quickSyntaxCheck('src/truncated.tsx', code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('truncation marker');
    });
  });

  describe('JSX', () => {
    it('should accept valid JSX', async () => {
      const code = `
        import React from 'react';
        
        export const App = () => {
          return (
            <div className="container">
              <Header title="My App" />
              <Main>
                <Content />
              </Main>
              <Footer />
            </div>
          );
        };
      `;

      const result = await quickSyntaxCheck('src/App.tsx', code);
      expect(result.valid).toBe(true);
    });

    it('should detect severely imbalanced JSX tags', async () => {
      // Brackets are balanced, but JSX tags are not
      const code = `
        export const Broken = () => {
          return (
            <div>
              <Header />
              <Main>
                <Content />
              </Main>
              <Footer />
            </div>
            <Extra />
            <AnotherOne />
            <MoreTags />
            <EvenMore />
            <YetAnother />
            <StillMore />
          );
        };
      `;

      const result = await quickSyntaxCheck('src/Broken.tsx', code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('JSX tag mismatch');
    });

    it('should handle self-closing JSX tags', async () => {
      const code = `
        export const Icons = () => {
          return (
            <div>
              <Icon name="home" />
              <Icon name="user" />
              <Icon name="settings" />
            </div>
          );
        };
      `;

      const result = await quickSyntaxCheck('src/Icons.tsx', code);
      expect(result.valid).toBe(true);
    });

    it('should handle JSX fragments', async () => {
      const code = `
        export const Fragment = () => {
          return (
            <>
              <div>First</div>
              <div>Second</div>
            </>
          );
        };
      `;

      const result = await quickSyntaxCheck('src/Fragment.tsx', code);
      expect(result.valid).toBe(true);
    });
  });

  describe('JSON', () => {
    it('should accept valid JSON', async () => {
      const json = `{
        "name": "test-app",
        "version": "1.0.0",
        "dependencies": {
          "react": "^18.0.0"
        }
      }`;

      const result = await quickSyntaxCheck('package.json', json);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid JSON', async () => {
      const json = `{
        "name": "test-app",
        "version": "1.0.0",
        "dependencies": {
          "react": "^18.0.0"
        }
      `; // Missing closing brace

      const result = await quickSyntaxCheck('package.json', json);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should reject JSON with trailing commas', async () => {
      const json = `{
        "name": "test-app",
        "version": "1.0.0",
      }`;

      const result = await quickSyntaxCheck('data.json', json);
      expect(result.valid).toBe(false);
    });
  });

  describe('CSS', () => {
    it('should accept valid CSS', async () => {
      const css = `
        .container {
          display: flex;
          justify-content: center;
        }
        
        @media (max-width: 768px) {
          .container {
            flex-direction: column;
          }
        }
      `;

      const result = await quickSyntaxCheck('styles.css', css);
      expect(result.valid).toBe(true);
    });

    it('should detect mismatched braces in CSS', async () => {
      const css = `
        .container {
          display: flex;
          justify-content: center;
        
        .another {
          color: red;
        }
      `; // Missing closing brace for .container

      const result = await quickSyntaxCheck('styles.css', css);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Mismatched braces');
    });
  });

  describe('HTML', () => {
    it('should accept valid HTML', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test</title>
          </head>
          <body>
            <div id="root"></div>
            <script src="/main.js"></script>
          </body>
        </html>
      `;

      const result = await quickSyntaxCheck('index.html', html);
      expect(result.valid).toBe(true);
    });

    it('should detect mismatched HTML tags', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test</title>
          <body>
            <div id="root"></div>
          </body>
        </html>
      `; // Missing </head>

      const result = await quickSyntaxCheck('index.html', html);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Mismatched HTML tags');
    });

    it('should handle self-closing HTML tags', async () => {
      const html = `
        <html>
          <body>
            <img src="test.jpg" />
            <br />
            <input type="text" />
          </body>
        </html>
      `;

      const result = await quickSyntaxCheck('page.html', html);
      expect(result.valid).toBe(true);
    });

    it('should allow implicit void HTML tags', async () => {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <link rel="stylesheet" href="/styles.css">
            <title>Void Tags</title>
          </head>
          <body>
            <div id="root">
              <img src="/logo.png" alt="Logo">
            </div>
          </body>
        </html>
      `;

      const result = await quickSyntaxCheck('index.html', html);
      expect(result.valid).toBe(true);
    });
  });

  describe('Unknown file types', () => {
    it('should pass unknown file types', async () => {
      const content = 'random content with no specific syntax';

      const result = await quickSyntaxCheck('file.txt', content);
      expect(result.valid).toBe(true);
    });

    it('should pass markdown files', async () => {
      const markdown = `
        # Title
        
        Some content with **bold** and *italic*.
        
        \`\`\`javascript
        const code = "in markdown";
        \`\`\`
      `;

      const result = await quickSyntaxCheck('README.md', markdown);
      expect(result.valid).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty files', async () => {
      const result = await quickSyntaxCheck('empty.ts', '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too small');
    });

    it('should handle very large files', async () => {
      const largeCode = `
        export const LargeComponent = () => {
          return (
            <div>
              ${'<p>Line</p>\n'.repeat(1000)}
            </div>
          );
        };
      `;

      const result = await quickSyntaxCheck('Large.tsx', largeCode);
      expect(result.valid).toBe(true);
    });

    it('should handle nested structures', async () => {
      const nested = `
        const obj = {
          a: {
            b: {
              c: {
                d: [1, 2, { e: [3, 4, { f: true }] }]
              }
            }
          }
        };
      `;

      const result = await quickSyntaxCheck('nested.ts', nested);
      expect(result.valid).toBe(true);
    });
  });
});
