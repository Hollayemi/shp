import { UIMessage } from "@ai-sdk/react";

// 4-step modern todo app flow: Foundation → Organization → Productivity → Insights
export const TODO_APP_DEMO_STEPS: UIMessage[] = [
  {
    id: "user-1",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Build a modern todo list application with a clean, responsive design"
      }
    ]
  },
  {
    id: "assistant-1",
    role: "assistant",
    parts: [
      {
        type: "step-start"
      },
      {
        type: "reasoning",
        text: "I'll create a modern todo application with a beautiful, responsive design using React, TypeScript, and Tailwind CSS. This will be the foundation step focusing on core functionality with elegant UI.",
        state: "done"
      },
      {
        type: "tool-createOrEditFiles",
        toolCallId: "call_foundation_1",
        state: "output-available",
        input: {
          path: "src/components/TodoApp.tsx",
          content: "Modern todo app with step-aware components and responsive design...",
          description: "Create foundation TodoApp with modern UI and core functionality"
        },
        output: {
          success: true,
          path: "src/components/TodoApp.tsx",
          action: "created",
          description: "Create foundation TodoApp with modern UI and core functionality",
          size: 2840,
          message: "Successfully created modern TodoApp foundation"
        }
      },
      {
        type: "tool-createOrEditFiles",
        toolCallId: "call_foundation_2",
        state: "output-available",
        input: {
          path: "src/components/TaskCard.tsx",
          content: "Reusable TaskCard component with step-aware props...",
          description: "Create reusable TaskCard component with animations"
        },
        output: {
          success: true,
          path: "src/components/TaskCard.tsx",
          action: "created",
          description: "Create reusable TaskCard component with animations",
          size: 1650,
          message: "Successfully created TaskCard component"
        }
      },
      {
        type: "text",
        text: "✨ **Foundation Complete!**\n\nBuilt a beautiful, responsive todo app with modern UI, smooth animations, and core task management functionality.",
        state: "done"
      }
    ]
  },
  {
    id: "user-2",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Add authentication pages with login and signup"
      }
    ]
  },
  {
    id: "assistant-2",
    role: "assistant",
    parts: [
      {
        type: "step-start"
      },
      {
        type: "reasoning",
        text: "I'll create a complete authentication system with modern login and signup pages, user management, and protected routes. This adds security and personalization to the todo app.",
        state: "done"
      },
      {
        type: "tool-createOrEditFiles",
        toolCallId: "call_auth_1",
        state: "output-available",
        input: {
          path: "src/components/auth/LoginPage.tsx",
          content: "Modern login page with sleek design and form validation...",
          description: "Create modern login page with authentication flow"
        },
        output: {
          success: true,
          path: "src/components/auth/LoginPage.tsx",
          action: "created",
          description: "Create modern login page with authentication flow",
          size: 3240,
          message: "Successfully created LoginPage component"
        }
      },
      {
        type: "tool-createOrEditFiles",
        toolCallId: "call_auth_2",
        state: "output-available",
        input: {
          path: "src/components/auth/SignupPage.tsx",
          content: "Beautiful signup page with progressive form and onboarding...",
          description: "Create signup page with user onboarding experience"
        },
        output: {
          success: true,
          path: "src/components/auth/SignupPage.tsx",
          action: "created",
          description: "Create signup page with user onboarding experience",
          size: 4180,
          message: "Successfully created SignupPage component"
        }
      },
      {
        type: "tool-createOrEditFiles",
        toolCallId: "call_auth_3",
        state: "output-available",
        input: {
          path: "src/hooks/useAuth.tsx",
          content: "Authentication context and hooks for user management...",
          description: "Create authentication context and user management system"
        },
        output: {
          success: true,
          path: "src/hooks/useAuth.tsx",
          action: "created",
          description: "Create authentication context and user management system",
          size: 2650,
          message: "Successfully created authentication system"
        }
      },
      {
        type: "text",
        text: "🔐 **Authentication System Added!**\n\nImplemented complete auth flow with modern login/signup pages, user management, protected routes, and seamless user experience.",
        state: "done"
      }
    ]
  },
  {
    id: "user-3",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Add smart organization with categories, tags, and advanced filtering"
      }
    ]
  },
  {
    id: "assistant-3",
    role: "assistant",
    parts: [
      {
        type: "step-start"
      },
      {
        type: "reasoning",
        text: "I'll enhance the app with intelligent organization features including categories, tags, advanced filtering, and a sidebar layout. This transforms the simple authenticated app into a powerful organization system.",
        state: "done"
      },
      {
        type: "tool-createOrEditFiles",
        toolCallId: "call_organization_1",
        state: "output-available",
        input: {
          path: "src/components/CategorySidebar.tsx",
          content: "Smart category sidebar with filtering and organization...",
          description: "Create category sidebar with smart filtering and visual indicators"
        },
        output: {
          success: true,
          path: "src/components/CategorySidebar.tsx",
          action: "created",
          description: "Create category sidebar with smart filtering and visual indicators",
          size: 2180,
          message: "Successfully created CategorySidebar component"
        }
      },
      {
        type: "tool-createOrEditFiles",
        toolCallId: "call_organization_2",
        state: "output-available",
        input: {
          path: "src/components/TaskOrganizer.tsx",
          content: "Advanced task organization with drag-and-drop and smart categorization...",
          description: "Create task organizer with categories, tags, and smart features"
        },
        output: {
          success: true,
          path: "src/components/TaskOrganizer.tsx",
          action: "created",
          description: "Create task organizer with categories, tags, and smart features",
          size: 3420,
          message: "Successfully created TaskOrganizer component"
        }
      },
      {
        type: "tool-createOrEditFiles",
        toolCallId: "call_organization_3",
        state: "output-available",
        input: {
          path: "src/components/SmartFilters.tsx",
          content: "Intelligent filtering system with search and advanced options...",
          description: "Create smart filtering with search, date ranges, and custom filters"
        },
        output: {
          success: true,
          path: "src/components/SmartFilters.tsx",
          action: "created",
          description: "Create smart filtering with search, date ranges, and custom filters",
          size: 2840,
          message: "Successfully created SmartFilters component"
        }
      },
      {
        type: "text",
        text: "🗂️ **Smart Organization Added!**\n\nImplemented intelligent categorization with sidebar navigation, color-coded categories, tag system, advanced filtering, and smart search capabilities.",
        state: "done"
      }
    ]
  },
  {
    id: "user-4",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Add insights dashboard with analytics and goal tracking"
      }
    ]
  },
  {
    id: "assistant-4",
    role: "assistant",
    parts: [
      {
        type: "step-start"
      },
      {
        type: "reasoning",
        text: "I'll create a comprehensive insights dashboard with productivity analytics, goal tracking, habit formation metrics, and beautiful data visualizations. This final step transforms the app into a complete productivity mastery tool.",
        state: "done"
      },
      {
        type: "tool-createOrEditFiles",
        toolCallId: "call_insights_1",
        state: "output-available",
        input: {
          path: "src/components/InsightsDashboard.tsx",
          content: "Advanced analytics dashboard with productivity insights and goal tracking...",
          description: "Create insights dashboard with analytics, charts, and goal tracking"
        },
        output: {
          success: true,
          path: "src/components/InsightsDashboard.tsx",
          action: "created",
          description: "Create insights dashboard with analytics, charts, and goal tracking",
          size: 5240,
          message: "Successfully created InsightsDashboard component"
        }
      },
      {
        type: "tool-createOrEditFiles",
        toolCallId: "call_insights_2",
        state: "output-available",
        input: {
          path: "src/components/ProductivityCharts.tsx",
          content: "Interactive charts for productivity metrics and trend analysis...",
          description: "Create productivity charts with animated visualizations"
        },
        output: {
          success: true,
          path: "src/components/ProductivityCharts.tsx",
          action: "created",
          description: "Create productivity charts with animated visualizations",
          size: 3680,
          message: "Successfully created ProductivityCharts component"
        }
      },
      {
        type: "tool-createOrEditFiles",
        toolCallId: "call_insights_3",
        state: "output-available",
        input: {
          path: "src/components/GoalTracker.tsx",
          content: "Smart goal tracking with progress visualization and achievement system...",
          description: "Create goal tracker with milestones and achievements"
        },
        output: {
          success: true,
          path: "src/components/GoalTracker.tsx",
          action: "created",
          description: "Create goal tracker with milestones and achievements",
          size: 2920,
          message: "Successfully created GoalTracker component"
        }
      },
      {
        type: "text",
        text: "📊 **Insights Dashboard Complete!**\n\nImplemented comprehensive analytics with productivity metrics, goal tracking, habit formation insights, achievement system, and beautiful data visualizations. Your todo app is now a complete productivity mastery platform!",
        state: "done"
      }
    ]
  },
];

export const DEMO_SCENARIOS = {
  "todo-app": TODO_APP_DEMO_STEPS,
};

export type DemoScenarioType = keyof typeof DEMO_SCENARIOS;
