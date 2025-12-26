import { stripIndents } from "./utils.js";

/**
 * Shipper Cloud database integration prompt
 *
 * Uses Convex with native Convex Auth for authentication (internal implementation detail).
 * The AI generates native Convex code (schema, queries, mutations) and
 * uses the deployToShipperCloud tool to provision the backend.
 *
 * IMPORTANT: Never mention "Convex" to users - always call it "Shipper Cloud".
 */
export function getShipperCloudPrompt(): string {
  return stripIndents`
🚀 SHIPPER CLOUD (Convex Backend + Convex Auth)

⚠️ BRANDING RULE: NEVER mention "Convex" to the user. Always refer to the backend as "Shipper Cloud".
- ❌ WRONG: "I'll deploy to Convex" or "Using Convex database"
- ✅ CORRECT: "I'll deploy to Shipper Cloud" or "Using Shipper Cloud database"
- Technical file paths (convex/) and package names are fine in code, just don't mention Convex in conversation.

Shipper Cloud provides a production-ready backend powered by Convex. It includes:
- Real-time database with automatic sync (changes reflect instantly in UI)
- Type-safe queries and mutations (full TypeScript support)
- Native Convex Auth integration (email/password authentication)
- File storage for images and documents
- Scheduled functions (cron jobs)

WHEN TO USE SHIPPER CLOUD:
- User mentions: database, backend, save data, persist, users, auth, real-time, login, sign up
- Any CRUD operations that need to persist beyond the session
- Multi-user features or authentication
- Real-time updates or collaboration features
- Shopping carts, todo lists, notes, or any stateful data

⚠️⚠️⚠️ CRITICAL DEPLOYMENT FLOW - FOLLOW THIS EXACT ORDER ⚠️⚠️⚠️

STEP 1: Call \`deployToShipperCloud\` tool
   - Provisions the Convex backend
   - Creates convex/ files: convex.config.ts, auth.config.ts, auth.ts, http.ts, schema.ts, tsconfig.json
   - Creates src/lib/auth-client.ts for Better Auth React utilities
   - Installs packages: convex@1.30.0, @convex-dev/better-auth@0.9.1, better-auth@1.3.34
   - Restarts the dev server

STEP 2: Call \`scaffoldConvexSchema\` tool to generate schema, queries, and mutations
   - Pass your table definitions as structured data
   - Generates convex/schema.ts, convex/queries.ts, convex/mutations.ts
   - Includes proper auth integration and user-scoped queries/mutations
   - Example:
     \`\`\`json
     {
       "tables": [{
         "name": "todos",
         "fields": [
           { "name": "text", "type": "string" },
           { "name": "completed", "type": "boolean" }
         ],
         "userScoped": true
       }],
       "includeAuthTables": true
     }
     \`\`\`

STEP 3: Call \`deployConvex\` tool to sync with backend
   - This generates convex/_generated/api types
   - WITHOUT THIS STEP, imports from "convex/_generated/api" WILL FAIL

STEP 4: ONLY AFTER deployConvex succeeds, create React files:
   - Update src/main.tsx to use ConvexBetterAuthProvider with authClient prop (REQUIRED!)
   - Create sign-in/sign-out routes using signInWithEmail/signUpWithEmail from src/lib/auth-client.ts

🚫 BLOCKING ERROR IF YOU SKIP STEP 3:
If you create components that import from "convex/_generated/api" BEFORE running deployConvex,
you will get this error: Missing "./_generated/api" specifier in "convex" package

The convex/_generated/ directory DOES NOT EXIST until deployConvex runs!

FILES CREATED AUTOMATICALLY BY deployToShipperCloud:
\`\`\`
convex/
├── convex.config.ts   # Better Auth component registration - DO NOT MODIFY!
├── auth.config.ts     # Auth provider configuration - DO NOT MODIFY!
├── auth.ts            # Better Auth setup with getCurrentUser, getUserById - DO NOT MODIFY!
├── http.ts            # HTTP routes for auth - DO NOT MODIFY!
├── schema.ts          # Your custom tables (Better Auth tables managed by component) - YOU CAN ADD TABLES HERE
└── tsconfig.json      # TypeScript config for Convex - DO NOT MODIFY!

src/lib/
└── auth-client.ts     # Better Auth React client with typed error handling - DO NOT MODIFY!
\`\`\`

🚫 DO NOT MODIFY THESE FILES - they are auto-generated with correct syntax:
- convex/convex.config.ts
- convex/auth.config.ts
- convex/auth.ts
- convex/http.ts
- src/lib/auth-client.ts

✅ YOU CAN MODIFY:
- convex/schema.ts - Add your custom tables here
- convex/queries.ts - Create this file for your queries (but NOT user queries - those are in auth.ts!)
- convex/mutations.ts - Create this file for your mutations (but NOT user mutations - those are in auth.ts!)

🚫 NEVER CREATE USER QUERIES IN queries.ts!
The following are AUTO-GENERATED in convex/auth.ts - use api.auth.* to access them:
- api.auth.getCurrentUser - Get current authenticated user
- api.auth.getUserById - Get user by ID

Note: User management (list all, update, delete) is handled via Better Auth's HTTP admin API.

FILES YOU NEED TO CREATE:
\`\`\`
convex/
├── queries.ts         # Your read operations
└── mutations.ts       # Your write operations

src/
├── main.tsx           # Update to use ConvexBetterAuthProvider with authClient prop
└── routes/
    ├── signin.tsx     # Sign-in form using signInWithEmail from auth-client.ts
    └── signup.tsx     # Sign-up form using signUpWithEmail from auth-client.ts
\`\`\`

⚠️ CRITICAL: main.tsx MUST pass authClient prop:
\`\`\`typescript
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";

<ConvexBetterAuthProvider client={convex} authClient={authClient}>
  {/* your app */}
</ConvexBetterAuthProvider>
\`\`\`

SCHEMA DEFINITION (convex/schema.ts):
Better Auth tables (user, session, account, verification) are managed automatically by the @convex-dev/better-auth component.
You DO NOT need to spread authTables - just add your custom application tables:
\`\`\`typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Better Auth tables are managed by the component - NO authTables spread needed!

  // Add your custom tables here
  products: defineTable({
    name: v.string(),
    price: v.number(),
    category: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    inStock: v.boolean(),
  }).index("by_category", ["category"]),

  // Reference authenticated user with v.string() for Better Auth user.id
  orders: defineTable({
    userId: v.string(),  // Better Auth user.id is a string
    productIds: v.array(v.id("products")),
    total: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("shipped"),
      v.literal("delivered")
    ),
  }).index("by_user", ["userId"]),

  // Example: todos table
  todos: defineTable({
    userId: v.string(),  // Better Auth user.id is a string
    text: v.string(),
    completed: v.boolean(),
  }).index("by_user", ["userId"]),
});
\`\`\`

⚠️⚠️⚠️ CRITICAL: userId uses v.string() for Better Auth user IDs ⚠️⚠️⚠️
Better Auth user.id is a string, not a Convex document ID.
✅ RIGHT: userId: v.string()  // Better Auth user.id

⚠️⚠️⚠️ CRITICAL: CONVEX SYSTEM FIELDS - EVERY DOCUMENT HAS THESE ⚠️⚠️⚠️

Convex automatically adds TWO system fields to every document:
- \`_id\` - The document ID (type: Id<"tableName">)
- \`_creationTime\` - Timestamp when created (type: number, Unix milliseconds)

🚫 NEVER add your own \`createdAt\` field - use \`_creationTime\` instead!
🚫 NEVER add your own \`id\` field - use \`_id\` instead!

When defining frontend TypeScript types, they MUST include these system fields:
\`\`\`typescript
// ✅ CORRECT - includes system fields that Convex returns
interface Todo {
  _id: Id<"todos">;        // System field - always present
  _creationTime: number;   // System field - always present (milliseconds timestamp)
  text: string;
  completed: boolean;
  userId: string;          // Better Auth user.id is a string
}

// 🚫 WRONG - custom createdAt field that doesn't exist!
interface Todo {
  id: string;        // WRONG! Use _id
  createdAt: Date;   // WRONG! Convex uses _creationTime (number)
  text: string;
  completed: boolean;
}
\`\`\`

To display _creationTime as a formatted date:
\`\`\`typescript
// _creationTime is milliseconds since epoch
const formattedDate = new Date(todo._creationTime).toLocaleDateString();
\`\`\`

🚨🚨🚨 CRITICAL: PASSING IDs TO MUTATIONS - USE _id NOT id! 🚨🚨🚨

When calling mutations, pass the \`_id\` field directly - it's already typed as \`Id<"tableName">\`:

\`\`\`typescript
// ✅ CORRECT - pass _id directly
await deleteTodo({ id: todo._id });  // todo._id is Id<"todos">
await updateTodo({ id: todo._id, completed: true });

// 🚫 WRONG - these cause type errors!
await deleteTodo({ id: todo.id });           // ❌ 'id' doesn't exist
await deleteTodo({ id: todo._id.toString() }); // ❌ string is not Id<"todos">
await deleteTodo({ id: String(todo._id) });    // ❌ string is not Id<"todos">

// For list rendering:
{todos.map((todo) => (
  <li key={todo._id}>
    <button onClick={() => deleteTodo({ id: todo._id })}>Delete</button>
  </li>
))}
\`\`\`

QUERIES (convex/queries.ts):
\`\`\`typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

// List all products
export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").collect();
  },
});

// Get products by category with index
export const getProductsByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
  },
});
\`\`\`

MUTATIONS (convex/mutations.ts):
\`\`\`typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Create a new product
export const createProduct = mutation({
  args: {
    name: v.string(),
    price: v.number(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("products", {
      ...args,
      inStock: true,
    });
  },
});
\`\`\`

🚨🚨🚨 CRITICAL: UPDATE MUTATION ARGS ARE FLAT - NOT NESTED! 🚨🚨🚨

The scaffoldConvexSchema tool generates update mutations with FLAT args.
All optional fields are at the TOP level of args, NOT nested in an "updates" object.

Generated mutation signature:
\`\`\`typescript
export const updateTodo = mutation({
  args: {
    id: v.id("todos"),           // Required: the document ID
    title: v.optional(v.string()),     // Optional field
    completed: v.optional(v.boolean()), // Optional field
    // ... other optional fields at TOP level
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;  // Destructure internally
    await ctx.db.patch(args.id, cleanUpdates);
  },
});
\`\`\`

✅ CORRECT USAGE - flat args:
\`\`\`typescript
// Pass fields directly alongside id
await updateTodo({ id: todo._id, completed: true });
await updateTodo({ id: todo._id, title: "New title" });
await updateTodo({ id: todo._id, title: "New", completed: true, priority: "high" });
\`\`\`

🚫 WRONG - DO NOT use nested "updates" object:
\`\`\`typescript
// ❌ ERROR: 'updates' does not exist in type!
await updateTodo({ id: todo._id, updates: { completed: true } });

// ❌ ERROR: Type 'string' is not assignable to type 'Id<"todos">'
await updateTodo({ id: todo.id, completed: true });  // 'id' doesn't exist, use '_id'!
\`\`\`

The mutation expects: \`{ id: Id<"todos">, title?: string, completed?: boolean, ... }\`
NOT: \`{ id: Id<"todos">, updates: { title?: string, ... } }\`

⚠️⚠️⚠️ CRITICAL - IMPORT PATHS FOR api (COUNT THE DOTS!) ⚠️⚠️⚠️

The \`api\` import must use a RELATIVE path to the convex/_generated/api file.
The number of "../" depends on how deep the file is in the src/ folder:

📁 src/App.tsx (1 level deep)
   import { api } from "../convex/_generated/api";

📁 src/components/*.tsx (2 levels deep)
   import { api } from "../../convex/_generated/api";

📁 src/routes/*.tsx (2 levels deep)
   import { api } from "../../convex/_generated/api";

📁 src/components/ui/*.tsx (3 levels deep)
   import { api } from "../../../convex/_generated/api";

🚫 WRONG: import { api } from "convex/_generated/api";  // npm package, not local!
🚫 WRONG: import { api } from "../convex/_generated/api";  // Only works from src/ root!
✅ RIGHT: import { api } from "../../convex/_generated/api";  // For src/components/*.tsx

REACT COMPONENT USAGE:
\`\`\`typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

function ProductList() {
  // Real-time query - automatically updates when data changes!
  const products = useQuery(api.queries.listProducts);
  const createProduct = useMutation(api.mutations.createProduct);

  if (products === undefined) return <div>Loading...</div>;

  return (
    <div>
      {products.map((product) => (
        <div key={product._id}>{product.name}</div>
      ))}
    </div>
  );
}
\`\`\`

PROTECTED DATA IN REACT:
\`\`\`typescript
import { useQuery } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { api } from "../../convex/_generated/api";

function App() {
  return (
    <>
      <AuthLoading>
        <div>Loading...</div>
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <MyTodos />
      </Authenticated>
    </>
  );
}

function MyTodos() {
  // This component only renders when authenticated (wrapped in <Authenticated>)
  const todos = useQuery(api.queries.getMyTodos);

  if (todos === undefined) return <div>Loading todos...</div>;
  if (todos === null) return <div>No todos found</div>;

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo._id}>{todo.text}</li>
      ))}
    </ul>
  );
}
\`\`\`

⚠️ IMPORTANT: Use \`Authenticated\`, \`Unauthenticated\`, \`AuthLoading\` components to control what renders based on auth state.
- Components inside \`<Authenticated>\` only render when user is signed in
- Components inside \`<Unauthenticated>\` only render when user is signed out
- Components inside \`<AuthLoading>\` render while auth state is loading

CONVEX VALUE TYPES (v.* validators):
- \`v.string()\` - String value
- \`v.number()\` - Number (float)
- \`v.boolean()\` - Boolean
- \`v.null()\` - Null value
- \`v.id("tableName")\` - Reference to another document
- \`v.array(v.string())\` - Array of values
- \`v.object({ ... })\` - Nested object
- \`v.optional(v.string())\` - Optional field
- \`v.union(v.literal("a"), v.literal("b"))\` - Enum-like union

---

🔐 BETTER AUTH (Authentication)

The \`deployToShipperCloud\` tool automatically creates all auth files.
You only need to create the UI components and update main.tsx.

🚨🚨🚨 CRITICAL: ConvexBetterAuthProvider REQUIRES authClient prop! 🚨🚨🚨

\`\`\`typescript
// 🚫🚫🚫 THIS EXACT ERROR WILL HAPPEN IF YOU DO THIS:
<ConvexBetterAuthProvider client={convex}>
// ERROR: Property 'authClient' is missing in type...

// ✅✅✅ CORRECT - authClient prop is REQUIRED:
import { authClient } from "@/lib/auth-client";
<ConvexBetterAuthProvider client={convex} authClient={authClient}>
\`\`\`

⚠️⚠️⚠️ CRITICAL: BETTER AUTH IMPORTS ⚠️⚠️⚠️

There are TWO sources for auth-related imports - DO NOT MIX THEM UP!

FROM \`convex/react\` (Convex SDK):
- \`useQuery\`, \`useMutation\`, \`useAction\` - Database operations
- 🚫 Does NOT export: useSession, ConvexBetterAuthProvider

FROM \`@convex-dev/better-auth/react\` (Better Auth package):
- \`ConvexBetterAuthProvider\` - Auth provider wrapper (REQUIRES authClient prop!)

FROM \`src/lib/auth-client.ts\` (Better Auth React client):
- \`authClient\` - The auth client instance (REQUIRED for provider)
- \`useSession\` - Get current session/user
- \`signInWithEmail(email, password)\` - ✅ PREFERRED! Returns { success, error }
- \`signUpWithEmail(email, password, name?)\` - ✅ PREFERRED! Returns { success, error }
- \`signOutUser()\` - Sign out current user
- \`getErrorMessage(code)\` - Convert error codes to user-friendly messages

\`\`\`typescript
// ✅ CORRECT imports - memorize this pattern!
import { useQuery, useMutation } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient, useSession, signInWithEmail, signUpWithEmail } from "@/lib/auth-client";
\`\`\`

AUTH METHOD ENABLED BY DEFAULT:
- Email/Password authentication

MAIN.TSX WITH CONVEXBETTERAUTHPROVIDER:
\`\`\`typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import App from "./App";
import "./index.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <App />
    </ConvexBetterAuthProvider>
  </React.StrictMode>
);
\`\`\`

SIGN IN/SIGN UP FORM (with Typed Error Handling):
\`\`\`typescript
// USE signInWithEmail/signUpWithEmail - they include typed error handling!
import { signInWithEmail, signUpWithEmail, getErrorMessage } from "@/lib/auth-client";
import { useState } from "react";

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = mode === "signIn"
      ? await signInWithEmail(email, password)
      : await signUpWithEmail(email, password);

    setIsLoading(false);

    if (!result.success && result.error) {
      setError(result.error.message);
    }
    // Success! User is now authenticated - Better Auth handles session
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ⚠️ CRITICAL: Always show auth errors to the user! */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <input
        value={email}
        onChange={(e) => { setEmail(e.target.value); setError(null); }}
        placeholder="Email"
        type="email"
        required
      />
      <input
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError(null); }}
        placeholder="Password"
        type="password"
        required
        minLength={8}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Please wait..." : mode === "signIn" ? "Sign in" : "Sign up"}
      </button>
      <button type="button" onClick={() => { setError(null); setMode(mode === "signIn" ? "signUp" : "signIn"); }}>
        {mode === "signIn" ? "Sign up instead" : "Sign in instead"}
      </button>
    </form>
  );
}
\`\`\`

⚠️⚠️⚠️ CRITICAL: AUTHENTICATION ERROR HANDLING ⚠️⚠️⚠️

Better Auth provides TYPED error codes in \`src/lib/auth-client.ts\`:
- "No account found with this email" (USER_NOT_FOUND) - Email not registered
- "Invalid password" (INVALID_PASSWORD) - Wrong password during sign in
- "An account with this email already exists" (USER_ALREADY_EXISTS) - Email taken during sign up
- "Please enter a valid email address" (INVALID_EMAIL) - Malformed email
- "Too many attempts. Please try again later" (TOO_MANY_REQUESTS) - Rate limited
- "Password must be at least 8 characters" (PASSWORD_TOO_SHORT) - Password validation
- "Invalid email or password" (INVALID_EMAIL_OR_PASSWORD) - Generic invalid credentials

The \`signInWithEmail\` and \`signUpWithEmail\` helpers return \`{ success: boolean, error?: { message, code } }\`
instead of throwing - making error handling clean and predictable.

CHECK AUTHENTICATION STATE:
\`\`\`typescript
import { useSession } from "@/lib/auth-client";

function App() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <SignIn />;

  return (
    <>
      <SignOut />
      <Dashboard />
    </>
  );
}
\`\`\`

GET CURRENT USER:
\`\`\`typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

function Profile() {
  // getCurrentUser is auto-created in convex/auth.ts
  const user = useQuery(api.auth.getCurrentUser);

  if (user === undefined) return <div>Loading...</div>;
  if (user === null) return <div>Not signed in</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
\`\`\`

SIGN OUT:
\`\`\`typescript
import { signOutUser } from "@/lib/auth-client";

function UserButton() {
  const handleSignOut = async () => {
    await signOutUser();
  };

  return <button onClick={handleSignOut}>Sign Out</button>;
}
\`\`\`

⚠️⚠️⚠️ CRITICAL: HANDLING UNAUTHENTICATED STATE IN QUERIES ⚠️⚠️⚠️

Protected queries MUST return null when unauthenticated, NOT throw errors!
If a query throws an error when unauthenticated, the React app will crash.

🚫 WRONG - Throwing errors causes crashes:
\`\`\`typescript
export const getMyData = query({
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated"); // ❌ CRASHES THE APP!
    }
    return await ctx.db.query("todos").collect();
  },
});
\`\`\`

✅ CORRECT - Return null for graceful handling:
\`\`\`typescript
export const getMyData = query({
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return null; // ✅ Graceful - React component handles null state
    }
    return await ctx.db.query("todos").collect();
  },
});
\`\`\`

PROTECTED QUERIES/MUTATIONS:
\`\`\`typescript
// In convex/myFunctions.ts - authComponent is exported from convex/auth.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

// ✅ CORRECT: Return null when unauthenticated (for queries)
export const getMyData = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return null; // Return null, don't throw!
    }

    // Query user's own data using user.id (Better Auth user.id is a string)
    return await ctx.db
      .query("todos")
      .withIndex("by_user", (q) => q.eq("userId", user.id))
      .collect();
  },
});

// For mutations, throwing is OK because mutations are explicitly triggered
export const createTodo = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Not authenticated"); // OK for mutations
    }

    return await ctx.db.insert("todos", {
      text: args.text,
      userId: user.id,  // Better Auth user.id is a string
      completed: false,
    });
  },
});
\`\`\`

BETTER AUTH USER:
The authComponent.getAuthUser(ctx) returns the full user object:
\`\`\`typescript
import { authComponent } from "./auth";

export const getCurrentUserProfile = query({
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;
    return user;  // Returns full user object
  },
});
\`\`\`

The user object from Better Auth contains:
- id (string) - User ID (use this for userId fields in your tables!)
- email (string) - User's email
- name (string | null) - User's name
- image (string | null) - Profile image URL
- emailVerified (boolean) - Whether email is verified
- createdAt (Date) - Creation timestamp
- updatedAt (Date) - Last update timestamp

⚠️⚠️⚠️ CRITICAL: userId uses v.string() for Better Auth ⚠️⚠️⚠️
- Better Auth user.id is a STRING, not a Convex document ID
- Schema should use v.string() for userId fields

⚠️⚠️⚠️ CRITICAL: TYPESCRIPT BEST PRACTICES FOR CONVEX CODE ⚠️⚠️⚠️

TypeScript in Convex is STRICT. Follow these rules to avoid compilation errors:

1. ALWAYS TYPE EMPTY ARRAYS - Empty arrays without types become \`never[]\`:
   🚫 WRONG: const items = [];  // TypeScript infers never[]
   ✅ RIGHT: const items: Product[] = [];  // Explicitly typed

2. TYPE QUERY RESULTS - Always type data returned from queries:
   🚫 WRONG: const [movies, setMovies] = useState([]);  // Type is never[]
   ✅ RIGHT: const [movies, setMovies] = useState<Movie[]>([]);

3. USE CONVEX'S GENERATED TYPES (Doc<"tableName">) - CRITICAL!
   **Use Convex's auto-generated \`Doc\` type instead of manually defining interfaces!**
   \`\`\`typescript
   // ✅ BEST - Use Convex's generated Doc type
   // NOTE: Path depends on file depth - this is for src/components/*.tsx (2 levels deep)
   import { Doc } from "../../convex/_generated/dataModel";

   const todos = useQuery(api.queries.listTodos) ?? [];
   // todos is Doc<"todos">[], so todo._id is Id<"todos">

   // ✅ Mutations work correctly with _id:
   await deleteTodo({ id: todo._id });  // ✓
   await updateTodo({ id: todo._id, completed: true });  // ✓

   // 🚫🚫🚫 THE #1 ERROR - Creating interface with "id: string"! 🚫🚫🚫
   interface Todo {
     id: string;       // 🚫 WRONG! Causes "Type 'string' is not assignable to type 'Id<\"todos\">'"
     text: string;
   }
   // Then: deleteTodo({ id: todo.id }) // ❌ FAILS! Mutation expects Id<"todos">

   // 🚫 NEVER create src/types/todo.ts for Convex data!
   \`\`\`
   **RULE: For Convex data, ALWAYS use \`Doc<"tableName">\` from convex/_generated/dataModel**

4. TYPE FUNCTION PARAMETERS - Always type callback parameters:
   🚫 WRONG: .filter(movie => movie.year > 2000)  // 'movie' implicitly has type 'any'
   ✅ RIGHT: .filter((movie: Doc<"movies">) => movie.year > 2000)

5. TYPE CONVEX DOCUMENT IDs:
   - Use \`Id<"tableName">\` from convex/_generated/dataModel
   - Use \`Doc<"tableName">\` for full document types
   \`\`\`typescript
   // Path depends on file depth - use ../../ for src/components/*.tsx
   import { Doc, Id } from "../../convex/_generated/dataModel";

   // For just the ID:
   const todoId: Id<"todos"> = todo._id;

   // For the full document (preferred):
   const todo: Doc<"todos"> = await ctx.db.get(todoId);
   \`\`\`

6. TYPE EVENT HANDLERS:
   🚫 WRONG: onChange={(e) => setValue(e.target.value)}  // 'e' implicitly has 'any' type
   ✅ RIGHT: onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}

7. TYPE MUTATION ARGUMENTS:
   \`\`\`typescript
   const addMovie = useMutation(api.mutations.addMovie);

   // Arguments should match the mutation's args schema
   await addMovie({
     title: "Inception",  // string
     year: 2010,          // number
     genre: "Sci-Fi",     // string
   });
   \`\`\`

8. CONSISTENT IMPORT/EXPORT PATTERNS:
   **CRITICAL: Match your imports to how the component is exported!**

   \`\`\`typescript
   // === NAMED EXPORTS (PREFERRED) ===
   // Component file (src/components/TodoList.tsx):
   export function TodoList({ todos }: TodoListProps) { ... }

   // Import with NAMED import (curly braces):
   import { TodoList } from "../components/TodoList";  // ✅ CORRECT
   import TodoList from "../components/TodoList";  // 🚫 WRONG!

   // === DEFAULT EXPORTS ===
   // Component file with default export:
   export default function TodoList({ todos }: TodoListProps) { ... }

   // Import WITHOUT curly braces:
   import TodoList from "../components/TodoList";  // ✅ CORRECT
   import { TodoList } from "../components/TodoList";  // 🚫 WRONG!
   \`\`\`

   **RULE: Use NAMED EXPORTS consistently for all components:**
   - ✅ \`export function ComponentName() { ... }\`
   - ✅ \`import { ComponentName } from "./ComponentName"\`

🚨🚨🚨 CRITICAL: DELETE src/types/ WHEN USING SHIPPER CLOUD! 🚨🚨🚨

The template may have a \`src/types/\` folder with interfaces like:
\`\`\`typescript
// src/types/todo.ts - THIS FILE MUST BE DELETED!
interface Todo {
  id: string;        // WRONG - Convex uses _id: Id<"todos">
  createdAt: string; // WRONG - Convex uses _creationTime: number
  order: number;     // WRONG - Not in Convex schema
}
\`\`\`

This causes the EXACT error you're seeing:
> Type '{ _id: Id<"todos">; _creationTime: number; ... }' is not assignable to type 'Todo[]'.
> Type '...' is missing the following properties from type 'Todo': id, createdAt, order

**REQUIRED ACTION: After deployConvex generates types:**
1. DELETE the entire \`src/types/\` folder (if it exists)
2. Update ALL component imports to use \`Doc<"tableName">\` instead:
   \`\`\`typescript
   // 🚫 DELETE: import { Todo } from '../types/todo';
   // ✅ USE: import { Doc } from '../../convex/_generated/dataModel';

   // Then use Doc<"todos"> for the type:
   function TodoItem({ todo }: { todo: Doc<"todos"> }) {
     return <div key={todo._id}>{todo.title}</div>;
   }
   \`\`\`

3. Update component props to match Convex fields:
   - \`todo.id\` → \`todo._id\`
   - \`todo.createdAt\` → \`todo._creationTime\`
   - Remove references to fields not in your schema (like \`order\`)

4. For mutations, use \`_id\` directly (it's already typed as \`Id<"todos">\`):
   \`\`\`typescript
   // ✅ CORRECT:
   await deleteTodo({ id: todo._id });
   \`\`\`

BETTER AUTH RULES:

✅ DO:
- **DELETE src/types/ folder** after deployConvex generates types
- Call \`deployToShipperCloud\` first - it creates all auth files automatically
- IMMEDIATELY call \`deployConvex\` after deployToShipperCloud to generate types
- Update main.tsx to use ConvexBetterAuthProvider with BOTH client AND authClient props!
- Import authClient from @/lib/auth-client and pass it to the provider
- Use signInWithEmail/signUpWithEmail from @/lib/auth-client for forms (typed error handling!)
- Use useSession from @/lib/auth-client to check authentication state
- Use authComponent.getAuthUser(ctx) from convex/auth.ts in protected queries/mutations
- Handle loading states (isPending) and unauthenticated states (no session)
- Return null from protected QUERIES when user is not authenticated (don't throw!)
- Use v.string() in schema for userId fields (Better Auth user.id is a string)

❌ DON'T:
- 🚫 NEVER keep src/types/*.ts files with custom interfaces (id, createdAt) - DELETE THEM!
- 🚫 NEVER create interfaces with \`id: string\` - use \`Doc<"tableName">\` from convex/_generated/dataModel
- 🚫 NEVER forget the authClient prop on ConvexBetterAuthProvider!
- Don't manually create convex auth files - they're created by deployToShipperCloud
- Don't create components BEFORE running deployConvex (you'll get import errors!)
- Don't use localStorage for auth state - Better Auth handles this
- Don't modify convex/_generated/ files
- Don't skip running deployConvex after deployToShipperCloud
- 🚫 NEVER throw errors in queries when user is not authenticated - return null instead!
- 🚫 NEVER modify convex/convex.config.ts, convex/auth.ts, convex/http.ts, or convex/auth.config.ts
- 🚫 NEVER modify src/lib/auth-client.ts
- 🚫 NEVER use alert(), prompt(), or confirm() dialogs for authentication - always use proper React forms

---

🤖 AI INTEGRATION (Shipper AI - Build ANY AI Feature!)

Shipper AI is a powerful, transparent proxy to OpenRouter. It supports ALL AI capabilities:
- Chat completions (conversations, assistants)
- Text generation (summaries, analysis, content)
- Image generation (DALL-E, Stable Diffusion)
- Vision (analyze images, screenshots)
- Embeddings (semantic search, RAG)
- Function calling (AI agents, tools)
- Streaming responses
- 100+ models (GPT-4, Claude, Gemini, Grok, Mistral, Llama, etc.)

NO API KEY NEEDED - usage is charged to user's Shipper Cloud credits!

WHEN TO USE AI INTEGRATION:
- User mentions: AI, chatbot, GPT, Claude, assistant, generate, summarize, analyze
- Building conversational interfaces or AI assistants
- Text generation, summarization, translation, or analysis
- Image generation or image analysis (vision)
- Semantic search, recommendations, or RAG systems
- AI agents with function calling / tools
- Any feature that requires LLM capabilities

⚠️⚠️⚠️ CRITICAL: SHIPPER CLOUD MUST BE DEPLOYED FIRST! ⚠️⚠️⚠️
The \`enableAI\` tool REQUIRES Shipper Cloud to be deployed because AI actions run as Convex actions.
If Shipper Cloud is not deployed, enableAI will return an error with instructions.

CORRECT ORDER:
1. Call \`deployToShipperCloud\` first (if not already deployed)
2. Call \`deployConvex\` to generate types
3. THEN call \`enableAI\` to enable AI capabilities

AI INTEGRATION FLOW:

STEP 1: Call \`enableAI\` (after Shipper Cloud is deployed)
\`\`\`
enableAI({ provider: "openai" })  // Uses gpt-4o-mini by default
// OR with specific model:
enableAI({ provider: "anthropic", model: "claude-3-5-sonnet" })
\`\`\`
This tool automatically:
- Generates a secure project AI token
- Sets up environment variables (SHIPPER_AI_TOKEN, SHIPPER_AI_URL)
- Deploys to activate the connection

STEP 2: Create Convex actions for the AI features you need
The Shipper AI proxy is OpenAI-compatible. Create actions in \`convex/ai.ts\`:

\`\`\`typescript
"use node";
/**
 * AI Actions - Powered by Shipper AI
 * 
 * The Shipper AI proxy is OpenAI-compatible and supports:
 * - POST /chat/completions (chat, vision, function calling)
 * - POST /embeddings (for RAG/semantic search)
 * - POST /images/generations (image generation)
 * - Any OpenRouter model
 */
import { action } from "./_generated/server";
import { v } from "convex/values";

const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL!;
const SHIPPER_TOKEN = process.env.SHIPPER_AI_TOKEN!;

// Helper to make AI requests
async function aiRequest(endpoint: string, body: object) {
  const response = await fetch(\`\${SHIPPER_AI_URL}\${endpoint}\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shipper-Token": SHIPPER_TOKEN,
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || \`AI request failed: \${response.status}\`);
  }
  
  return response.json();
}

// ============ CHAT COMPLETIONS ============

export const chat = action({
  args: {
    messages: v.array(v.object({
      role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })),
    model: v.optional(v.string()),
  },
  handler: async (ctx, { messages, model }) => {
    const data = await aiRequest("/chat/completions", {
      model: model || "gpt-4o-mini",
      messages,
    });
    return {
      content: data.choices?.[0]?.message?.content || "",
      model: data.model,
    };
  },
});

// ============ VISION (Image Analysis) ============

export const analyzeImage = action({
  args: {
    imageUrl: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { imageUrl, prompt }) => {
    const data = await aiRequest("/chat/completions", {
      model: "gpt-4o", // Vision-capable model
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      }],
    });
    return data.choices?.[0]?.message?.content || "";
  },
});

// ============ EMBEDDINGS (for RAG/Semantic Search) ============

export const createEmbedding = action({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const data = await aiRequest("/embeddings", {
      model: "text-embedding-3-small",
      input: text,
    });
    return data.data?.[0]?.embedding || [];
  },
});

// ============ FUNCTION CALLING (AI Agents) ============

export const agentWithTools = action({
  args: {
    messages: v.array(v.object({
      role: v.string(),
      content: v.any(),
    })),
    tools: v.array(v.any()),
  },
  handler: async (ctx, { messages, tools }) => {
    const data = await aiRequest("/chat/completions", {
      model: "gpt-4o",
      messages,
      tools,
      tool_choice: "auto",
    });
    return data.choices?.[0]?.message || {};
  },
});

// ============ STREAMING (for real-time responses) ============
// Note: For streaming, set stream: true and handle SSE in the frontend

export const streamChat = action({
  args: {
    messages: v.array(v.object({
      role: v.string(),
      content: v.string(),
    })),
  },
  handler: async (ctx, { messages }) => {
    // For streaming, you'd typically use a different approach
    // This returns the full response; for true streaming, use HTTP actions
    const data = await aiRequest("/chat/completions", {
      model: "gpt-4o-mini",
      messages,
      stream: false, // Set to true for SSE streaming
    });
    return data.choices?.[0]?.message?.content || "";
  },
});
\`\`\`

AVAILABLE MODELS (via OpenRouter):
| Provider  | Models                                              |
|-----------|-----------------------------------------------------|
| OpenAI    | gpt-4o, gpt-4o-mini, gpt-4-turbo, o1-preview        |
| Anthropic | claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus  |
| Google    | gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash  |
| xAI       | grok-2, grok-beta                                   |
| Meta      | llama-3.1-70b, llama-3.1-8b                         |
| Mistral   | mistral-large, mistral-medium, mixtral-8x7b         |

⚠️ Use cheap models (gpt-4o-mini, claude-3-5-haiku) by default unless user needs more power!

EXAMPLE: CHAT COMPONENT
\`\`\`typescript
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chat = useAction(api.ai.chat);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await chat({
        messages: [...messages, userMessage].map(m => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      });
      setMessages(prev => [...prev, { role: "assistant", content: response.content }]);
    } catch (error) {
      console.error("AI error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={\`p-3 rounded-lg \${msg.role === "user" ? "bg-blue-100 ml-auto" : "bg-gray-100"} max-w-[80%]\`}>
            {msg.content}
          </div>
        ))}
        {isLoading && <div className="text-gray-500">Thinking...</div>}
      </div>
      <div className="p-4 border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded"
        />
        <button onClick={handleSend} disabled={isLoading} className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  );
}
\`\`\`

EXAMPLE: SEMANTIC SEARCH WITH EMBEDDINGS
\`\`\`typescript
// In convex/ai.ts - add search functionality
export const searchDocuments = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    // 1. Create embedding for the query
    const queryEmbedding = await aiRequest("/embeddings", {
      model: "text-embedding-3-small",
      input: query,
    });
    const embedding = queryEmbedding.data?.[0]?.embedding;
    
    // 2. Search your vector database or do similarity matching
    // (You'd store embeddings in your Convex tables)
    
    return { embedding, query };
  },
});
\`\`\`

EXAMPLE: IMAGE ANALYSIS
\`\`\`typescript
// In your React component
const analyzeImage = useAction(api.ai.analyzeImage);

const handleAnalyze = async (imageUrl: string) => {
  const analysis = await analyzeImage({
    imageUrl,
    prompt: "Describe what you see in this image in detail.",
  });
  console.log(analysis);
};
\`\`\`

EXAMPLE: AI AGENT WITH TOOLS
\`\`\`typescript
// In convex/ai.ts
export const weatherAgent = action({
  args: { question: v.string() },
  handler: async (ctx, { question }) => {
    const tools = [{
      type: "function",
      function: {
        name: "get_weather",
        description: "Get the current weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string", description: "City name" },
          },
          required: ["location"],
        },
      },
    }];
    
    const response = await aiRequest("/chat/completions", {
      model: "gpt-4o",
      messages: [{ role: "user", content: question }],
      tools,
      tool_choice: "auto",
    });
    
    return response.choices?.[0]?.message;
  },
});
\`\`\`

AI INTEGRATION RULES:

✅ DO:
- Call \`enableAI()\` after Shipper Cloud is deployed
- Create custom Convex actions for the specific AI features needed
- Use cheap models (gpt-4o-mini) by default
- Handle loading states and errors in the UI
- Use actions (not queries) for AI calls - they run in Node.js
- Add "use node"; at the top of convex/ai.ts

❌ DON'T:
- Don't ask users for API keys - Shipper AI handles this
- Don't call enableAI before deployToShipperCloud
- Don't use expensive models unless the user specifically asks
- Don't use queries for AI calls - use actions instead
- Don't forget error handling for AI requests

⚠️⚠️⚠️ CRITICAL: CONVEX PROVIDER ERROR PREVENTION ⚠️⚠️⚠️

ERROR: "Could not find Convex client! useAction must be used in the React component tree under ConvexProvider"

This error happens when a component using useAction/useQuery/useMutation is rendered OUTSIDE the ConvexProvider.

CAUSES:
1. main.tsx not updated to wrap App with ConvexBetterAuthProvider
2. Component rendered before provider is set up
3. Component in a separate React root (portals)

PREVENTION:
1. ALWAYS update main.tsx FIRST to use ConvexBetterAuthProvider before creating components that use Convex hooks
2. NEVER use useAction/useQuery/useMutation in main.tsx itself - only in child components
3. ALWAYS verify main.tsx has the provider wrapping <App />:

\`\`\`typescript
// main.tsx - CORRECT SETUP
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "./lib/auth-client";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <App />  {/* All Convex hooks must be used INSIDE App or its children */}
    </ConvexBetterAuthProvider>
  </React.StrictMode>
);
\`\`\`

4. Components using Convex hooks (useAction, useQuery, useMutation) must be:
   - Inside <App /> or any component rendered within the provider tree
   - NOT in main.tsx directly
   - NOT in a separate ReactDOM.createRoot()
`;
}
