import {
  Award,
  Beer,
  Battery,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  Camera,
  Car,
  ChartPie,
  CheckSquare,
  ClipboardList,
  Cloud,
  Coffee,
  Coins,
  Cpu,
  Calendar,
  Calculator,
  Dumbbell,
  Factory,
  FlaskRound,
  Gamepad,
  Gift,
  Globe,
  GraduationCap,
  Grid2x2,
  Headset,
  Heart,
  Home,
  Leaf,
  Lightbulb,
  Map,
  MessageSquare,
  Music,
  Palette,
  PawPrint,
  Plane,
  Rocket,
  Shield,
  ShoppingCart,
  Sparkles,
  Store,
  Timer,
  Trees,
  Utensils,
  Wallet,
  Waves,
  Wine,
  BookOpenCheck,
} from "lucide-react";

export interface PromptPreset {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
  description: string;
}

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "kanban-board",
    label: "Kanban Board",
    icon: Grid2x2,
    prompt: `Build a kanban-style task board with:
    
    - Columns for Backlog, In Progress, and Done (support adding custom columns)
    - Drag-and-drop cards between columns with smooth animations
    - Card details modal: title, description, assignees, labels, due dates, and checklists
    - Quick filters by assignee, label, and due date; search by title/description
    - Subtasks with completion state and progress indicator on the card
    - Activity log per card (created, moved, status changes, comments)
    - Keyboard shortcuts for creating cards, moving between columns, and focusing search
    - Responsive layout that works well on desktop and mobile
    - Local persistence plus mock API layer for future backend hookup`,
    description: "Drag-and-drop project workflow",
  },
  {
    id: "bill-splitter",
    label: "Bill Splitter",
    icon: ChartPie,
    prompt: `Create a bill splitting app with:
    
    - Add participants and expenses with payer selection and optional receipt photo
    - Split options: equally, by percentages, by shares, or custom amounts
    - Support tax, tip, service fees, and discounts applied before/after split
    - Real-time per-person totals with who-owes-who settlement summary
    - Grouping by event or trip with multiple bills inside each event
    - Currency selection and rounding rules for fair splits
    - Export/share summary (copy, PDF-style print view)
    - Offline-friendly local storage with ability to restore previous sessions
    - Responsive UI optimized for quick entry on mobile`,
    description: "Fair splits with receipts and settlements",
  },
  {
    id: "explore-recipes",
    label: "Explore Recipes",
    icon: Sparkles,
    prompt: `Build a recipe discovery experience with:
    
    - Search with filters for cuisine, diet (vegan, gluten-free, etc.), prep time, and difficulty
    - Ingredient-based suggestions (type ingredients you have, get recipe ideas)
    - Recipe detail pages with ingredients, instructions, nutrition, and timers for each step
    - Save to favorites and create collections (weeknight, meal prep, dinner party)
    - Shopping list generator that aggregates ingredients across selected recipes
    - Rating and review UI with photo uploads
    - Substitutions and dietary swaps shown inline for each ingredient
    - Responsive gallery grid with lazy-loaded cards and quick-view modals`,
    description: "Discover and save great dishes",
  },
  {
    id: "todo",
    label: "Todo App",
    icon: CheckSquare,
    prompt: `Build a todo list application with these features:
  
  - Add tasks with title, description, due date, and priority levels
  - Edit tasks inline with click-to-edit functionality
  - Delete tasks with confirmation dialog
  - Mark tasks complete/incomplete with visual strikethrough
  - Filter tasks by status (all, active, completed) and priority
  - Search functionality to find specific tasks
  - Drag and drop to reorder tasks
  - Local storage to persist tasks between sessions
  - Clean, responsive UI for mobile and desktop
  - Task counter showing totals
  - Bulk actions to mark multiple tasks complete or delete them`,
    description: "Task management app",
  },
  {
    id: "landing",
    label: "Landing Page",
    icon: Globe,
    prompt: `Create a modern landing page for a SaaS product with these sections:
  
  - Hero section with headline, subheadline, hero image, and CTA button
  - Social proof with customer logos and testimonials
  - Features section highlighting key benefits with icons
  - How it works with 3-step process visualization
  - Pricing section with 2-3 tiers and feature comparison
  - FAQ section addressing common questions
  - Contact form with lead capture
  - Footer with links and social media
  - Fully responsive design for mobile, tablet, and desktop
  - Fast loading with optimized images
  - SEO-friendly structure with proper headings`,
    description: "Marketing website",
  },
  {
    id: "caffeine",
    label: "Caffeine Tracker",
    icon: Coffee,
    prompt: `Build a caffeine tracking application with:
  
  - Log caffeine intake with drink type, amount, and time
  - Preset drinks (coffee, tea, energy drinks) with customizable caffeine amounts
  - Daily caffeine limit setting with progress tracking
  - Visual timeline showing caffeine levels throughout the day
  - Sleep impact analysis based on caffeine timing
  - Weekly and monthly consumption reports with charts
  - Reminder notifications for optimal caffeine timing
  - Custom drink creation with caffeine content
  - Export data for health tracking apps
  - Dark mode for late-night logging
  - Responsive design for mobile and desktop
  - Achievement system for healthy caffeine habits`,
    description: "Daily caffeine consumption tracker",
  },
  {
    id: "calculator",
    label: "Calculator",
    icon: Calculator,
    prompt: `Create a calculator application with:
  
  - Basic arithmetic operations (add, subtract, multiply, divide)
  - Advanced operations (percentage, square root, power)
  - Memory functions (store, recall, clear)
  - Scientific mode with trigonometric functions and logarithms
  - History feature showing previous calculations
  - Keyboard input support for numbers and operations
  - Error handling for division by zero
  - Clear (C) and All Clear (AC) functions
  - Decimal point handling with proper precision
  - Responsive design for mobile and desktop
  - Visual feedback for button presses
  - Copy result to clipboard functionality`,
    description: "Math calculation tool",
  },
  {
    id: "weather",
    label: "Weather App",
    icon: Cloud,
    prompt: `Build a weather application with:
  
  - Current weather with temperature, humidity, wind speed, and pressure
  - 5-day forecast with daily highs/lows and precipitation chance
  - Hourly forecast for next 24 hours with weather icons
  - Location search with autocomplete and geolocation
  - Save favorite cities and switch between them
  - Weather alerts and severe weather warnings
  - Interactive weather maps showing precipitation and temperature
  - Sunrise/sunset times and moon phases
  - Air quality and UV index information
  - Responsive design with weather-themed animations
  - Unit conversion (Celsius/Fahrenheit, mph/kmh)
  - Weather history for selected locations`,
    description: "Weather information dashboard",
  },
  {
    id: "recipes",
    label: "Recipe Book",
    icon: Utensils,
    prompt: `Create a recipe sharing platform with:
  
  - Recipe creation with ingredients, instructions, prep/cook time, and servings
  - Photo upload for recipe images
  - Recipe categories (appetizers, mains, desserts) and cuisine types
  - Search and filtering by ingredients, dietary restrictions, and cooking time
  - User profiles with favorite recipes and collections
  - Rating and review system with 5-star ratings
  - Shopping list generator from selected recipes
  - Meal planning calendar for weekly scheduling
  - Recipe scaling to adjust serving sizes
  - Print-friendly recipe format
  - Social features - follow cooks, share recipes, comment
  - Responsive design optimized for kitchen use on tablets and phones`,
    description: "Cooking recipe collection",
  },
  {
    id: "fitness-tracker",
    label: "Fitness Tracker",
    icon: Dumbbell,
    prompt: `Build a comprehensive fitness tracking application with:
  
  - Workout logging with sets, reps, weight, and duration tracking
  - Extensive exercise library with categories (strength, cardio, flexibility, sports)
  - Exercise detail pages with proper form instructions and muscle groups worked
  - Daily, weekly, and monthly fitness goals with progress tracking
  - Streak counter and achievement badges to maintain motivation
  - Interactive progress charts showing strength gains, weight trends, and workout frequency
  - Built-in rest timer with customizable intervals between sets
  - Workout templates and routines for quick logging
  - Personal records (PRs) tracking for each exercise
  - Calendar view showing workout history and patterns
  - Exportable workout summaries and progress reports (PDF/CSV)
  - Notes section for each workout to track how you felt
  - Responsive design optimized for use in the gym on mobile devices
  - Dark mode for low-light gym environments`,
    description: "Track workouts and progress",
  },
  {
    id: "habit-builder",
    label: "Habit Builder",
    icon: ClipboardList,
    prompt: `Create a habit tracking application with:
  
  - Daily habit checklist with customizable habit entries
  - Streak tracking with current and longest streak displays
  - Push notification reminders for each habit at scheduled times
  - Weekly and monthly heatmap visualization showing consistency
  - Goal templates for common habits (exercise, reading, meditation, water intake)
  - Custom habit creation with frequency options (daily, weekly, specific days)
  - Motivational quotes and messages based on progress
  - Statistics dashboard showing completion rates and trends
  - Habit categories for better organization (health, productivity, mindfulness)
  - Notes section to journal about each habit completion
  - Light and dark theme support with smooth transitions
  - Habit history and analytics with charts
  - Achievement system with milestone celebrations
  - Export progress data for personal tracking
  - Responsive design for mobile and desktop use`,
    description: "Daily habits with streaks",
  },
  {
    id: "budget-planner",
    label: "Budget Planner",
    icon: Wallet,
    prompt: `Design a comprehensive personal budgeting tool with:
  
  - Customizable expense categories (housing, food, transport, entertainment, etc.)
  - Income tracking with multiple sources support
  - Recurring expense management with automatic monthly entries
  - One-time expense logging with date, amount, and notes
  - Savings goals with progress tracking and target dates
  - Monthly budget allocation with spent vs. budgeted comparisons
  - Visual charts showing spending by category and trends over time
  - Budget health score and insights
  - CSV import for bank statements and bulk transactions
  - CSV/PDF export for record keeping and tax purposes
  - Bill reminders and payment due dates
  - Budget vs. actual spending alerts
  - Year-over-year comparison views
  - Multiple budget profiles (personal, business, family)
  - Responsive design for desktop and mobile
  - Data persistence with local storage`,
    description: "Personal finance dashboard",
  },
  {
    id: "podcast-player",
    label: "Podcast Player",
    icon: Music,
    prompt: `Create a feature-rich podcast player application with:
  
  - Podcast search and discovery with categories and trending shows
  - Subscription management for favorite podcasts
  - Episode listing with descriptions, show notes, and duration
  - Audio player with play, pause, skip forward/backward controls
  - Variable playback speed (0.5x to 2x)
  - Sleep timer with customizable duration
  - Queue management for creating playlists
  - Download episodes for offline listening
  - Bookmarks with notes for saving important moments
  - Progress tracking across devices with sync-ready architecture
  - Continue listening from where you left off
  - Episode filtering (played, unplayed, downloaded)
  - Podcast recommendations based on listening history
  - Share episodes with timestamp links
  - Dark mode for nighttime listening
  - Responsive design for mobile and desktop
  - Keyboard shortcuts for power users`,
    description: "Listen and manage podcasts",
  },
  {
    id: "note-taking",
    label: "Note Taking",
    icon: BookOpen,
    prompt: `Build a comprehensive note-taking application with:
  
  - Rich text editor with formatting (bold, italic, lists, headings, code blocks)
  - Markdown support for quick formatting
  - Tag system for organizing notes with multi-tag support
  - Pin important notes to the top
  - Fast full-text search across all notes
  - Note linking and backlinks for building a knowledge graph
  - Note templates for common formats (meeting notes, journal, todo)
  - Folders and nested organization structure
  - Favorites for quick access to frequently used notes
  - Note versioning and edit history
  - Image and file attachments support
  - Code syntax highlighting for technical notes
  - Export notes as Markdown, PDF, or plain text
  - Offline-first architecture with sync-ready storage
  - Dark mode and customizable themes
  - Keyboard shortcuts for power users
  - Responsive design for seamless mobile and desktop experience
  - Note sharing with public links or collaboration mode`,
    description: "Organized personal notes",
  },
  {
    id: "job-board",
    label: "Job Board",
    icon: Building2,
    prompt: `Build a full-featured job board platform with:

  - Job posting flow with approval, drafts, and employer dashboard  
  - Advanced filters (role, location, salary, experience, remote/on-site)  
  - Search with saved queries, alerts, and personalized recommendations  
  - Company profile pages with logos, descriptions, open roles, and reviews  
  - Application tracking for employers (pipeline, notes, status updates)  
  - Candidate accounts with resumes, saved jobs, and application history  
  - Admin panel for moderation, analytics, and role management  
  - Responsive UI optimized for desktop and mobile`,
    description: "Curated job listings and filters",
  },
  {
    id: "portfolio",
    label: "Portfolio Site",
    icon: Palette,
    prompt: `Design a professional portfolio website with:
  
  - Responsive project grid with tags, filters, and hover previews  
  - Case study pages with sections for problem, process, and results  
  - Built-in blog or writing area with Markdown support  
  - Interactive contact form with spam protection  
  - Testimonial carousel with avatars and categories  
  - Global theme switcher (light, dark, custom accents)  
  - SEO-ready structure and metadata  
  - CMS-friendly architecture or simple admin editing panel`,
    description: "Showcase your work",
  },  
  {
    id: "photo-gallery",
    label: "Photo Gallery",
    icon: Camera,
    prompt: `Build a responsive photo gallery application with:
  
  - Album organization and nested collections  
  - Tag-based filtering and smart search  
  - Lazy loading and infinite scroll for large galleries  
  - Lightbox with zoom, slideshow, and keyboard navigation  
  - User favorites and quick-collection tools  
  - Simple admin panel for uploads, batch edits, and metadata editing  
  - EXIF data display and optional auto-grouping  
  - Secure public/private sharing options`,
    description: "Curated photo albums",
  },  
  {
    id: "event-planner",
    label: "Event Planner",
    icon: Calendar,
    prompt: `Create a complete event planning system with:
  
  - Event scheduling, details pages, and timeline builder  
  - Guest list management with RSVPs, statuses, and +1 options  
  - Automated reminders via email or SMS  
  - Guest messaging system with broadcast or segmented groups  
  - Seating chart designer with drag-and-drop tables  
  - Task checklists, vendor tracking, and budget overview  
  - Dashboard summaries for attendance, tasks, and event health  
  - Multi-event support with templates and duplication options`,
    description: "Plan and manage events",
  },  
  {
    id: "travel-planner",
    label: "Travel Planner",
    icon: Map,
    prompt: `Plan trips with day-by-day itinerary, map views, saved places, budgets, packing lists, and offline export.`,
    description: "Trips with itineraries",
  },
  {
    id: "flight-tracker",
    label: "Flight Tracker",
    icon: Plane,
    prompt: `Track flights with live status (mock), airport info, alerts, seat maps, baggage reminders, and travel documents vault.`,
    description: "Monitor flights and alerts",
  },
  {
    id: "home-inventory",
    label: "Home Inventory",
    icon: Shield,
    prompt: `Create a home inventory for insurance with rooms, items, receipts, photos, depreciation tracking, and exportable reports.`,
    description: "Track household assets",
  },
  {
    id: "smart-home",
    label: "Smart Home",
    icon: Battery,
    prompt: `Design a smart home dashboard with device cards, room grouping, schedules, energy estimates, and quick actions.`,
    description: "Control smart devices",
  },
  {
    id: "garden-journal",
    label: "Garden Journal",
    icon: Leaf,
    prompt: `Log plants with watering/fertilizing schedules, growth photos, reminders, seasonal tips, and weather-aware alerts.`,
    description: "Track plant care",
  },
  {
    id: "pet-care",
    label: "Pet Care",
    icon: PawPrint,
    prompt: `Manage pet health with vet visits, meds, vaccination reminders, feeding schedules, weight tracking, and care notes.`,
    description: "Pet health & routines",
  },
  {
    id: "food-delivery",
    label: "Food Delivery",
    icon: Utensils,
    prompt: `Mock food delivery UI with restaurant cards, menus, cart, checkout, delivery tracking, and ratings.`,
    description: "Restaurant ordering flow",
  },
  {
    id: "grocery-list",
    label: "Grocery List",
    icon: ShoppingCart,
    prompt: `Build a grocery list app with aisles, categories, shared lists, price estimates, pantry mode, and offline support.`,
    description: "Shared grocery planning",
  },
  {
    id: "meal-planner",
    label: "Meal Planner",
    icon: BookOpenCheck,
    prompt: `Weekly meal planner with recipes, shopping list export, macros overview, favorites, and leftovers tracking.`,
    description: "Plan meals and macros",
  },
  {
    id: "wine-journal",
    label: "Wine Journal",
    icon: Wine,
    prompt: `Catalog wines with tasting notes, photos, ratings, pairings, cellar locations, and wishlists.`,
    description: "Track tastings and cellars",
  },
  {
    id: "coffee-log",
    label: "Coffee Log",
    icon: Coffee,
    prompt: `Track coffee brews with beans, grind, ratio, method, notes, timers, and flavor wheel tags.`,
    description: "Dial-in your brews",
  },
  {
    id: "weather-radar",
    label: "Weather Radar",
    icon: Cloud,
    prompt: `Weather dashboard with current, hourly, multi-day, radar tiles (mock), alerts, and saved locations.`,
    description: "Forecasts with radar view",
  },
  {
    id: "language-tutor",
    label: "Language Tutor",
    icon: MessageSquare,
    prompt: `Language practice app with flashcards, spaced repetition, mini dialogues, pronunciation tips, and streaks.`,
    description: "Practice vocabulary",
  },
  {
    id: "study-planner",
    label: "Study Planner",
    icon: GraduationCap,
    prompt: `Plan study sessions with subjects, time blocking, pomodoro timers, progress charts, and exam countdowns.`,
    description: "Organize study blocks",
  },
  {
    id: "quiz-builder",
    label: "Quiz Builder",
    icon: Lightbulb,
    prompt: `Create quizzes with question banks, multiple types (MCQ, true/false, short answer), timers, scoring, and review mode.`,
    description: "Author and take quizzes",
  },
  {
    id: "flashcards",
    label: "Flashcards",
    icon: BookOpen,
    prompt: `Flashcard app with spaced repetition, tags, decks, import/export, keyboard shortcuts, and progress stats.`,
    description: "Study with spaced repetition",
  },
  {
    id: "issue-tracker",
    label: "Issue Tracker",
    icon: ClipboardList,
    prompt: `Simple issue tracker with statuses, assignees, labels, comments, attachments, and kanban board view.`,
    description: "Track bugs and tasks",
  },
  {
    id: "helpdesk",
    label: "Helpdesk",
    icon: Headset,
    prompt: `Ticketing system with inbox, priorities, tags, canned responses, SLA timers, and customer history.`,
    description: "Support ticket workflow",
  },
  {
    id: "chat-support",
    label: "Chat Support",
    icon: Bot,
    prompt: `Live chat UI with agent/visitor roles, typing indicators, file uploads, canned replies, and satisfaction survey.`,
    description: "Live support chat",
  },
  {
    id: "kanban-dev",
    label: "Dev Kanban",
    icon: Grid2x2,
    prompt: `Developer-focused kanban with epics, swimlanes, WIP limits, backlog, sprint view, and burndown chart.`,
    description: "Engineering board",
  },
  {
    id: "iot-dashboard",
    label: "IoT Dashboard",
    icon: Cpu,
    prompt: `Device telemetry dashboard with cards, charts, alerts, uptime, firmware status, and control toggles.`,
    description: "Monitor devices",
  },
  {
    id: "energy-usage",
    label: "Energy Usage",
    icon: Battery,
    prompt: `Energy monitoring UI with hourly/daily charts, appliance breakdown, cost projection, and tips.`,
    description: "Track consumption",
  },
  {
    id: "factory-monitor",
    label: "Factory Monitor",
    icon: Factory,
    prompt: `Operations dashboard with machine status, throughput, downtime log, alerts, and KPI widgets.`,
    description: "Manufacturing ops view",
  },
  {
    id: "security-center",
    label: "Security Center",
    icon: Shield,
    prompt: `Security alerts console with severities, timelines, affected assets, runbooks, and acknowledgements.`,
    description: "Monitor security events",
  },
  {
    id: "alerting-hub",
    label: "Alerting Hub",
    icon: Bell,
    prompt: `Alert hub with filters, routing rules, on-call schedule mock, escalations, and mute windows.`,
    description: "Manage alerts",
  },
  {
    id: "gaming-hub",
    label: "Gaming Hub",
    icon: Gamepad,
    prompt: `Gaming library with achievements, friends list, session tracker, clips gallery, and performance stats.`,
    description: "Track games and sessions",
  },
  {
    id: "music-mixer",
    label: "Music Mixer",
    icon: Music,
    prompt: `Simple music mixer UI with tracks, playhead, volume/pan controls, FX toggles, and export (mock).`,
    description: "Layer and mix tracks",
  },
  {
    id: "travel-journal",
    label: "Travel Journal",
    icon: Map,
    prompt: `Travel diary with entries, photos, map pins, budget notes, favorites, and printable summary.`,
    description: "Log trips with maps",
  },
  {
    id: "surf-report",
    label: "Surf Report",
    icon: Waves,
    prompt: `Surf conditions board with swell (mock), tide times, wind, spot bookmarks, and gear checklist.`,
    description: "Daily surf conditions",
  },
  {
    id: "brewery-finder",
    label: "Brewery Finder",
    icon: Beer,
    prompt: `Find breweries with map view, styles filter, tap lists, tasting notes, and tour scheduler (mock).`,
    description: "Discover breweries",
  },
  {
    id: "civic-services",
    label: "Civic Services",
    icon: Building2,
    prompt: `City services portal with service categories, request submission, status tracking, and knowledge base.`,
    description: "Local services hub",
  },
];
