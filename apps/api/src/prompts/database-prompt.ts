import { stripIndents } from "./utils.js";

export function getDatabasePrompt(): string {
  return stripIndents`🗄️ DATABASE INTEGRATION (Turso):
- ALL projects include Turso database boilerplate by default
- Database credentials already configured (VITE_TURSO_DATABASE_URL, VITE_TURSO_AUTH_TOKEN)
- Database schema automatically initialized during sandbox creation
- Single-table design: All entities stored in one \`entities\` table with JSON data
- No CREATE TABLE, migrations, or manual initialization needed - instant entity creation from configs

WHEN TO USE DATABASE:
- User mentions: save, persist, store, database, data, records, users, items, etc.
- Any CRUD operations (create, read, update, delete)
- User authentication, user profiles, or multi-user features
- Shopping carts, todo lists, notes, or any stateful data

STORAGE MODEL:
\`\`\`
entities table
├─ id: INTEGER PRIMARY KEY AUTOINCREMENT
├─ entity_type: TEXT (e.g., 'User', 'Product', 'Order')
├─ data: TEXT (JSON blob of all entity properties)
├─ created_at: DATETIME (automatic)
└─ updated_at: DATETIME (automatic)
\`\`\`

ENTITY CREATION WORKFLOW (4 STEPS):

**Step 1: Create Entity Configuration**
Create \`src/entities/{EntityName}.ts\`:
\`\`\`typescript
import type { EntityConfig } from "../hooks/useEntity";

export const productEntityConfig: EntityConfig = {
  name: "Product",
  orderBy: "created_at DESC",
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
Create type matching the entity structure:
\`\`\`typescript
type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: "electronics" | "clothing" | "food" | "other";
  description: string;
  isActive: string;
  created_at: string;
  updated_at: string;
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
✨ **AUTOMATIC** - No initialization code needed!
- Database schema is created automatically when sandbox starts
- Entities table and indexes are ready immediately
- Just import and use \`useEntity\` hook directly in your components
- No need for \`initializeDatabase()\` or loading states

ENTITY CONFIGURATION STRUCTURE:
- \`name\`: Entity type name (PascalCase, e.g., "User")
- \`entityType?\`: Override entity_type in DB (defaults to name)
- \`orderBy?\`: SQL ORDER BY clause (e.g., "created_at DESC")
- \`properties\`: Field definitions with type, description, enum, default
- \`required?\`: Array of mandatory field names

FIELD TYPES:
- \`string\` → String in JSON
- \`number\` → Number (float) in JSON
- \`integer\` → Number (int) in JSON
- \`format: "date"\` → ISO date string

useEntity HOOK RETURNS:
- \`items: T[]\` - Array of records
- \`loading: boolean\` - Loading state
- \`error: unknown\` - Error state (null if no error)
- \`reload()\` - Manually refresh data
- \`create(data)\` - Create new record
- \`update(id, data)\` - Update existing record
- \`remove(id)\` - Delete record
- \`config\` - Original configuration

COMMON PATTERNS:

**Entity with Enum:**
\`\`\`typescript
export const orderEntityConfig: EntityConfig = {
  name: "Order",
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

**Client-side Filtering:**
\`\`\`typescript
const { items: products } = useEntity<Product>(productEntityConfig);
const electronics = products.filter((p) => p.category === "electronics");
const inStock = products.filter((p) => p.stock > 0);
const expensive = products.filter((p) => p.price > 100);
\`\`\`

**Validation:**
\`\`\`typescript
import { validateRequired, validateEmail, validateType, validateEnum } from "../lib/db-utils";

const handleCreate = async (data: any) => {
  const errors = validateRequired(data, ["name", "email"]);
  if (errors.length > 0) {
    alert(\`Validation errors: \${errors.join(", ")}\`);
    return;
  }
  await create(data);
};
\`\`\`

FILE LOCATIONS:
- Entity Configs: \`src/entities/{EntityName}.ts\`
- Entity Index: \`src/entities/index.ts\`
- Hook: \`src/hooks/useEntity.ts\`
- Repository: \`src/repositories/flexibleEntityRepository.ts\`
- Database Client: \`src/database/client.ts\`
- Utilities: \`src/lib/db-utils.ts\`

DATABASE RULES:

**DO:**
- ✅ Define \`name\` in EntityConfig (required)
- ✅ Use \`string\`, \`number\`, or \`integer\` for types
- ✅ Include \`id\`, \`created_at\`, \`updated_at\` in TypeScript type
- ✅ Export entity config from \`src/entities/index.ts\`
- ✅ Handle \`loading\` and \`error\` states in components
- ✅ Use descriptive field names and descriptions
- ✅ Start using entities immediately - schema is auto-initialized

**DON'T:**
- ❌ Call \`initializeDatabase()\` manually (it's automatic now)
- ❌ Use \`table\` property (removed in new system)
- ❌ Try to create database tables manually
- ❌ Use DDL or migration files
- ❌ Forget to export from entities index
- ❌ Omit required fields when calling \`create()\`
- ❌ Mutate \`items\` array directly (use \`create\`/\`update\`/\`remove\`)
- ❌ Modify core database files (Database.ts, Entity.ts, etc.)

**Summary:**
This database system eliminates complexity:
- No SQL knowledge required
- No table creation or migrations
- No manual initialization required
- Schema automatically created on sandbox startup
- Instant entity creation from configs
- Type-safe with TypeScript
- Automatic CRUD via React hooks`;
}
