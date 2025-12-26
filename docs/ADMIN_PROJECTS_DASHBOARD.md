# Admin Projects Dashboard

This feature adds comprehensive project management dashboards for administrators.

## New Pages Added

### 1. Projects Dashboard (`/admin/projects`)

- **Location**: `src/app/admin/projects/page.tsx`
- **Client Component**: `src/app/admin/projects/AdminProjectsDashboardClient.tsx`

**Features**:

- View all projects in the system with pagination
- Search projects by name, user, or ID
- Sort by:
  - Recently Updated
  - Most Messages
  - Most Advisor Chats
- See project statistics:
  - Total number of chat messages
  - Total HAL advisor interactions
  - Latest activity for each project
- Quick navigation to project details and user profiles

**Stats Overview**:

- Total Projects count
- Total Messages across all projects
- Total Advisor Chats
- Total Suggestions generated

### 2. Project Detail Page (`/admin/projects/[projectId]`)

- **Location**: `src/app/admin/projects/[projectId]/page.tsx`
- **Client Component**: `src/app/admin/projects/[projectId]/AdminProjectDetailClient.tsx`

**Features**:

- Detailed view of a single project
- Owner information with quick link to user profile
- Project statistics cards
- Three tabs for different data views:

#### Messages Tab
- All builder chat messages (USER/ASSISTANT)
- **Formatted AI responses** using the Response component for markdown rendering
- **Tool call detection and display** - automatically detects and formats tool calls with:
  - Tool name badges
  - Collapsible argument viewing
  - Call ID display
- **Toggle to view raw JSON** for AI messages with formatted output
- Message type indicators (RESULT/ERROR)
- Chronological ordering
- Full message content display
- Version indicator (V1 legacy or V2)

#### Advisor Tab  
- All HAL advisor chat interactions
- **Formatted AI responses** using the Response component
- **Tool call detection and display** for advisor actions
- **Toggle to view raw content and full message structure** (parts)
- User, assistant, and system messages
- Chronological ordering

#### Suggestions Tab

- All HAL suggestions generated for the project
- Visual cards with icons and colors
- Click status indicators
- Target chat type (builder/advisor)
- View prompt on expand
- Creation and click timestamps

### 3. Enhanced User Detail Page (`/admin/dashboard/[userId]`)

- **Updated**: `src/app/admin/dashboard/[userId]/UserDetailClient.tsx`

**New Features**:

- Projects section showing user's recent projects (last 10)
- Project message and advisor chat counts
- Quick links to project details
- Link to view all user projects in main projects dashboard

## Backend Changes

### New tRPC Procedures (`src/modules/admin/server/procedures.ts`)

#### `getAllProjects`

```typescript
{
  page: number;
  limit: number;
  search?: string;
  sortBy: "recent" | "messages" | "advisor";
}
```

Returns paginated list of projects with:

- User information
- Message counts
- HAL chat message counts
- Latest message preview
- Pagination metadata

#### `getProjectStats`

Returns overall statistics:

- Total projects count
- Total messages count
- Total HAL messages count
- Total suggestions count

#### `getProjectDetails`

```typescript
{
  projectId: string;
}
```

Returns complete project information:

- Project details with user info
- All messages (ordered chronologically)
- All HAL chat messages with parts
- All suggestions with click status

#### Enhanced `getUserDetails`

Now includes:

- User's recent projects (last 10)
- Project message counts
- HAL chat message counts

## Navigation

### From Main Admin Dashboard

- New "Projects" button in header links to `/admin/projects`
- Existing deployments and credit activity buttons remain

### From User Detail Page

- Projects table with "View Details" links to individual projects
- "View All" link to projects dashboard filtered by user email

### From Projects Dashboard

- "View Details" on each project → Project detail page
- "View Owner" on each project → User detail page
- Back to "User Dashboard" in header

### From Project Detail Page

- "Back to Projects" button
- "View Owner" button → User detail page

## Database Schema

Uses existing Prisma models:

- `Project` - Project information
- `Message` - Builder chat messages
- `HalChatMessage` - HAL advisor chat messages
- `HalSuggestion` - HAL suggestions
- `User` - User information

## Search & Filtering

### Projects Dashboard

- **Search**: Project name, user name, user email, project ID
- **Sort**: Recent updates, message count, advisor chat count
- **Pagination**: 20 items per page

### User Projects Section

- Shows last 10 projects
- Ordered by most recently updated
- Filter link to view all user projects in main dashboard

## UI Components Used

- Shadcn UI components:
  - `Button`
  - `Input`
  - `Select`
  - `Badge`
  - `Card`
  - `Tabs`
  - `Pagination`
- Lucide icons:
  - `MessageSquare` - Messages
  - `Sparkles` - Advisor/AI features
  - `Users` - User management
  - `FolderOpen` - Projects
  - `ArrowLeft` - Navigation
  - `User` - User profile

## Access Control

- All pages protected by admin authentication
- Uses `isAdminEmail()` check from `/lib/admin`
- Server-side and client-side validation
- Redirects non-admins to home page

## Future Enhancements

Potential improvements:

1. Export project data to CSV/JSON
2. Bulk project operations
3. Project archiving/deletion
4. More detailed analytics per project
5. Filter by date ranges
6. Project tags/categories
7. Direct message sending to project chat
8. Inline suggestion editing/approval
