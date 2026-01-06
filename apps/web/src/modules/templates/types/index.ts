/**
 * Template Types & Interfaces
 *
 * Type definitions for the Community Templates feature
 */

// Base template interface (matching Prisma model)
export interface Template {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  logo: string;
  thumbnailUrl: string | null;
  screenshots: any;
  demoUrl: string | null;
  sourceProjectId: string | null;
  sourceFragmentId: string;
  categoryId: string | null;
  tags: string[];
  remixCount: number;
  viewCount: number;
  saveCount: number;
  featured: boolean;
  verified: boolean;
  published: boolean;
  authorId: string | null;
  authorName: string;
  chatHistoryVisible: boolean;
  seedPrompt: string | null;
  price: number | null;
  stripeProductId: string | null;
  stripePriceId: string | null;
}

// Template with relations
export interface TemplateWithRelations extends Template {
  category: TemplateCategory | null;
  author: TemplateAuthor | null;
  likeCount: number;
  commentCount: number;
  userLiked: boolean;
  userSaved: boolean;
}

// Template category
export interface TemplateCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  templateCount?: number;
}

// Template author info
export interface TemplateAuthor {
  id: string;
  name: string | null;
  image: string | null;
  email?: string;
}

// Template comment
export interface TemplateComment {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  templateId: string;
  userId: string;
  content: string;
  parentId: string | null;
  user: TemplateAuthor;
  replies?: TemplateComment[];
}

// Template chat message (recipe)
export interface TemplateChatMessage {
  id: string;
  createdAt: Date;
  templateId: string;
  role: string; // 'user' | 'assistant' | 'system'
  content: string;
  order: number;
}

// Sort options
export type TemplateSortBy = "newest" | "popular" | "trending";

// Filter options
export interface TemplateFilters {
  categories?: string[];
  tags?: string[];
  featured?: boolean;
  sortBy?: TemplateSortBy;
}

// Pagination
export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Template card props
export interface TemplateCardProps {
  template: TemplateWithRelations;
  onClick?: () => void;
  variant?: "default" | "compact" | "featured";
}

// Template grid props
export interface TemplateGridProps {
  templates: TemplateWithRelations[];
  loading?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

// Remix result
export interface RemixResult {
  projectId: string;
  projectName: string;
  redirectUrl: string;
}

// Social action result
export interface LikeResult {
  liked: boolean;
  likeCount: number;
}

export interface SaveResult {
  saved: boolean;
  saveCount: number;
}

// Template detail
export interface TemplateDetail extends TemplateWithRelations {
  sourceFragment: {
    id: string;
    title: string;
    files: any;
    createdAt: Date;
  };
  sourceProject: {
    id: string;
    name: string;
    subtitle: string | null;
    sandboxUrl: string | null;
    deploymentUrl: string | null;
  } | null;
  userPurchased: boolean;
  relatedTemplates: Array<{
    id: string;
    name: string;
    slug: string;
    shortDescription: string;
    logo: string;
    thumbnailUrl: string | null;
    remixCount: number;
  }>;
}

// Chat history
export interface TemplateChatHistory {
  seedPrompt: string | null;
  messages: TemplateChatMessage[];
}
