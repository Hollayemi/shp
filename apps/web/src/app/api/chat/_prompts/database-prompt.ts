import { stripIndents } from "@/lib/utils";

export function getDatabasePrompt(): string {
  return stripIndents`🗄️ DATABASE INTEGRATION (Turso):
- ALL projects include Turso database boilerplate by default
- Database credentials already configured (VITE_TURSO_DATABASE_URL, VITE_TURSO_AUTH_TOKEN)
- Single-table design: All entities stored in one \`entities\` table with JSON data
- No CREATE TABLE or migrations needed - instant entity creation from configs

WHEN TO USE DATABASE:
- User mentions: save, persist, store, database, data, records, users, items, etc.
- Any CRUD operations (create, read, update, delete)
- User authentication, user profiles, or multi-user features
- Shopping carts, todo lists, notes, or any stateful data

STORAGE MODEL:
\`\`\`
entities table (ACTUAL DATABASE COLUMNS)
├─ id: INTEGER PRIMARY KEY AUTOINCREMENT
├─ entity_type: TEXT (e.g., 'User', 'Product', 'Order')
├─ data: TEXT (JSON blob - all custom properties stored here)
├─ created_at: DATETIME (automatic)
└─ updated_at: DATETIME (automatic)

IMPORTANT: Only these 5 columns exist in the database.
All entity properties (name, price, status, etc.) are stored IN THE JSON data column.
\`\`\`

⚠️ CRITICAL: ORDER BY RULES ⚠️

The \`orderBy\` configuration is applied CLIENT-SIDE after fetching data.
DO NOT reference columns that don't exist in the database table.

**CORRECT orderBy examples:**
- \`"created_at DESC"\` ✅ (created_at is a real column)
- \`"updated_at ASC"\` ✅ (updated_at is a real column)
- \`"name ASC, created_at DESC"\` ✅ (name is parsed from JSON, sorting happens client-side)
- \`"order ASC, created_at DESC"\` ✅ (order is parsed from JSON, sorting happens client-side)
- \`"priority DESC, dueDate ASC"\` ✅ (both parsed from JSON, sorting happens client-side)

**IMPORTANT:** You CAN reference JSON fields in orderBy - the repository automatically:
1. Fetches all records from database
2. Parses the JSON data column
3. Sorts by the specified fields client-side

**When orderBy includes JSON fields:**
The sorting happens AFTER data retrieval, not in SQL.
This is automatic - you just specify the field names.

ENTITY CREATION WORKFLOW (4 STEPS):

**Step 1: Create Entity Configuration**
Create \`src/entities/{EntityName}.ts\`:
\`\`\`typescript
import type { EntityConfig } from "../hooks/useEntity";

export const productEntityConfig: EntityConfig = {
  name: "Product",
  // This sorting happens client-side after JSON parsing
  orderBy: "created_at DESC", // Sort by real DB column
  // OR: orderBy: "price DESC, created_at DESC", // Sort by JSON field first, then DB column
  properties: {
    name: { type: "string", description: "Product name" },
    price: { type: "number", description: "Product price in USD" },
    stock: { type: "integer", description: "Current stock quantity" },
    category: {
      type: "string",
      enum: ["electronics", "clothing", "food", "other"],
      description: "Product category",
    },
    description: { type: "string", description: "Product description" },
    isActive: { type: "string", default: "true", description: "Active status" },
  },
  required: ["name", "price", "category"],
};
\`\`\`

**Step 2: Export from Entity Index**
Add to \`src/entities/index.ts\`:
\`\`\`typescript
export { productEntityConfig } from "./Product";
\`\`\`

**Step 3: Define TypeScript Type**
Create type matching the entity structure.
⚠️ ALWAYS include id, created_at, updated_at:
\`\`\`typescript
type Product = {
  id: number; // Added by database
  name: string;
  price: number;
  stock: number;
  category: "electronics" | "clothing" | "food" | "other";
  description: string;
  isActive: string;
  created_at: string; // Added by database
  updated_at: string; // Added by database
};
\`\`\`

**Step 4: Use in React Component**
\`\`\`typescript
import { useEntity } from "../hooks/useEntity";
import { productEntityConfig } from "../entities/Product";

function ProductManager() {
  const { items: products, loading, error, create, update, remove } =
    useEntity<Product>(productEntityConfig);

  const handleCreate = async () => {
    await create({
      name: "Laptop",
      price: 999.99,
      stock: 50,
      category: "electronics",
      description: "High-performance laptop",
      isActive: "true"
    });
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {String(error)}</div>;

  return (
    <div>
      <button onClick={handleCreate}>Add Product</button>
      {products.map(product => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>{product.price} - Stock: {product.stock}</p>
          <button onClick={() => remove(product.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
\`\`\`

DATABASE INITIALIZATION:
Add to your root component:
\`\`\`typescript
import { initializeDatabase } from "./database/init";
import { useEffect, useState } from "react";

function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initializeDatabase()
      .then(() => setDbReady(true))
      .catch(err => console.error("DB init failed:", err));
  }, []);

  if (!dbReady) return <div>Initializing database...</div>;

  return <YourApp />;
}
\`\`\`

ENTITY CONFIGURATION STRUCTURE:
- \`name\`: Entity type name (PascalCase, e.g., "User") - REQUIRED
- \`entityType?\`: Override entity_type in DB (defaults to name) - OPTIONAL
- \`orderBy?\`: Sort specification (can reference JSON fields) - OPTIONAL
- \`properties\`: Field definitions with type, description, enum, default - REQUIRED
- \`required?\`: Array of mandatory field names - OPTIONAL

FIELD TYPES:
- \`string\` → String in JSON
- \`number\` → Number (float) in JSON
- \`integer\` → Number (int) in JSON
- \`format: "date"\` → ISO date string

⚠️ BOOLEANS: Use string "true"/"false", not boolean type:
\`\`\`typescript
// ❌ WRONG
completed: { type: "boolean", default: false }

// ✅ CORRECT
completed: { type: "string", default: "false" }

// Usage in code:
task.completed === "true" // check if true
task.completed === "false" // check if false
\`\`\`

useEntity HOOK RETURNS:
- \`items: T[]\` - Array of records (already sorted by orderBy)
- \`loading: boolean\` - Loading state
- \`error: unknown\` - Error state (null if no error)
- \`reload()\` - Manually refresh data
- \`create(data)\` - Create new record (omit id, created_at, updated_at)
- \`update(id, data)\` - Update existing record (partial updates allowed)
- \`remove(id)\` - Delete record
- \`config\` - Original configuration

COMMON PATTERNS:

**Entity with Enum and Ordering:**
\`\`\`typescript
export const orderEntityConfig: EntityConfig = {
  name: "Order",
  orderBy: "status ASC, created_at DESC", // Status from JSON, created_at from DB
  properties: {
    status: {
      type: "string",
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    totalAmount: { type: "number" },
    customerName: { type: "string" },
  },
  required: ["totalAmount", "customerName"],
};
\`\`\`

**Entity with Display Order (Drag and Drop):**
\`\`\`typescript
export const taskEntityConfig: EntityConfig = {
  name: "Task",
  orderBy: "order ASC, created_at DESC", // order field for manual sorting
  properties: {
    title: { type: "string", description: "Task title" },
    order: { type: "integer", default: 0, description: "Display order" },
    completed: { type: "string", default: "false" },
  },
  required: ["title"],
};

// Usage: Updating order after drag-and-drop
const handleDragEnd = async (result: DropResult) => {
  if (!result.destination) return;
  
  const items = Array.from(tasks);
  const [reorderedItem] = items.splice(result.source.index, 1);
  items.splice(result.destination.index, 0, reorderedItem);
  
  // Update order field for each item
  for (let i = 0; i < items.length; i++) {
    await update(items[i].id, { order: i });
  }
  await reload(); // Refresh to get sorted list
};
\`\`\`

**Client-side Filtering:**
\`\`\`typescript
const { items: products } = useEntity<Product>(productEntityConfig);

// Filter after data is loaded
const electronics = products.filter((p) => p.category === "electronics");
const inStock = products.filter((p) => p.stock > 0);
const expensive = products.filter((p) => p.price > 100);
const activeProducts = products.filter((p) => p.isActive === "true");
\`\`\`

**Client-side Search:**
\`\`\`typescript
const [searchQuery, setSearchQuery] = useState("");
const { items: products } = useEntity<Product>(productEntityConfig);

const filteredProducts = products.filter((product) => {
  if (!searchQuery) return true;
  const query = searchQuery.toLowerCase();
  return (
    product.name.toLowerCase().includes(query) ||
    product.description.toLowerCase().includes(query)
  );
});
\`\`\`

**Validation:**
\`\`\`typescript
import { validateRequired, validateEmail, validateType, validateEnum } from "../lib/db-utils";

const handleCreate = async (data: any) => {
  // Validate required fields
  const errors = validateRequired(data, ["name", "email"]);
  if (errors.length > 0) {
    alert(\`Validation errors: \${errors.join(", ")}\`);
    return;
  }
  
  // Create record
  await create(data);
};
\`\`\`

**Updating Records:**
\`\`\`typescript
// Partial updates are supported
await update(productId, { price: 29.99 }); // Only update price
await update(productId, { stock: 100, isActive: "true" }); // Update multiple fields
await update(taskId, { completed: "true" }); // Toggle completion

// Get current values first if needed
const product = products.find(p => p.id === productId);
if (product) {
  await update(productId, { stock: product.stock + 10 }); // Increment stock
}
\`\`\`

FILE LOCATIONS:
- Entity Configs: \`src/entities/{EntityName}.ts\`
- Entity Index: \`src/entities/index.ts\`
- Hook: \`src/hooks/useEntity.ts\`
- Repository: \`src/repositories/flexibleEntityRepository.ts\`
- Database Client: \`src/database/client.ts\`
- Database Init: \`src/database/init.ts\`
- Utilities: \`src/lib/db-utils.ts\`

⚠️ CRITICAL DATABASE RULES ⚠️

**DO:**
- ✅ Define \`name\` in EntityConfig (required)
- ✅ Use \`string\`, \`number\`, or \`integer\` for types
- ✅ Use \`string\` with "true"/"false" for booleans
- ✅ Include \`id\`, \`created_at\`, \`updated_at\` in TypeScript type definitions
- ✅ OMIT \`id\`, \`created_at\`, \`updated_at\` when calling \`create()\`
- ✅ Export entity config from \`src/entities/index.ts\`
- ✅ Call \`initializeDatabase()\` before using entities
- ✅ Handle \`loading\` and \`error\` states in components
- ✅ Use descriptive field names and descriptions
- ✅ Use \`orderBy\` with any property name (sorting is client-side)
- ✅ Use \`reload()\` after bulk updates to refresh sorted data
- ✅ Understand that JSON properties and DB columns are sorted the same way

**DON'T:**
- ❌ Use \`table\` property (removed in new system)
- ❌ Try to create database tables manually
- ❌ Write raw SQL queries for entity operations
- ❌ Use DDL or migration files
- ❌ Forget to export from entities index
- ❌ Include \`id\`, \`created_at\`, or \`updated_at\` in \`create()\` calls
- ❌ Omit required fields when calling \`create()\`
- ❌ Mutate \`items\` array directly (use \`create\`/\`update\`/\`remove\`)
- ❌ Modify core database files (Database.ts, client.ts, init.ts, flexibleEntityRepository.ts)
- ❌ Use boolean type for true/false values (use string "true"/"false")
- ❌ Try to add new columns to the entities table
- ❌ Assume SQL ORDER BY limitations apply (client-side sorting handles everything)
- ❌ Query the database directly - always use useEntity hook
- ❌ Forget to await async operations (create, update, remove, reload)

⚠️ COMMON MISTAKES TO AVOID:

**Mistake 1: Including auto-generated fields in create()**
\`\`\`typescript
// ❌ WRONG - id, created_at, updated_at are auto-generated
await create({
  id: 1, // Don't include
  name: "Product",
  created_at: new Date().toISOString(), // Don't include
  updated_at: new Date().toISOString(), // Don't include
});

// ✅ CORRECT
await create({
  name: "Product",
  price: 99.99,
  category: "electronics",
});
\`\`\`

**Mistake 2: Using boolean instead of string**
\`\`\`typescript
// ❌ WRONG
properties: {
  isActive: { type: "boolean", default: false } // Not supported
}

// ✅ CORRECT
properties: {
  isActive: { type: "string", default: "false" }
}

// Usage:
if (product.isActive === "true") { ... }
await update(id, { isActive: "true" });
\`\`\`

**Mistake 3: Not handling loading/error states**
\`\`\`typescript
// ❌ WRONG - No loading or error handling
const { items: products } = useEntity<Product>(productEntityConfig);
return <div>{products.map(...)}</div>;

// ✅ CORRECT
const { items: products, loading, error } = useEntity<Product>(productEntityConfig);
if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {String(error)}</div>;
return <div>{products.map(...)}</div>;
\`\`\`

**Mistake 4: Direct array mutation**
\`\`\`typescript
// ❌ WRONG - Don't mutate items directly
products.push(newProduct);
products[0].price = 99.99;

// ✅ CORRECT - Use hook methods
await create(newProduct);
await update(products[0].id, { price: 99.99 });
\`\`\`

**Mistake 5: Forgetting to reload after bulk operations**
\`\`\`typescript
// ❌ WRONG - Data might be stale or out of order
for (const item of items) {
  await update(item.id, { order: item.newOrder });
}
// Component still shows old data

// ✅ CORRECT - Reload to get fresh, sorted data
for (const item of items) {
  await update(item.id, { order: item.newOrder });
}
await reload(); // Get fresh data with correct sorting
\`\`\`

**Summary:**
This database system eliminates complexity:
- No SQL knowledge required
- No table creation or migrations
- Instant entity creation from configs
- Type-safe with TypeScript
- Automatic CRUD via React hooks
- Client-side sorting handles all orderBy operations
- JSON storage allows flexible schemas
- All filtering and searching done client-side`;
}
