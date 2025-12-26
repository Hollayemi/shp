// Demo file data mapping for each step of the TODO_APP_DEMO_STEPS
export interface DemoFileData {
  [filePath: string]: string;
}

export interface DemoStepFiles {
  stepIndex: number;
  files: DemoFileData;
  description: string;
}

// Step 0: Initial project setup (empty state)
const STEP_0_FILES: DemoFileData = {};

// Step 1: Build a todo list application
const STEP_1_FILES: DemoFileData = {
  "src/App.tsx": `import React from 'react';
import TodoApp from './components/TodoApp';
import './App.css';

function App() {
  return (
    <div className="App">
      <TodoApp />
    </div>
  );
}

export default App;`,
  "src/components/TodoApp.tsx": `import React, { useState } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const TodoApp = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { id: Date.now(), text: input, completed: false }]);
      setInput('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  return (
    <div className="todo-app">
      <h1>My Todo List</h1>
      <div className="add-todo">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a new task..."
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <ul className="todo-list">
        {todos.map(todo => (
          <li key={todo.id} className={todo.completed ? 'completed' : ''}>
            <span onClick={() => toggleTodo(todo.id)}>{todo.text}</span>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TodoApp;`,
  "package.json": `{
  "name": "todo-app",
  "version": "0.1.0",
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "typescript": "^4.9.0"
  }
}`
};

// Step 2: Login page added
const STEP_2_FILES: DemoFileData = {
  ...STEP_1_FILES,
  "src/components/LoginPage.tsx": `import React, { useState } from 'react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (email && password) {
      setLoading(true);
      setError('');
      // Simulate authentication
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (email === 'demo@example.com' && password === 'password') {
        // Login successful - redirect to todo app
        window.location.href = '/todos';
      } else {
        setError('Invalid credentials. Use demo@example.com / password');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8 pt-24">
      <div className="max-w-md mx-auto bg-card rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h2>
          <p className="text-muted-foreground">Sign in to access your todo list</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          
          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                Signing in...
              </div>
            ) : 'Sign In'}
          </button>
        </div>
        
        <div className="mt-6 p-4 bg-muted/30 rounded-md border border-border">
          <p className="text-sm font-medium text-foreground mb-2">Demo Credentials</p>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">📧 Email: demo@example.com</p>
            <p className="text-xs text-muted-foreground">🔑 Password: password</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;`,
  "src/context/AuthContext.tsx": `import React, { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (email === 'demo@example.com' && password === 'password') {
      setUser({
        id: '1',
        email: 'demo@example.com',
        name: 'Demo User'
      });
      setIsLoading(false);
      return true;
    }
    
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};`
};

// Step 3: Styling updated to dark theme
const STEP_3_FILES: DemoFileData = {
  ...STEP_2_FILES,
  "src/styles/globals.css": `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Dark theme with glassmorphism effects */
:root {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 262.1 83.3% 57.8%;
  --primary-foreground: 210 40% 98%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 262.1 83.3% 57.8%;
}

body {
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
  min-height: 100vh;
}

/* Glassmorphism effects */
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
}

/* Smooth animations */
* {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.5);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.7);
}

/* Gradient text */
.gradient-text {
  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Button hover effects */
.btn-primary {
  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
  transition: all 0.3s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(139, 92, 246, 0.3);
}

/* Card hover effects */
.card-hover {
  transition: all 0.3s ease;
}

.card-hover:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

/* Loading animation */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}`
};

