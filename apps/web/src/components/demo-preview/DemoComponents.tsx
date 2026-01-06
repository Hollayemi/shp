import React, { useState } from 'react';

// Navigation component for switching between demo steps
interface DemoNavigationProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  totalSteps: number;
}

const DemoNavigation: React.FC<DemoNavigationProps> = ({ currentStep, onStepChange, totalSteps }) => {
  const steps = [
    'Build Todo App',
    'Add Login',
    'Update Styling', 
    'Add Categories',
    'Deploy App'
  ];

  return (
    <div className="fixed top-4 left-4 right-4 z-50">
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-foreground">Demo Steps</h3>
          <span className="text-xs text-muted-foreground">{currentStep + 1} of {totalSteps}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {steps.map((step, index) => (
            <button
              key={index}
              onClick={() => onStepChange(index)}
              className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                currentStep === index
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {step}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Step 1: Build a todo list application
export const TodoAppStep1: React.FC = () => {
  const [todos, setTodos] = useState<Array<{id: number, text: string, completed: boolean}>>([
    { id: 1, text: 'Learn React basics', completed: true },
    { id: 2, text: 'Build todo app', completed: false },
    { id: 3, text: 'Add styling', completed: false }
  ]);
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
    <div className="min-h-screen bg-background p-8 pt-24">
      <div className="max-w-md mx-auto bg-card rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6 text-foreground">My Todo List</h1>
        
        <div className="flex mb-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 px-4 py-2 border border-border rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          />
          <button
            onClick={addTodo}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-r-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          >
            Add
          </button>
        </div>

        <div className="space-y-2">
          {todos.map(todo => (
            <div key={todo.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <span 
                onClick={() => toggleTodo(todo.id)}
                className={`cursor-pointer flex-1 ${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
              >
                {todo.text}
              </span>
              <button 
                onClick={() => deleteTodo(todo.id)}
                className="ml-3 px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
          {todos.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No tasks yet. Add one above!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Step 2: Add a login page
export const TodoAppStep2: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [todos, setTodos] = useState<Array<{id: number, text: string, completed: boolean}>>([
    { id: 1, text: 'Welcome to your secure todo app!', completed: false },
    { id: 2, text: 'Your data is now protected', completed: true },
    { id: 3, text: 'Add your personal tasks', completed: false }
  ]);
  const [input, setInput] = useState('');

  const handleLogin = async () => {
    if (email && password) {
      setLoading(true);
      setError('');
      // Simulate authentication
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (email === 'demo@example.com' && password === 'password') {
        setIsLoggedIn(true);
      } else {
        setError('Invalid credentials. Use demo@example.com / password');
      }
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setEmail('demo@example.com');
    setPassword('password');
  };

  if (!isLoggedIn) {
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
  }

  // Authenticated todo app with logout

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
    <div className="min-h-screen bg-background p-8 pt-24">
      <div className="max-w-md mx-auto bg-card rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Secure Todo List</h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-sm bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
          >
            Logout
          </button>
        </div>
        
        <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-md">
          <p className="text-sm text-primary">🔐 You&apos;re now logged in securely!</p>
        </div>
        
        <div className="flex mb-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 px-4 py-2 border border-border rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          />
          <button
            onClick={addTodo}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-r-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          >
            Add
          </button>
        </div>

        <div className="space-y-2">
          {todos.map(todo => (
            <div key={todo.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <span 
                onClick={() => toggleTodo(todo.id)}
                className={`cursor-pointer flex-1 ${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
              >
                {todo.text}
              </span>
              <button 
                onClick={() => deleteTodo(todo.id)}
                className="ml-3 px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Step 3: Modern dark theme styling
export const TodoAppStep3: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [todos, setTodos] = useState<Array<{id: number, text: string, completed: boolean}>>([
    { id: 1, text: 'Experience the new dark theme', completed: false },
    { id: 2, text: 'Notice the glassmorphism effects', completed: true },
    { id: 3, text: 'Enjoy smooth animations', completed: false }
  ]);
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

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8 pt-24">
        <div className="max-w-md mx-auto bg-card/80 backdrop-blur-lg border border-border/50 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h2>
            <p className="text-muted-foreground">Experience the new dark theme</p>
          </div>
          
          <button
            onClick={() => setIsLoggedIn(true)}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            Sign In to Experience Dark Theme
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8 pt-24">
      <div className="max-w-md mx-auto bg-card/80 backdrop-blur-lg border border-border/50 rounded-2xl shadow-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            ✨ Styled Todo App
          </h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-sm bg-muted/50 text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
          >
            Logout
          </button>
        </div>
        
        <div className="mb-4 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl backdrop-blur-sm">
          <p className="text-sm text-purple-200">🎨 Modern dark theme with glassmorphism effects and smooth animations!</p>
        </div>
        
        <div className="flex mb-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 px-4 py-3 bg-background/50 border border-border/50 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder-muted-foreground backdrop-blur-sm"
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          />
          <button
            onClick={addTodo}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-r-xl hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            Add
          </button>
        </div>

        <div className="space-y-3">
          {todos.map(todo => (
            <div key={todo.id} className="group flex items-center justify-between p-4 bg-card/40 backdrop-blur-sm border border-border/30 rounded-xl hover:bg-card/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
              <span 
                onClick={() => toggleTodo(todo.id)}
                className={`cursor-pointer flex-1 transition-all duration-300 ${
                  todo.completed 
                    ? 'line-through text-muted-foreground' 
                    : 'text-foreground group-hover:text-purple-200'
                }`}
              >
                {todo.text}
              </span>
              <button 
                onClick={() => deleteTodo(todo.id)}
                className="ml-3 px-3 py-1 text-sm bg-destructive/80 text-destructive-foreground rounded-lg hover:bg-destructive transition-all duration-300 transform hover:scale-105 opacity-0 group-hover:opacity-100"
              >
                Delete
              </button>
            </div>
          ))}
          {todos.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">✨</div>
              <p>Your stylish todo list awaits!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Step 4: Categories and tags system
export const TodoAppStep4: React.FC = () => {
  const categories = [
    { id: 'work', name: 'Work', color: 'bg-blue-500', count: 3 },
    { id: 'personal', name: 'Personal', color: 'bg-green-500', count: 2 },
    { id: 'health', name: 'Health', color: 'bg-red-500', count: 1 },
    { id: 'shopping', name: 'Shopping', color: 'bg-yellow-500', count: 2 }
  ];

  const [todos, setTodos] = useState<Array<{
    id: number; 
    text: string; 
    completed: boolean; 
    category: string;
    tags: string[];
  }>>([
    { id: 1, text: 'Finish project proposal', completed: false, category: 'work', tags: ['urgent', 'deadline'] },
    { id: 2, text: 'Review team feedback', completed: true, category: 'work', tags: ['team', 'review'] },
    { id: 3, text: 'Buy groceries', completed: false, category: 'shopping', tags: ['weekly', 'food'] },
    { id: 4, text: 'Morning workout', completed: true, category: 'health', tags: ['fitness', 'routine'] },
    { id: 5, text: 'Call mom', completed: false, category: 'personal', tags: ['family', 'important'] }
  ]);
  
  const [input, setInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('work');
  const [newTag, setNewTag] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTag, setFilterTag] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      const tags = newTag.split(',').map(tag => tag.trim()).filter(tag => tag);
      setTodos([...todos, { 
        id: Date.now(), 
        text: input, 
        completed: false,
        category: selectedCategory,
        tags: tags
      }]);
      setInput('');
      setNewTag('');
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

  const filteredTodos = todos.filter(todo => {
    const categoryMatch = filterCategory === 'all' || todo.category === filterCategory;
    const tagMatch = !filterTag || todo.tags.some(tag => tag.toLowerCase().includes(filterTag.toLowerCase()));
    return categoryMatch && tagMatch;
  });

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.color || 'bg-muted';
  };

  const allTags = [...new Set(todos.flatMap(todo => todo.tags))];

  return (
    <div className="min-h-screen bg-background p-8 pt-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 bg-card rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Categories</h2>
            
            <div className="space-y-2 mb-6">
              <button
                onClick={() => setFilterCategory('all')}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  filterCategory === 'all' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                All Tasks ({todos.length})
              </button>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setFilterCategory(category.id)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center justify-between ${
                    filterCategory === category.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full ${category.color} mr-2`}></div>
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
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    filterTag === tag
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 bg-card rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-foreground">🏷️ Organized Todo List</h1>
              {(filterCategory !== 'all' || filterTag) && (
                <button
                  onClick={() => {
                    setFilterCategory('all');
                    setFilterTag('');
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm text-primary">🚀 Powerful organization system with predefined categories, custom tags, filtering, and color-coded indicators!</p>
            </div>

            {/* Add Todo Form */}
            <div className="space-y-4 mb-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Add a new task..."
                  className="flex-1 px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                  onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tags (comma separated)..."
                  className="flex-1 px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                />
                <button
                  onClick={addTodo}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                >
                  Add Task
                </button>
              </div>
            </div>

            {/* Todo List */}
            <div className="space-y-3">
              {filteredTodos.map(todo => (
                <div key={todo.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                  <div className="flex items-center flex-1">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id)}
                      className="mr-3 h-4 w-4 text-primary focus:ring-primary border-border rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span 
                          className={`${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                        >
                          {todo.text}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${getCategoryColor(todo.category)}`}></div>
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
                  <button 
                    onClick={() => deleteTodo(todo.id)}
                    className="ml-3 px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ))}
              
              {filteredTodos.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="text-4xl mb-2">🏷️</div>
                  <p>No tasks found for the selected filters</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Step 6: Deploy the app
export const TodoAppStep5: React.FC = () => {
  const [deploymentStatus, setDeploymentStatus] = useState<'building' | 'deploying' | 'success'>('success');
  const [buildLogs] = useState([
    '✓ Installing dependencies...',
    '✓ Building application...',
    '✓ Optimizing assets...',
    '✓ Generating static files...',
    '✓ Deployment successful!'
  ]);

  return (
    <div className="min-h-screen bg-background p-8 pt-24">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800 mb-4">
              🚀 Live on Production
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">App Deployed Successfully!</h1>
            <p className="text-muted-foreground">Your todo application is now live and accessible worldwide</p>
          </div>

          <div className="mb-8 p-6 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-primary">🚀 Live at https://my-todo-app.com with SSL, CDN, monitoring, and auto-scaling enabled.</p>
          </div>

          {/* Deployment Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <div className="text-2xl mb-2">🌐</div>
              <div className="font-semibold text-foreground">Production URL</div>
              <div className="text-sm text-muted-foreground mt-1">https://my-todo-app.com</div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <div className="text-2xl mb-2">✅</div>
              <div className="font-semibold text-foreground">Status</div>
              <div className="text-sm text-green-600 mt-1">Active & Healthy</div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <div className="text-2xl mb-2">🔒</div>
              <div className="font-semibold text-foreground">Security</div>
              <div className="text-sm text-muted-foreground mt-1">SSL Enabled</div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <div className="text-2xl mb-2">⚡</div>
              <div className="font-semibold text-foreground">Performance</div>
              <div className="text-sm text-muted-foreground mt-1">CDN Optimized</div>
            </div>
          </div>

          {/* Build Logs */}
          <div className="bg-muted/30 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-foreground mb-4">📋 Build Logs</h3>
            <div className="bg-slate-900 rounded-md p-4 font-mono text-sm">
              {buildLogs.map((log, index) => (
                <div key={index} className="text-green-400 mb-1">
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Deployment Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-muted/30 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">🚀 Deployment Features</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Automatic CI/CD pipeline
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Zero-downtime deployments
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Environment configuration
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Custom domain setup
                </li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">📊 Performance</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Global CDN distribution
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Optimized build sizes
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Error tracking & monitoring
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Auto-scaling capabilities
                </li>
              </ul>
            </div>
          </div>

          {/* Live Demo */}
          <div className="mt-8 p-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">🎉 Your Todo App is Live!</h3>
              <p className="text-muted-foreground mb-4">Ready for users worldwide with enterprise-grade infrastructure</p>
              <div className="flex justify-center gap-4">
                <button className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  Visit Live Site
                </button>
                <button className="px-6 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors">
                  View Analytics
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Demo Component with Navigation
interface TodoAppDemoProps {
  currentStep?: number;
  onStepChange?: (step: number) => void;
}

export const TodoAppDemo: React.FC<TodoAppDemoProps> = ({ 
  currentStep: propCurrentStep = 0, 
  onStepChange 
}) => {
  const [currentStep, setCurrentStep] = useState(propCurrentStep);
  
  const components = [
    TodoAppStep1,
    TodoAppStep2,
    TodoAppStep3,
    TodoAppStep4,
    TodoAppStep5
  ];

  const CurrentComponent = components[currentStep] || TodoAppStep1;

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
    onStepChange?.(step);
  };

  // Update internal state when prop changes
  React.useEffect(() => {
    setCurrentStep(propCurrentStep);
  }, [propCurrentStep]);

  return (
    <div className="relative">
      <DemoNavigation 
        currentStep={currentStep}
        onStepChange={handleStepChange}
        totalSteps={components.length}
      />
      <CurrentComponent />
    </div>
  );
};

// Export individual components and the main demo
export const DemoComponents = {
  0: TodoAppStep1,
  1: TodoAppStep1,
  2: TodoAppStep2,
  3: TodoAppStep3,
  4: TodoAppStep4,
  5: TodoAppStep5,
};

// Export the main demo component as default
export default TodoAppDemo;