// Step 4: Categories and tags added
const STEP_4_FILES: DemoFileData = {
  ...STEP_3_FILES,
  "src/components/CategoryManager.tsx": `import React, { useState } from 'react';

interface Category {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  category: string;
  tags: string[];
}

const CategoryManager: React.FC = () => {
  const categories: Category[] = [
    { id: 'work', name: 'Work', color: 'bg-blue-500', count: 3 },
    { id: 'personal', name: 'Personal', color: 'bg-green-500', count: 2 },
    { id: 'health', name: 'Health', color: 'bg-red-500', count: 1 },
    { id: 'shopping', name: 'Shopping', color: 'bg-yellow-500', count: 2 }
  ];

  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, text: 'Finish project proposal', completed: false, category: 'work', tags: ['urgent', 'deadline'] },
    { id: 2, text: 'Review team feedback', completed: true, category: 'work', tags: ['team', 'review'] },
    { id: 3, text: 'Buy groceries', completed: false, category: 'shopping', tags: ['weekly', 'food'] },
    { id: 4, text: 'Morning workout', completed: true, category: 'health', tags: ['fitness', 'routine'] },
    { id: 5, text: 'Call mom', completed: false, category: 'personal', tags: ['family', 'important'] }
  ]);

  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTag, setFilterTag] = useState('');

  const filteredTodos = todos.filter(todo => {
    const categoryMatch = filterCategory === 'all' || todo.category === filterCategory;
    const tagMatch = !filterTag || todo.tags.some(tag => 
      tag.toLowerCase().includes(filterTag.toLowerCase())
    );
    return categoryMatch && tagMatch;
  });

  const allTags = [...new Set(todos.flatMap(todo => todo.tags))];

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-64 bg-card rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Categories</h2>
        
        <div className="space-y-2 mb-6">
          <button
            onClick={() => setFilterCategory('all')}
            className={\`w-full text-left px-3 py-2 rounded-md transition-colors \${
              filterCategory === 'all' 
                ? 'bg-primary text-primary-foreground' 
                : 'text-foreground hover:bg-muted'
            }\`}
          >
            All Tasks ({todos.length})
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setFilterCategory(category.id)}
              className={\`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center justify-between \${
                filterCategory === category.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-foreground hover:bg-muted'
              }\`}
            >
              <div className="flex items-center">
                <div className={\`w-3 h-3 rounded-full \${category.color} mr-2\`}></div>
                {category.name}
              </div>
              <span className="text-sm">
                {todos.filter(todo => todo.category === category.id).length}
              </span>
            </button>
          ))}
        </div>

        <h3 className="text-sm font-medium text-foreground mb-3">Popular Tags</h3>
        <div className="flex flex-wrap gap-1">
          {allTags.slice(0, 8).map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
              className={\`px-2 py-1 text-xs rounded-full transition-colors \${
                filterTag === tag
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }\`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="space-y-3">
          {filteredTodos.map(todo => (
            <div key={todo.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
              <div className="flex items-center flex-1">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  className="mr-3 h-4 w-4 text-primary focus:ring-primary border-border rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={\`\${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'}\`}>
                      {todo.text}
                    </span>
                    <div className={\`w-2 h-2 rounded-full \${categories.find(cat => cat.id === todo.category)?.color || 'bg-muted'}\`}></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {categories.find(cat => cat.id === todo.category)?.name}
                    </span>
                    {todo.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;`,
  "src/types/todo.ts": `export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  category: string;
  tags: string[];
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  count: number;
}

export interface TodoFilters {
  category: string;
  tag: string;
  completed?: boolean;
}`
};

// Step 5: Deployment configuration
const STEP_5_FILES: DemoFileData = {
  ...STEP_4_FILES,
  "package.json": `{
  "name": "todo-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "deploy": "npm run build && vercel --prod",
    "lint": "next lint"
  },
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "next": "^14.0.0",
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  },
  "devDependencies": {
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0"
  }
}`,
  "vercel.json": `{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "pages/api/**/*.js": {
      "runtime": "nodejs18.x"
    }
  }
}`,
  "README.md": `# Todo App

A modern, feature-rich todo application built with React, Next.js, and TypeScript.

## Features

- ✅ Create, edit, and delete todos
- 🔐 User authentication
- 🎨 Modern dark theme with glassmorphism
- 🏷️ Categories and tags for organization
- 📱 Responsive design
- ⚡ Fast and optimized

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

This app is configured for easy deployment on Vercel:

\`\`\`bash
npm run deploy
\`\`\`

## Tech Stack

- **Framework:** Next.js 14
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Demo Credentials

- Email: demo@example.com
- Password: password
`
};


export const DEMO_FILE_STEPS: DemoStepFiles[] = [
  { stepIndex: 0, files: STEP_0_FILES, description: "Empty project" },
  { stepIndex: 1, files: STEP_1_FILES, description: "Basic todo app with React components" },
  { stepIndex: 2, files: STEP_2_FILES, description: "Authentication system with login page" },
  { stepIndex: 3, files: STEP_3_FILES, description: "Modern dark theme styling" },
  { stepIndex: 4, files: STEP_4_FILES, description: "Categories and tags for task organization" },
  { stepIndex: 5, files: STEP_5_FILES, description: "Deployment configuration for production" }
];

// Helper function to get files for a specific demo step
export const getFilesForDemoStep = (stepIndex: number): DemoFileData => {
  const step = DEMO_FILE_STEPS.find(s => s.stepIndex === stepIndex);
  return step?.files || STEP_0_FILES;
};

// Helper function to get file paths as Set for FileExplorer compatibility
export const getFilePathsForDemoStep = (stepIndex: number): Set<string> => {
  const files = getFilesForDemoStep(stepIndex);
  return new Set(Object.keys(files).map(path => `/home/daytona/workspace/${path}`));
};
