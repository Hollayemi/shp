import { z } from "zod";

export interface Themes {
  name: string;
  description: string;
  projectTypes: string[];
  personality: string[];
  tags: string[];
  themeLight: ThemeVariants;
  themeDark: ThemeVariants;
  themeInline: ThemeVariants;
  body?: Record<string, string>;
}

interface ThemeVariants {
  // Core Colors
  background: string;
  foreground: string;

  // Card Colors
  card: string;
  cardForeground: string;

  // Popover Colors
  popover: string;
  popoverForeground: string;

  // Primary Colors
  primary: string;
  primaryForeground: string;

  // Secondary Colors
  secondary: string;
  secondaryForeground: string;

  // Muted Colors
  muted: string;
  mutedForeground: string;

  // Accent Colors
  accent: string;
  accentForeground: string;

  // Destructive Colors
  destructive: string;
  destructiveForeground: string;

  // Border & Input
  border: string;
  input: string;
  ring: string;

  // Chart Colors
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;

  // Sidebar Colors
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;

  // Typography
  fontSans: string;
  fontSerif: string;
  fontMono: string;

  // Layout
  radius?: string;
  radiusSm?: string;
  radiusMd?: string;
  radiusLg?: string;
  radiusXl?: string;

  spacing?: string;
  trackingNormal?: string;

  // Shadows
  shadow2xs: string;
  shadowXs: string;
  shadowSm: string;
  shadow: string;
  shadowMd: string;
  shadowLg: string;
  shadowXl: string;
  shadow2xl: string;
}

const THEME_DEFINITIONS: Record<string, Themes> = {
  AmberMinimal: {
    name: "AmberMinimal",
    description: "A minimal theme with a focus on simplicity and elegance.",
    projectTypes: ["SaaS", "Productivity", "Industry", "Dashboard"],
    personality: ["Minimalist", "Simple", "Professional"],
    tags: ["orange", "brown", "black"],
    themeLight: {
      background: "oklch(1.0000 0 0)",
      foreground: "oklch(0.2686 0 0)",
      card: "oklch(1.0000 0 0)",
      cardForeground: "oklch(0.2686 0 0)",
      popover: "oklch(1.0000 0 0)",
      popoverForeground: "oklch(0.2686 0 0)",
      primary: "oklch(0.7686 0.1647 70.0804)",
      primaryForeground: "oklch(0 0 0)",
      secondary: "oklch(0.9670 0.0029 264.5419)",
      secondaryForeground: "oklch(0.4461 0.0263 256.8018)",
      muted: "oklch(0.9846 0.0017 247.8389)",
      mutedForeground: "oklch(0.5510 0.0234 264.3637)",
      accent: "oklch(0.9869 0.0214 95.2774)",
      accentForeground: "oklch(0.4732 0.1247 46.2007)",
      destructive: "oklch(0.6368 0.2078 25.3313)",
      destructiveForeground: "oklch(1.0000 0 0)",
      border: "oklch(0.9276 0.0058 264.5313)",
      input: "oklch(0.9276 0.0058 264.5313)",
      ring: "oklch(0.7686 0.1647 70.0804)",
      chart1: "oklch(0.7686 0.1647 70.0804)",
      chart2: "oklch(0.6658 0.1574 58.3183)",
      chart3: "oklch(0.5553 0.1455 48.9975)",
      chart4: "oklch(0.4732 0.1247 46.2007)",
      chart5: "oklch(0.4137 0.1054 45.9038)",
      sidebar: "oklch(0.9846 0.0017 247.8389)",
      sidebarForeground: "oklch(0.2686 0 0)",
      sidebarPrimary: "oklch(0.7686 0.1647 70.0804)",
      sidebarPrimaryForeground: "oklch(1.0000 0 0)",
      sidebarAccent: "oklch(0.9869 0.0214 95.2774)",
      sidebarAccentForeground: "oklch(0.4732 0.1247 46.2007)",
      sidebarBorder: "oklch(0.9276 0.0058 264.5313)",
      sidebarRing: "oklch(0.7686 0.1647 70.0804)",
      fontSans: "Inter, sans-serif",
      fontSerif: "Source Serif 4, serif",
      fontMono: "JetBrains Mono, monospace",
      radius: "0.375rem",
      shadow2xs: "0px 4px 8px -1px hsl(0 0% 0% / 0.05)",
      shadowXs: "0px 4px 8px -1px hsl(0 0% 0% / 0.05)",
      shadowSm:
        "0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 1px 2px -2px hsl(0 0% 0% / 0.10)",
      shadow:
        "0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 1px 2px -2px hsl(0 0% 0% / 0.10)",
      shadowMd:
        "0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 2px 4px -2px hsl(0 0% 0% / 0.10)",
      shadowLg:
        "0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 4px 6px -2px hsl(0 0% 0% / 0.10)",
      shadowXl:
        "0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 8px 10px -2px hsl(0 0% 0% / 0.10)",
      shadow2xl: "0px 4px 8px -1px hsl(0 0% 0% / 0.25)",
      trackingNormal: "0em",
      spacing: "0.25rem",
    },
    themeDark: {
      background: "oklch(0.2046 0 0)",
      foreground: "oklch(0.9219 0 0)",
      card: "oklch(0.2686 0 0)",
      cardForeground: "oklch(0.9219 0 0)",
      popover: "oklch(0.2686 0 0)",
      popoverForeground: "oklch(0.9219 0 0)",
      primary: "oklch(0.7686 0.1647 70.0804)",
      primaryForeground: "oklch(0 0 0)",
      secondary: "oklch(0.2686 0 0)",
      secondaryForeground: "oklch(0.9219 0 0)",
      muted: "oklch(0.2686 0 0)",
      mutedForeground: "oklch(0.7155 0 0)",
      accent: "oklch(0.4732 0.1247 46.2007)",
      accentForeground: "oklch(0.9243 0.1151 95.7459)",
      destructive: "oklch(0.6368 0.2078 25.3313)",
      destructiveForeground: "oklch(1.0000 0 0)",
      border: "oklch(0.3715 0 0)",
      input: "oklch(0.3715 0 0)",
      ring: "oklch(0.7686 0.1647 70.0804)",
      chart1: "oklch(0.8369 0.1644 84.4286)",
      chart2: "oklch(0.6658 0.1574 58.3183)",
      chart3: "oklch(0.4732 0.1247 46.2007)",
      chart4: "oklch(0.5553 0.1455 48.9975)",
      chart5: "oklch(0.4732 0.1247 46.2007)",
      sidebar: "oklch(0.1684 0 0)",
      sidebarForeground: "oklch(0.9219 0 0)",
      sidebarPrimary: "oklch(0.7686 0.1647 70.0804)",
      sidebarPrimaryForeground: "oklch(1.0000 0 0)",
      sidebarAccent: "oklch(0.4732 0.1247 46.2007)",
      sidebarAccentForeground: "oklch(0.9243 0.1151 95.7459)",
      sidebarBorder: "oklch(0.3715 0 0)",
      sidebarRing: "oklch(0.7686 0.1647 70.0804)",
      fontSans: "Inter, sans-serif",
      fontSerif: "Source Serif 4, serif",
      fontMono: "JetBrains Mono, monospace",
      radius: "0.375rem",
      shadow2xs: "0px 4px 8px -1px hsl(0 0% 0% / 0.05)",
      shadowXs: "0px 4px 8px -1px hsl(0 0% 0% / 0.05)",
      shadowSm:
        "0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 1px 2px -2px hsl(0 0% 0% / 0.10)",
      shadow:
        "0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 1px 2px -2px hsl(0 0% 0% / 0.10)",
      shadowMd:
        "0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 2px 4px -2px hsl(0 0% 0% / 0.10)",
      shadowLg:
        "0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 4px 6px -2px hsl(0 0% 0% / 0.10)",
      shadowXl:
        "0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 8px 10px -2px hsl(0 0% 0% / 0.10)",
      shadow2xl: "0px 4px 8px -1px hsl(0 0% 0% / 0.25)",
    },
    themeInline: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      card: "var(--card)",
      cardForeground: "var(--card-foreground)",
      popover: "var(--popover)",
      popoverForeground: "var(--popover-foreground)",
      primary: "var(--primary)",
      primaryForeground: "var(--primary-foreground)",
      secondary: "var(--secondary)",
      secondaryForeground: "var(--secondary-foreground)",
      muted: "var(--muted)",
      mutedForeground: "var(--muted-foreground)",
      accent: "var(--accent)",
      accentForeground: "var(--accent-foreground)",
      destructive: "var(--destructive)",
      destructiveForeground: "var(--destructive-foreground)",
      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
      chart1: "var(--chart-1)",
      chart2: "var(--chart-2)",
      chart3: "var(--chart-3)",
      chart4: "var(--chart-4)",
      chart5: "var(--chart-5)",
      sidebar: "var(--sidebar)",
      sidebarForeground: "var(--sidebar-foreground)",
      sidebarPrimary: "var(--sidebar-primary)",
      sidebarPrimaryForeground: "var(--sidebar-primary-foreground)",
      sidebarAccent: "var(--sidebar-accent)",
      sidebarAccentForeground: "var(--sidebar-accent-foreground)",
      sidebarBorder: "var(--sidebar-border)",
      sidebarRing: "var(--sidebar-ring)",

      fontSans: "var(--font-sans)",
      fontMono: "var(--font-mono)",
      fontSerif: "var(--font-serif)",

      radiusSm: "calc(var(--radius) - 4px)",
      radiusMd: "calc(var(--radius) - 2px)",
      radiusLg: "var(--radius)",
      radiusXl: "calc(var(--radius) + 4px)",

      shadow2xs: "var(--shadow-2xs)",
      shadowXs: "var(--shadow-xs)",
      shadowSm: "var(--shadow-sm)",
      shadow: "var(--shadow)",
      shadowMd: "var(--shadow-md)",
      shadowLg: "var(--shadow-lg)",
      shadowXl: "var(--shadow-xl)",
      shadow2xl: "var(--shadow-2xl)",
    },
  },
  AmethysHaze: {
    name: "AmethysHaze",
    description: "A light, airy theme with a focus on clarity and simplicity.",
    projectTypes: ["SaaS", "Productivity", "Marketing", "Tech"],
    personality: ["cool", "elegant", "simple", "professional"],
    tags: ["violet", "dark blue", "black"],
    themeLight: {
      background: "oklch(0.9777 0.0041 301.4256)",
      foreground: "oklch(0.3651 0.0325 287.0807)",
      card: "oklch(1.0000 0 0)",
      cardForeground: "oklch(0.3651 0.0325 287.0807)",
      popover: "oklch(1.0000 0 0)",
      popoverForeground: "oklch(0.3651 0.0325 287.0807)",
      primary: "oklch(0.6104 0.0767 299.7335)",
      primaryForeground: "oklch(0.9777 0.0041 301.4256)",
      secondary: "oklch(0.8957 0.0265 300.2416)",
      secondaryForeground: "oklch(0.3651 0.0325 287.0807)",
      muted: "oklch(0.8906 0.0139 299.7754)",
      mutedForeground: "oklch(0.5288 0.0375 290.7895)",
      accent: "oklch(0.7889 0.0802 359.9375)",
      accentForeground: "oklch(0.3394 0.0441 1.7583)",
      destructive: "oklch(0.6332 0.1578 22.6734)",
      destructiveForeground: "oklch(0.9777 0.0041 301.4256)",
      border: "oklch(0.8447 0.0226 300.1421)",
      input: "oklch(0.9329 0.0124 301.2783)",
      ring: "oklch(0.6104 0.0767 299.7335)",
      chart1: "oklch(0.6104 0.0767 299.7335)",
      chart2: "oklch(0.7889 0.0802 359.9375)",
      chart3: "oklch(0.7321 0.0749 169.8670)",
      chart4: "oklch(0.8540 0.0882 76.8292)",
      chart5: "oklch(0.7857 0.0645 258.0839)",
      sidebar: "oklch(0.9554 0.0082 301.3541)",
      sidebarForeground: "oklch(0.3651 0.0325 287.0807)",
      sidebarPrimary: "oklch(0.6104 0.0767 299.7335)",
      sidebarPrimaryForeground: "oklch(0.9777 0.0041 301.4256)",
      sidebarAccent: "oklch(0.7889 0.0802 359.9375)",
      sidebarAccentForeground: "oklch(0.3394 0.0441 1.7583)",
      sidebarBorder: "oklch(0.8719 0.0198 302.1690)",
      sidebarRing: "oklch(0.6104 0.0767 299.7335)",
      fontSans: "Geist, sans-serif",
      fontSerif: "Lora, Georgia, serif",
      fontMono: "Fira Code, Courier New, monospace",
      radius: "0.5rem",
      shadow2xs: "1px 2px 5px 1px hsl(0 0% 0% / 0.03)",
      shadowXs: "1px 2px 5px 1px hsl(0 0% 0% / 0.03)",
      shadowSm:
        "1px 2px 5px 1px hsl(0 0% 0% / 0.06), 1px 1px 2px 0px hsl(0 0% 0% / 0.06)",
      shadow:
        "1px 2px 5px 1px hsl(0 0% 0% / 0.06), 1px 1px 2px 0px hsl(0 0% 0% / 0.06)",
      shadowMd:
        "1px 2px 5px 1px hsl(0 0% 0% / 0.06), 1px 2px 4px 0px hsl(0 0% 0% / 0.06)",
      shadowLg:
        "1px 2px 5px 1px hsl(0 0% 0% / 0.06), 1px 4px 6px 0px hsl(0 0% 0% / 0.06)",
      shadowXl:
        "1px 2px 5px 1px hsl(0 0% 0% / 0.06), 1px 8px 10px 0px hsl(0 0% 0% / 0.06)",
      shadow2xl: "1px 2px 5px 1px hsl(0 0% 0% / 0.15)",
      trackingNormal: "0em",
      spacing: "0.25rem",
    },
    themeDark: {
      background: "oklch(0.2166 0.0215 292.8474)",
      foreground: "oklch(0.9053 0.0245 293.5570)",
      card: "oklch(0.2544 0.0301 292.7315)",
      cardForeground: "oklch(0.9053 0.0245 293.5570)",
      popover: "oklch(0.2544 0.0301 292.7315)",
      popoverForeground: "oklch(0.9053 0.0245 293.5570)",
      primary: "oklch(0.7058 0.0777 302.0489)",
      primaryForeground: "oklch(0.2166 0.0215 292.8474)",
      secondary: "oklch(0.4604 0.0472 295.5578)",
      secondaryForeground: "oklch(0.9053 0.0245 293.5570)",
      muted: "oklch(0.2560 0.0320 294.8380)",
      mutedForeground: "oklch(0.6974 0.0282 300.0614)",
      accent: "oklch(0.3181 0.0321 308.6149)",
      accentForeground: "oklch(0.8391 0.0692 2.6681)",
      destructive: "oklch(0.6875 0.1420 21.4566)",
      destructiveForeground: "oklch(0.2166 0.0215 292.8474)",
      border: "oklch(0.3063 0.0359 293.3367)",
      input: "oklch(0.2847 0.0346 291.2726)",
      ring: "oklch(0.7058 0.0777 302.0489)",
      chart1: "oklch(0.7058 0.0777 302.0489)",
      chart2: "oklch(0.8391 0.0692 2.6681)",
      chart3: "oklch(0.7321 0.0749 169.8670)",
      chart4: "oklch(0.8540 0.0882 76.8292)",
      chart5: "oklch(0.7857 0.0645 258.0839)",
      sidebar: "oklch(0.1985 0.0200 293.6639)",
      sidebarForeground: "oklch(0.9053 0.0245 293.5570)",
      sidebarPrimary: "oklch(0.7058 0.0777 302.0489)",
      sidebarPrimaryForeground: "oklch(0.2166 0.0215 292.8474)",
      sidebarAccent: "oklch(0.3181 0.0321 308.6149)",
      sidebarAccentForeground: "oklch(0.8391 0.0692 2.6681)",
      sidebarBorder: "oklch(0.2847 0.0346 291.2726)",
      sidebarRing: "oklch(0.7058 0.0777 302.0489)",
      fontSans: "Geist, sans-serif",
      fontSerif: "Lora, Georgia, serif",
      fontMono: "Fira Code, Courier New, monospace",
      radius: "0.5rem",
      shadow2xs: "1px 2px 5px 1px hsl(0 0% 0% / 0.03)",
      shadowXs: "1px 2px 5px 1px hsl(0 0% 0% / 0.03)",
      shadowSm:
        "1px 2px 5px 1px hsl(0 0% 0% / 0.06), 1px 1px 2px 0px hsl(0 0% 0% / 0.06)",
      shadow:
        "1px 2px 5px 1px hsl(0 0% 0% / 0.06), 1px 1px 2px 0px hsl(0 0% 0% / 0.06)",
      shadowMd:
        "1px 2px 5px 1px hsl(0 0% 0% / 0.06), 1px 2px 4px 0px hsl(0 0% 0% / 0.06)",
      shadowLg:
        "1px 2px 5px 1px hsl(0 0% 0% / 0.06), 1px 4px 6px 0px hsl(0 0% 0% / 0.06)",
      shadowXl:
        "1px 2px 5px 1px hsl(0 0% 0% / 0.06), 1px 8px 10px 0px hsl(0 0% 0% / 0.06)",
      shadow2xl: "1px 2px 5px 1px hsl(0 0% 0% / 0.15)",
      trackingNormal: "0em",
      spacing: "0.25rem",
    },
    themeInline: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      card: "var(--card)",
      cardForeground: "var(--card-foreground)",
      popover: "var(--popover)",
      popoverForeground: "var(--popover-foreground)",
      primary: "var(--primary)",
      primaryForeground: "var(--primary-foreground)",
      secondary: "var(--secondary)",
      secondaryForeground: "var(--secondary-foreground)",
      muted: "var(--muted)",
      mutedForeground: "var(--muted-foreground)",
      accent: "var(--accent)",
      accentForeground: "var(--accent-foreground)",
      destructive: "var(--destructive)",
      destructiveForeground: "var(--destructive-foreground)",
      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
      chart1: "var(--chart-1)",
      chart2: "var(--chart-2)",
      chart3: "var(--chart-3)",
      chart4: "var(--chart-4)",
      chart5: "var(--chart-5)",
      sidebar: "var(--sidebar)",
      sidebarForeground: "var(--sidebar-foreground)",
      sidebarPrimary: "var(--sidebar-primary)",
      sidebarPrimaryForeground: "var(--sidebar-primary-foreground)",
      sidebarAccent: "var(--sidebar-accent)",
      sidebarAccentForeground: "var(--sidebar-accent-foreground)",
      sidebarBorder: "var(--sidebar-border)",
      sidebarRing: "var(--sidebar-ring)",

      fontSans: "var(--font-sans)",
      fontMono: "var(--font-mono)",
      fontSerif: "var(--font-serif)",

      radiusSm: "calc(var(--radius) - 4px)",
      radiusMd: "calc(var(--radius) - 2px)",
      radiusLg: "var(--radius)",
      radiusXl: "calc(var(--radius) + 4px)",

      shadow2xs: "var(--shadow-2xs)",
      shadowXs: "var(--shadow-xs)",
      shadowSm: "var(--shadow-sm)",
      shadow: "var(--shadow)",
      shadowMd: "var(--shadow-md)",
      shadowLg: "var(--shadow-lg)",
      shadowXl: "var(--shadow-xl)",
      shadow2xl: "var(--shadow-2xl)",
    },
  },
  BoldTech: {
    name: "BoldTech",
    description: "A bold, techy theme with a focus on clarity and simplicity.",
    projectTypes: ["SaaS", "Productivity", "Industry", "Marketing"],
    personality: ["Bold", "Techy", "Clear", "two tone"],
    tags: ["purple", "lavender", "violet", "artistic"],
    themeLight: {
      background: "oklch(1.0000 0 0)",
      foreground: "oklch(0.3588 0.1354 278.6973)",
      card: "oklch(1.0000 0 0)",
      cardForeground: "oklch(0.3588 0.1354 278.6973)",
      popover: "oklch(1.0000 0 0)",
      popoverForeground: "oklch(0.3588 0.1354 278.6973)",
      primary: "oklch(0.6056 0.2189 292.7172)",
      primaryForeground: "oklch(1.0000 0 0)",
      secondary: "oklch(0.9618 0.0202 295.1913)",
      secondaryForeground: "oklch(0.4568 0.2146 277.0229)",
      muted: "oklch(0.9691 0.0161 293.7558)",
      mutedForeground: "oklch(0.5413 0.2466 293.0090)",
      accent: "oklch(0.9319 0.0316 255.5855)",
      accentForeground: "oklch(0.4244 0.1809 265.6377)",
      destructive: "oklch(0.6368 0.2078 25.3313)",
      destructiveForeground: "oklch(1.0000 0 0)",
      border: "oklch(0.9299 0.0334 272.7879)",
      input: "oklch(0.9299 0.0334 272.7879)",
      ring: "oklch(0.6056 0.2189 292.7172)",
      chart1: "oklch(0.6056 0.2189 292.7172)",
      chart2: "oklch(0.5413 0.2466 293.0090)",
      chart3: "oklch(0.4907 0.2412 292.5809)",
      chart4: "oklch(0.4320 0.2106 292.7591)",
      chart5: "oklch(0.3796 0.1783 293.7446)",
      sidebar: "oklch(0.9691 0.0161 293.7558)",
      sidebarForeground: "oklch(0.3588 0.1354 278.6973)",
      sidebarPrimary: "oklch(0.6056 0.2189 292.7172)",
      sidebarPrimaryForeground: "oklch(1.0000 0 0)",
      sidebarAccent: "oklch(0.9319 0.0316 255.5855)",
      sidebarAccentForeground: "oklch(0.4244 0.1809 265.6377)",
      sidebarBorder: "oklch(0.9299 0.0334 272.7879)",
      sidebarRing: "oklch(0.6056 0.2189 292.7172)",
      fontSans: "Roboto, sans-serif",
      fontSerif: "Playfair Display, serif",
      fontMono: "Fira Code, monospace",
      radius: "0.625rem",
      shadow2xs: "2px 2px 4px 0px hsl(255 86% 66% / 0.10)",
      shadowXs: "2px 2px 4px 0px hsl(255 86% 66% / 0.10)",
      shadowSm:
        "2px 2px 4px 0px hsl(255 86% 66% / 0.20), 2px 1px 2px -1px hsl(255 86% 66% / 0.20)",
      shadow:
        "2px 2px 4px 0px hsl(255 86% 66% / 0.20), 2px 1px 2px -1px hsl(255 86% 66% / 0.20)",
      shadowMd:
        "2px 2px 4px 0px hsl(255 86% 66% / 0.20), 2px 2px 4px -1px hsl(255 86% 66% / 0.20)",
      shadowLg:
        "2px 2px 4px 0px hsl(255 86% 66% / 0.20), 2px 4px 6px -1px hsl(255 86% 66% / 0.20)",
      shadowXl:
        "2px 2px 4px 0px hsl(255 86% 66% / 0.20), 2px 8px 10px -1px hsl(255 86% 66% / 0.20)",
      shadow2xl: "2px 2px 4px 0px hsl(255 86% 66% / 0.50)",
      trackingNormal: "0em",
      spacing: "0.25rem",
    },
    themeDark: {
      background: "oklch(0.2077 0.0398 265.7549)",
      foreground: "oklch(0.9299 0.0334 272.7879)",
      card: "oklch(0.2573 0.0861 281.2883)",
      cardForeground: "oklch(0.9299 0.0334 272.7879)",
      popover: "oklch(0.2573 0.0861 281.2883)",
      popoverForeground: "oklch(0.9299 0.0334 272.7879)",
      primary: "oklch(0.6056 0.2189 292.7172)",
      primaryForeground: "oklch(1.0000 0 0)",
      secondary: "oklch(0.2573 0.0861 281.2883)",
      secondaryForeground: "oklch(0.9299 0.0334 272.7879)",
      muted: "oklch(0.2573 0.0861 281.2883)",
      mutedForeground: "oklch(0.8112 0.1013 293.5712)",
      accent: "oklch(0.4568 0.2146 277.0229)",
      accentForeground: "oklch(0.9299 0.0334 272.7879)",
      destructive: "oklch(0.6368 0.2078 25.3313)",
      destructiveForeground: "oklch(1.0000 0 0)",
      border: "oklch(0.2827 0.1351 291.0894)",
      input: "oklch(0.2827 0.1351 291.0894)",
      ring: "oklch(0.6056 0.2189 292.7172)",
      chart1: "oklch(0.7090 0.1592 293.5412)",
      chart2: "oklch(0.6056 0.2189 292.7172)",
      chart3: "oklch(0.5413 0.2466 293.0090)",
      chart4: "oklch(0.4907 0.2412 292.5809)",
      chart5: "oklch(0.4320 0.2106 292.7591)",
      sidebar: "oklch(0.2077 0.0398 265.7549)",
      sidebarForeground: "oklch(0.9299 0.0334 272.7879)",
      sidebarPrimary: "oklch(0.6056 0.2189 292.7172)",
      sidebarPrimaryForeground: "oklch(1.0000 0 0)",
      sidebarAccent: "oklch(0.4568 0.2146 277.0229)",
      sidebarAccentForeground: "oklch(0.9299 0.0334 272.7879)",
      sidebarBorder: "oklch(0.2827 0.1351 291.0894)",
      sidebarRing: "oklch(0.6056 0.2189 292.7172)",
      fontSans: "Roboto, sans-serif",
      fontSerif: "Playfair Display, serif",
      fontMono: "Fira Code, monospace",
      radius: "0.625rem",
      shadow2xs: "2px 2px 4px 0px hsl(255 86% 66% / 0.10)",
      shadowXs: "2px 2px 4px 0px hsl(255 86% 66% / 0.10)",
      shadowSm:
        "2px 2px 4px 0px hsl(255 86% 66% / 0.20), 2px 1px 2px -1px hsl(255 86% 66% / 0.20)",
      shadow:
        "2px 2px 4px 0px hsl(255 86% 66% / 0.20), 2px 1px 2px -1px hsl(255 86% 66% / 0.20)",
      shadowMd:
        "2px 2px 4px 0px hsl(255 86% 66% / 0.20), 2px 2px 4px -1px hsl(255 86% 66% / 0.20)",
      shadowLg:
        "2px 2px 4px 0px hsl(255 86% 66% / 0.20), 2px 4px 6px -1px hsl(255 86% 66% / 0.20)",
      shadowXl:
        "2px 2px 4px 0px hsl(255 86% 66% / 0.20), 2px 8px 10px -1px hsl(255 86% 66% / 0.20)",
      shadow2xl: "2px 2px 4px 0px hsl(255 86% 66% / 0.50)",
    },

    themeInline: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      card: "var(--card)",
      cardForeground: "var(--card-foreground)",
      popover: "var(--popover)",
      popoverForeground: "var(--popover-foreground)",
      primary: "var(--primary)",
      primaryForeground: "var(--primary-foreground)",
      secondary: "var(--secondary)",
      secondaryForeground: "var(--secondary-foreground)",
      muted: "var(--muted)",
      mutedForeground: "var(--muted-foreground)",
      accent: "var(--accent)",
      accentForeground: "var(--accent-foreground)",
      destructive: "var(--destructive)",
      destructiveForeground: "var(--destructive-foreground)",
      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
      chart1: "var(--chart-1)",
      chart2: "var(--chart-2)",
      chart3: "var(--chart-3)",
      chart4: "var(--chart-4)",
      chart5: "var(--chart-5)",
      sidebar: "var(--sidebar)",
      sidebarForeground: "var(--sidebar-foreground)",
      sidebarPrimary: "var(--sidebar-primary)",
      sidebarPrimaryForeground: "var(--sidebar-primary-foreground)",
      sidebarAccent: "var(--sidebar-accent)",
      sidebarAccentForeground: "var(--sidebar-accent-foreground)",
      sidebarBorder: "var(--sidebar-border)",
      sidebarRing: "var(--sidebar-ring)",

      fontSans: "var(--font-sans)",
      fontMono: "var(--font-mono)",
      fontSerif: "var(--font-serif)",

      radiusSm: "calc(var(--radius) - 4px)",
      radiusMd: "calc(var(--radius) - 2px)",
      radiusLg: "var(--radius)",
      radiusXl: "calc(var(--radius) + 4px)",

      shadow2xs: "var(--shadow-2xs)",
      shadowXs: "var(--shadow-xs)",
      shadowSm: "var(--shadow-sm)",
      shadow: "var(--shadow)",
      shadowMd: "var(--shadow-md)",
      shadowLg: "var(--shadow-lg)",
      shadowXl: "var(--shadow-xl)",
      shadow2xl: "var(--shadow-2xl)",
    },
  },
  BubbleGum: {
    name: "BubbleGum",
    description: "A light, colorful theme with a focus on fun and creativity.",
    projectTypes: [
      "SaaS",
      "Marketing",
      "Education",
      "Entertainment",
      "Gaming",
      "E-commerce",
      "Health and Fitness",
      "Travel",
      "Food and Drink",
      "Fashion",
      "Art and Design",
      "Music and Entertainment",
      "News and Media",
      "Real Estate",
      "Education",
      "Media and Entertainment",
      "Nonprofit",
      "Travel and Tourism",
    ],
    personality: ["fun", "creative", "colorful", "playful"],
    tags: ["pink", "purple", "blue", "green", "yellow"],
    themeLight: {
      background: "oklch(0.9399 0.0203 345.6985)",
      foreground: "oklch(0.4712 0 0)",
      card: "oklch(0.9498 0.0500 86.8891)",
      cardForeground: "oklch(0.4712 0 0)",
      popover: "oklch(1.0000 0 0)",
      popoverForeground: "oklch(0.4712 0 0)",
      primary: "oklch(0.6209 0.1801 348.1385)",
      primaryForeground: "oklch(1.0000 0 0)",
      secondary: "oklch(0.8095 0.0694 198.1863)",
      secondaryForeground: "oklch(0.3211 0 0)",
      muted: "oklch(0.8800 0.0504 212.0952)",
      mutedForeground: "oklch(0.5795 0 0)",
      accent: "oklch(0.9195 0.0801 87.6670)",
      accentForeground: "oklch(0.3211 0 0)",
      destructive: "oklch(0.7091 0.1697 21.9551)",
      destructiveForeground: "oklch(1.0000 0 0)",
      border: "oklch(0.6209 0.1801 348.1385)",
      input: "oklch(0.9189 0 0)",
      ring: "oklch(0.7002 0.1597 350.7532)",
      chart1: "oklch(0.7002 0.1597 350.7532)",
      chart2: "oklch(0.8189 0.0799 212.0892)",
      chart3: "oklch(0.9195 0.0801 87.6670)",
      chart4: "oklch(0.7998 0.1110 348.1791)",
      chart5: "oklch(0.6197 0.1899 353.9091)",
      sidebar: "oklch(0.9140 0.0424 343.0913)",
      sidebarForeground: "oklch(0.3211 0 0)",
      sidebarPrimary: "oklch(0.6559 0.2118 354.3084)",
      sidebarPrimaryForeground: "oklch(1.0000 0 0)",
      sidebarAccent: "oklch(0.8228 0.1095 346.0184)",
      sidebarAccentForeground: "oklch(0.3211 0 0)",
      sidebarBorder: "oklch(0.9464 0.0327 307.1745)",
      sidebarRing: "oklch(0.6559 0.2118 354.3084)",
      fontSans: "Poppins, sans-serif",
      fontSerif: "Lora, serif",
      fontMono: "Fira Code, monospace",
      radius: "0.4rem",
      shadow2xs: "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 0.50)",
      shadowXs: "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 0.50)",
      shadowSm:
        "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 1px 2px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)",
      shadow:
        "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 1px 2px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)",
      shadowMd:
        "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 2px 4px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)",
      shadowLg:
        "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 4px 6px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)",
      shadowXl:
        "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 8px 10px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)",
      shadow2xl: "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 2.50)",
      spacing: "0.25rem",
    },

    themeDark: {
      background: "oklch(0.2497 0.0305 234.1628)",
      foreground: "oklch(0.9306 0.0197 349.0785)",
      card: "oklch(0.2902 0.0299 233.5352)",
      cardForeground: "oklch(0.9306 0.0197 349.0785)",
      popover: "oklch(0.2902 0.0299 233.5352)",
      popoverForeground: "oklch(0.9306 0.0197 349.0785)",
      primary: "oklch(0.9195 0.0801 87.6670)",
      primaryForeground: "oklch(0.2497 0.0305 234.1628)",
      secondary: "oklch(0.7794 0.0803 4.1330)",
      secondaryForeground: "oklch(0.2497 0.0305 234.1628)",
      muted: "oklch(0.2713 0.0086 255.5780)",
      mutedForeground: "oklch(0.7794 0.0803 4.1330)",
      accent: "oklch(0.6699 0.0988 356.9762)",
      accentForeground: "oklch(0.9306 0.0197 349.0785)",
      destructive: "oklch(0.6702 0.1806 350.3599)",
      destructiveForeground: "oklch(0.2497 0.0305 234.1628)",
      border: "oklch(0.3907 0.0399 242.2181)",
      input: "oklch(0.3093 0.0305 232.0027)",
      ring: "oklch(0.6998 0.0896 201.8672)",
      chart1: "oklch(0.6998 0.0896 201.8672)",
      chart2: "oklch(0.7794 0.0803 4.1330)",
      chart3: "oklch(0.6699 0.0988 356.9762)",
      chart4: "oklch(0.4408 0.0702 217.0848)",
      chart5: "oklch(0.2713 0.0086 255.5780)",
      sidebar: "oklch(0.2303 0.0270 235.9743)",
      sidebarForeground: "oklch(0.9670 0.0029 264.5419)",
      sidebarPrimary: "oklch(0.6559 0.2118 354.3084)",
      sidebarPrimaryForeground: "oklch(1.0000 0 0)",
      sidebarAccent: "oklch(0.8228 0.1095 346.0184)",
      sidebarAccentForeground: "oklch(0.2781 0.0296 256.8480)",
      sidebarBorder: "oklch(0.3729 0.0306 259.7328)",
      sidebarRing: "oklch(0.6559 0.2118 354.3084)",
      fontSans: "Poppins, sans-serif",
      fontSerif: "Lora, serif",
      fontMono: "Fira Code, monospace",
      radius: "0.4rem",
      shadow2xs: "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 0.50)",
      shadowXs: "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 0.50)",
      shadowSm:
        "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 1px 2px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)",
      shadow:
        "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 1px 2px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)",
      shadowMd:
        "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 2px 4px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)",
      shadowLg:
        "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 4px 6px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)",
      shadowXl:
        "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 8px 10px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)",
      shadow2xl: "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 2.50)",
    },
    themeInline: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      card: "var(--card)",
      cardForeground: "var(--card-foreground)",
      popover: "var(--popover)",
      popoverForeground: "var(--popover-foreground)",
      primary: "var(--primary)",
      primaryForeground: "var(--primary-foreground)",
      secondary: "var(--secondary)",
      secondaryForeground: "var(--secondary-foreground)",
      muted: "var(--muted)",
      mutedForeground: "var(--muted-foreground)",
      accent: "var(--accent)",
      accentForeground: "var(--accent-foreground)",
      destructive: "var(--destructive)",
      destructiveForeground: "var(--destructive-foreground)",
      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
      chart1: "var(--chart-1)",
      chart2: "var(--chart-2)",
      chart3: "var(--chart-3)",
      chart4: "var(--chart-4)",
      chart5: "var(--chart-5)",
      sidebar: "var(--sidebar)",
      sidebarForeground: "var(--sidebar-foreground)",
      sidebarPrimary: "var(--sidebar-primary)",
      sidebarPrimaryForeground: "var(--sidebar-primary-foreground)",
      sidebarAccent: "var(--sidebar-accent)",
      sidebarAccentForeground: "var(--sidebar-accent-foreground)",
      sidebarBorder: "var(--sidebar-border)",
      sidebarRing: "var(--sidebar-ring)",

      fontSans: "var(--font-sans)",
      fontMono: "var(--font-mono)",
      fontSerif: "var(--font-serif)",

      radiusSm: "calc(var(--radius) - 4px)",
      radiusMd: "calc(var(--radius) - 2px)",
      radiusLg: "var(--radius)",
      radiusXl: "calc(var(--radius) + 4px)",

      shadow2xs: "var(--shadow-2xs)",
      shadowXs: "var(--shadow-xs)",
      shadowSm: "var(--shadow-sm)",
      shadow: "var(--shadow)",
      shadowMd: "var(--shadow-md)",
      shadowLg: "var(--shadow-lg)",
      shadowXl: "var(--shadow-xl)",
      shadow2xl: "var(--shadow-2xl)",
    },
  },
  ModernMinimal: {
    name: "ModernMinimal",
    description:
      "A modern, minimal theme with a focus on simplicity and elegance.",
    projectTypes: [
      "landing",
      "saas",
      "marketing",
      "portfolio",
      "blog",
      "agency",
      "dashboard",
      "productivity",
      "social",
      "ecommerce",
    ],
    personality: ["minimal", "elegant", "simple", "modern"],
    tags: [
      "modern",
      "minimal",
      "elegant",
      "simple",
      "black",
      "white",
      "minimalist",
      "clean",
    ],
    themeLight: {
      background: "oklch(1.0000 0 0)",
      foreground: "oklch(0.3211 0 0)",
      card: "oklch(1.0000 0 0)",
      cardForeground: "oklch(0.3211 0 0)",
      popover: "oklch(1.0000 0 0)",
      popoverForeground: "oklch(0.3211 0 0)",
      primary: "oklch(0.6231 0.1880 259.8145)",
      primaryForeground: "oklch(1.0000 0 0)",
      secondary: "oklch(0.9670 0.0029 264.5419)",
      secondaryForeground: "oklch(0.4461 0.0263 256.8018)",
      muted: "oklch(0.9846 0.0017 247.8389)",
      mutedForeground: "oklch(0.5510 0.0234 264.3637)",
      accent: "oklch(0.9514 0.0250 236.8242)",
      accentForeground: "oklch(0.3791 0.1378 265.5222)",
      destructive: "oklch(0.6368 0.2078 25.3313)",
      destructiveForeground: "oklch(1.0000 0 0)",
      border: "oklch(0.9276 0.0058 264.5313)",
      input: "oklch(0.9276 0.0058 264.5313)",
      ring: "oklch(0.6231 0.1880 259.8145)",
      chart1: "oklch(0.6231 0.1880 259.8145)",
      chart2: "oklch(0.5461 0.2152 262.8809)",
      chart3: "oklch(0.4882 0.2172 264.3763)",
      chart4: "oklch(0.4244 0.1809 265.6377)",
      chart5: "oklch(0.3791 0.1378 265.5222)",
      sidebar: "oklch(0.9846 0.0017 247.8389)",
      sidebarForeground: "oklch(0.3211 0 0)",
      sidebarPrimary: "oklch(0.6231 0.1880 259.8145)",
      sidebarPrimaryForeground: "oklch(1.0000 0 0)",
      sidebarAccent: "oklch(0.9514 0.0250 236.8242)",
      sidebarAccentForeground: "oklch(0.3791 0.1378 265.5222)",
      sidebarBorder: "oklch(0.9276 0.0058 264.5313)",
      sidebarRing: "oklch(0.6231 0.1880 259.8145)",
      fontSans: "Inter, sans-serif",
      fontSerif: "Source Serif 4, serif",
      fontMono: "JetBrains Mono, monospace",
      radius: "0.375rem",
      shadow2xs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowXs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowSm:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadow:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadowMd:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10)",
      shadowLg:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10)",
      shadowXl:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10)",
      shadow2xl: "0 1px 3px 0px hsl(0 0% 0% / 0.25)",
    },
    themeDark: {
      background: "oklch(0.2046 0 0)",
      foreground: "oklch(0.9219 0 0)",
      card: "oklch(0.2686 0 0)",
      cardForeground: "oklch(0.9219 0 0)",
      popover: "oklch(0.2686 0 0)",
      popoverForeground: "oklch(0.9219 0 0)",
      primary: "oklch(0.6231 0.1880 259.8145)",
      primaryForeground: "oklch(1.0000 0 0)",
      secondary: "oklch(0.2686 0 0)",
      secondaryForeground: "oklch(0.9219 0 0)",
      muted: "oklch(0.2686 0 0)",
      mutedForeground: "oklch(0.7155 0 0)",
      accent: "oklch(0.3791 0.1378 265.5222)",
      accentForeground: "oklch(0.8823 0.0571 254.1284)",
      destructive: "oklch(0.6368 0.2078 25.3313)",
      destructiveForeground: "oklch(1.0000 0 0)",
      border: "oklch(0.3715 0 0)",
      input: "oklch(0.3715 0 0)",
      ring: "oklch(0.6231 0.1880 259.8145)",
      chart1: "oklch(0.7137 0.1434 254.6240)",
      chart2: "oklch(0.6231 0.1880 259.8145)",
      chart3: "oklch(0.5461 0.2152 262.8809)",
      chart4: "oklch(0.4882 0.2172 264.3763)",
      chart5: "oklch(0.4244 0.1809 265.6377)",
      sidebar: "oklch(0.2046 0 0)",
      sidebarForeground: "oklch(0.9219 0 0)",
      sidebarPrimary: "oklch(0.6231 0.1880 259.8145)",
      sidebarPrimaryForeground: "oklch(1.0000 0 0)",
      sidebarAccent: "oklch(0.3791 0.1378 265.5222)",
      sidebarAccentForeground: "oklch(0.8823 0.0571 254.1284)",
      sidebarBorder: "oklch(0.3715 0 0)",
      sidebarRing: "oklch(0.6231 0.1880 259.8145)",
      fontSans: "Inter, sans-serif",
      fontSerif: "Source Serif 4, serif",
      fontMono: "JetBrains Mono, monospace",
      radius: "0.375rem",
      shadow2xs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowXs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowSm:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadow:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadowMd:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10)",
      shadowLg:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10)",
      shadowXl:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10)",
      shadow2xl: "0 1px 3px 0px hsl(0 0% 0% / 0.25)",
    },
    themeInline: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      card: "var(--card)",
      cardForeground: "var(--card-foreground)",
      popover: "var(--popover)",
      popoverForeground: "var(--popover-foreground)",
      primary: "var(--primary)",
      primaryForeground: "var(--primary-foreground)",
      secondary: "var(--secondary)",
      secondaryForeground: "var(--secondary-foreground)",
      muted: "var(--muted)",
      mutedForeground: "var(--muted-foreground)",
      accent: "var(--accent)",
      accentForeground: "var(--accent-foreground)",
      destructive: "var(--destructive)",
      destructiveForeground: "var(--destructive-foreground)",
      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
      chart1: "var(--chart-1)",
      chart2: "var(--chart-2)",
      chart3: "var(--chart-3)",
      chart4: "var(--chart-4)",
      chart5: "var(--chart-5)",
      sidebar: "var(--sidebar)",
      sidebarForeground: "var(--sidebar-foreground)",
      sidebarPrimary: "var(--sidebar-primary)",
      sidebarPrimaryForeground: "var(--sidebar-primary-foreground)",
      sidebarAccent: "var(--sidebar-accent)",
      sidebarAccentForeground: "var(--sidebar-accent-foreground)",
      sidebarBorder: "var(--sidebar-border)",
      sidebarRing: "var(--sidebar-ring)",
      fontSans: "Inter, sans-serif",
      fontSerif: "Source Serif 4, serif",
      fontMono: "JetBrains Mono, monospace",
      radius: "0.375rem",
      shadow2xs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowXs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowSm:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadow:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadowMd:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10)",
      shadowLg:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10)",
      shadowXl:
        "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10)",
      shadow2xl: "0 1px 3px 0px hsl(0 0% 0% / 0.25)",
    },
  },
  Caffeine: {
    name: "Caffeine",
    description: "A modern, minimal theme with a focus on simplicity and elegance.",
    projectTypes: ["business", "portfolio"],
    personality: ["minimal", "simple", "modern"],
    tags: ["simple", "brown", "white", "minimalist", "clean"],
    themeLight: {
      background: "oklch(0.9821 0 0)",
      foreground: "oklch(0.2435 0 0)",
      card: "oklch(0.9911 0 0)",
      cardForeground: "oklch(0.2435 0 0)",
      popover: "oklch(0.9911 0 0)",
      popoverForeground: "oklch(0.2435 0 0)",
      primary: "oklch(0.4341 0.0392 41.9938)",
      primaryForeground: "oklch(1.0000 0 0)",
      secondary: "oklch(0.9200 0.0651 74.3695)",
      secondaryForeground: "oklch(0.3499 0.0685 40.8288)",
      muted: "oklch(0.9521 0 0)",
      mutedForeground: "oklch(0.5032 0 0)",
      accent: "oklch(0.9310 0 0)",
      accentForeground: "oklch(0.2435 0 0)",
      destructive: "oklch(0.6271 0.1936 33.3390)",
      destructiveForeground: "oklch(1.0000 0 0)",
      border: "oklch(0.8822 0 0)",
      input: "oklch(0.8822 0 0)",
      ring: "oklch(0.4341 0.0392 41.9938)",
      chart1: "oklch(0.4341 0.0392 41.9938)",
      chart2: "oklch(0.9200 0.0651 74.3695)",
      chart3: "oklch(0.9310 0 0)",
      chart4: "oklch(0.9367 0.0523 75.5009)",
      chart5: "oklch(0.4338 0.0437 41.6746)",
      sidebar: "oklch(0.9881 0 0)",
      sidebarForeground: "oklch(0.2645 0 0)",
      sidebarPrimary: "oklch(0.3250 0 0)",
      sidebarPrimaryForeground: "oklch(0.9881 0 0)",
      sidebarAccent: "oklch(0.9761 0 0)",
      sidebarAccentForeground: "oklch(0.3250 0 0)",
      sidebarBorder: "oklch(0.9401 0 0)",
      sidebarRing: "oklch(0.7731 0 0)",
      fontSans: "Inter, sans-serif",
      fontSerif: "Source Serif 4, serif",
      fontMono: "JetBrains Mono, monospace",
      radius: "0.5rem",
      shadow2xs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowXs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowSm: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadow: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadowMd: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10)",
      shadowLg: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10)",
      shadowXl: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10)",
      shadow2xl: "0 1px 3px 0px hsl(0 0% 0% / 0.25)",
      trackingNormal: "0em",
      spacing: "0.25rem",
    },
    themeDark: {
      background: "oklch(0.1776 0 0)",
      foreground: "oklch(0.9491 0 0)",
      card: "oklch(0.2134 0 0)",
      cardForeground: "oklch(0.9491 0 0)",
      popover: "oklch(0.2134 0 0)",
      popoverForeground: "oklch(0.9491 0 0)",
      primary: "oklch(0.9247 0.0524 66.1732)",
      primaryForeground: "oklch(0.2029 0.0240 200.1962)",
      secondary: "oklch(0.3163 0.0190 63.6992)",
      secondaryForeground: "oklch(0.9247 0.0524 66.1732)",
      muted: "oklch(0.2520 0 0)",
      mutedForeground: "oklch(0.7699 0 0)",
      accent: "oklch(0.2850 0 0)",
      accentForeground: "oklch(0.9491 0 0)",
      destructive: "oklch(0.6271 0.1936 33.3390)",
      destructiveForeground: "oklch(1.0000 0 0)",
      border: "oklch(0.2351 0.0115 91.7467)",
      input: "oklch(0.4017 0 0)",
      ring: "oklch(0.9247 0.0524 66.1732)",
      chart1: "oklch(0.9247 0.0524 66.1732)",
      chart2: "oklch(0.3163 0.0190 63.6992)",
      chart3: "oklch(0.2850 0 0)",
      chart4: "oklch(0.3481 0.0219 67.0001)",
      chart5: "oklch(0.9245 0.0533 67.0855)",
      sidebar: "oklch(0.9881 0 0)",
      sidebarForeground: "oklch(0.2645 0 0)",
      sidebarPrimary: "oklch(0.3250 0 0)",
      sidebarPrimaryForeground: "oklch(0.9881 0 0)",
      sidebarAccent: "oklch(0.9761 0 0)",
      sidebarAccentForeground: "oklch(0.3250 0 0)",
      sidebarBorder: "oklch(0.9401 0 0)",
      sidebarRing: "oklch(0.7731 0 0)",
      fontSans: "Inter, sans-serif",
      fontSerif: "Source Serif 4, serif",
      fontMono: "JetBrains Mono, monospace",
      radius: "0.5rem",
      shadow2xs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowXs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowSm: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadow: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadowMd: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10)",
      shadowLg: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10)",
      shadowXl: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10)",
      shadow2xl: "0 1px 3px 0px hsl(0 0% 0% / 0.25)",
    },
    themeInline: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      card: "var(--card)",
      cardForeground: "var(--card-foreground)",
      popover: "var(--popover)",
      popoverForeground: "var(--popover-foreground)",
      primary: "var(--primary)",
      primaryForeground: "var(--primary-foreground)",
      secondary: "var(--secondary)",
      secondaryForeground: "var(--secondary-foreground)",
      muted: "var(--muted)",
      mutedForeground: "var(--muted-foreground)",
      accent: "var(--accent)",
      accentForeground: "var(--accent-foreground)",
      destructive: "var(--destructive)",
      destructiveForeground: "var(--destructive-foreground)",
      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
      chart1: "var(--chart-1)",
      chart2: "var(--chart-2)",
      chart3: "var(--chart-3)",
      chart4: "var(--chart-4)",
      chart5: "var(--chart-5)",
      sidebar: "var(--sidebar)",
      sidebarForeground: "var(--sidebar-foreground)",
      sidebarPrimary: "var(--sidebar-primary)",
      sidebarPrimaryForeground: "var(--sidebar-primary-foreground)",
      sidebarAccent: "var(--sidebar-accent)",
      sidebarAccentForeground: "var(--sidebar-accent-foreground)",
      sidebarBorder: "var(--sidebar-border)",
      sidebarRing: "var(--sidebar-ring)",
      fontSans: "Inter, sans-serif",
      fontSerif: "Source Serif 4, serif",
      fontMono: "JetBrains Mono, monospace",
      radius: "0.5rem",
      shadow2xs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowXs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowSm: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadow: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadowMd: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10)",
      shadowLg: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10)",
      shadowXl: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10)",
      shadow2xl: "0 1px 3px 0px hsl(0 0% 0% / 0.25)",
    },
  },

  Candyland: {
    name: "Candyland",
    description: "A candy theme. Sweet and colorful. Pink heavy.",
    projectTypes: [ "portfolio", "blog", "marketing", "landing", "saas", "dashboard", "productivity", "social", "ecommerce"],
    personality: ["candy", "sweet", "colorful", "pink", "fun"],
    tags: ["candy", "sweet", "colorful", "pink", "fun", "cute", "childish", "retro"],
    themeLight: {
      background: "oklch(0.9809 0.0025 228.7836)",
      foreground: "oklch(0.3211 0 0)",
      card: "oklch(1.0000 0 0)",
      cardForeground: "oklch(0.3211 0 0)",
      popover: "oklch(1.0000 0 0)",
      popoverForeground: "oklch(0.3211 0 0)",
      primary: "oklch(0.8677 0.0735 7.0855)",
      primaryForeground: "oklch(0 0 0)",
      secondary: "oklch(0.8148 0.0819 225.7537)",
      secondaryForeground: "oklch(0 0 0)",
      muted: "oklch(0.8828 0.0285 98.1033)",
      mutedForeground: "oklch(0.5382 0 0)",
      accent: "oklch(0.9680 0.2110 109.7692)",
      accentForeground: "oklch(0 0 0)",
      destructive: "oklch(0.6368 0.2078 25.3313)",
      destructiveForeground: "oklch(1.0000 0 0)",
      border: "oklch(0.8699 0 0)",
      input: "oklch(0.8699 0 0)",
      ring: "oklch(0.8677 0.0735 7.0855)",
      chart1: "oklch(0.8677 0.0735 7.0855)",
      chart2: "oklch(0.8148 0.0819 225.7537)",
      chart3: "oklch(0.9680 0.2110 109.7692)",
      chart4: "oklch(0.8027 0.1355 349.2347)",
      chart5: "oklch(0.7395 0.2268 142.8504)",
      sidebar: "oklch(0.9809 0.0025 228.7836)",
      sidebarForeground: "oklch(0.3211 0 0)",
      sidebarPrimary: "oklch(0.8677 0.0735 7.0855)",
      sidebarPrimaryForeground: "oklch(0 0 0)",
      sidebarAccent: "oklch(0.9680 0.2110 109.7692)",
      sidebarAccentForeground: "oklch(0 0 0)",
      sidebarBorder: "oklch(0.8699 0 0)",
      sidebarRing: "oklch(0.8677 0.0735 7.0855)",
      fontSans: "Poppins, sans-serif",
      fontSerif: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
      fontMono: "Roboto Mono, monospace",
      radius: "0.5rem",
      shadow2xs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowXs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowSm: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadow: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadowMd: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10)",
      shadowLg: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10)",
      shadowXl: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10)",
      shadow2xl: "0 1px 3px 0px hsl(0 0% 0% / 0.25)",
      trackingNormal: "0em",
      spacing: "0.25rem",
    },
    themeDark: {
      background: "oklch(0.2303 0.0125 264.2926)",
      foreground: "oklch(0.9219 0 0)",
      card: "oklch(0.3210 0.0078 223.6661)",
      cardForeground: "oklch(0.9219 0 0)",
      popover: "oklch(0.3210 0.0078 223.6661)",
      popoverForeground: "oklch(0.9219 0 0)",
      primary: "oklch(0.8027 0.1355 349.2347)",
      primaryForeground: "oklch(0 0 0)",
      secondary: "oklch(0.7395 0.2268 142.8504)",
      secondaryForeground: "oklch(0 0 0)",
      muted: "oklch(0.3867 0 0)",
      mutedForeground: "oklch(0.7155 0 0)",
      accent: "oklch(0.8148 0.0819 225.7537)",
      accentForeground: "oklch(0 0 0)",
      destructive: "oklch(0.6368 0.2078 25.3313)",
      destructiveForeground: "oklch(1.0000 0 0)",
      border: "oklch(0.3867 0 0)",
      input: "oklch(0.3867 0 0)",
      ring: "oklch(0.8027 0.1355 349.2347)",
      chart1: "oklch(0.8027 0.1355 349.2347)",
      chart2: "oklch(0.7395 0.2268 142.8504)",
      chart3: "oklch(0.8148 0.0819 225.7537)",
      chart4: "oklch(0.9680 0.2110 109.7692)",
      chart5: "oklch(0.8677 0.0735 7.0855)",
      sidebar: "oklch(0.2303 0.0125 264.2926)",
      sidebarForeground: "oklch(0.9219 0 0)",
      sidebarPrimary: "oklch(0.8027 0.1355 349.2347)",
      sidebarPrimaryForeground: "oklch(0 0 0)",
      sidebarAccent: "oklch(0.8148 0.0819 225.7537)",
      sidebarAccentForeground: "oklch(0 0 0)",
      sidebarBorder: "oklch(0.3867 0 0)",
      sidebarRing: "oklch(0.8027 0.1355 349.2347)",
      fontSans: "Poppins, sans-serif",
      fontSerif: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
      fontMono: "Roboto Mono, monospace",
      radius: "0.5rem",
      shadow2xs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowXs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowSm: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadow: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadowMd: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10)",
      shadowLg: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10)",
      shadowXl: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10)",
      shadow2xl: "0 1px 3px 0px hsl(0 0% 0% / 0.25)",
    },
    themeInline: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      card: "var(--card)",
      cardForeground: "var(--card-foreground)",
      popover: "var(--popover)",
      popoverForeground: "var(--popover-foreground)",
      primary: "var(--primary)",
      primaryForeground: "var(--primary-foreground)",
      secondary: "var(--secondary)",
      secondaryForeground: "var(--secondary-foreground)",
      muted: "var(--muted)",
      mutedForeground: "var(--muted-foreground)",
      accent: "var(--accent)",
      accentForeground: "var(--accent-foreground)",
      destructive: "var(--destructive)",
      destructiveForeground: "var(--destructive-foreground)",
      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
      chart1: "var(--chart-1)",
      chart2: "var(--chart-2)",
      chart3: "var(--chart-3)",
      chart4: "var(--chart-4)",
      chart5: "var(--chart-5)",
      sidebar: "var(--sidebar)",
      sidebarForeground: "var(--sidebar-foreground)",
      sidebarPrimary: "var(--sidebar-primary)",
      sidebarPrimaryForeground: "var(--sidebar-primary-foreground)",
      sidebarAccent: "var(--sidebar-accent)",
      sidebarAccentForeground: "var(--sidebar-accent-foreground)",
      sidebarBorder: "var(--sidebar-border)",
      sidebarRing: "var(--sidebar-ring)",
      fontSans: "Poppins, sans-serif",
      fontSerif: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
      fontMono: "Roboto Mono, monospace",
      radius: "0.5rem",
      shadow2xs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowXs: "0 1px 3px 0px hsl(0 0% 0% / 0.05)",
      shadowSm: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadow: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)",
      shadowMd: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10)",
      shadowLg: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10)",
      shadowXl: "0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10)",
      shadow2xl: "0 1px 3px 0px hsl(0 0% 0% / 0.25)",
    },
  },
  Catpuccing: {
    name: "Catpuccin",
    description: "A smooth, cool themed. Blue and purple accents, cool tones of gray and black.",
    projectTypes: ["portfolio", "blog", "marketing", "landing", "saas", "dashboard", "productivity", "social", "ecommerce"],
    personality: ["cat", "cute", "cuddly", "catty", "fun"],
    tags: ["cat", "cute", "cuddly", "catty", "fun", "cute", "childish", "retro"],
    themeLight: {
      background: "oklch(0.9578 0.0058 264.5321)",
      foreground: "oklch(0.4355 0.0430 279.3250)",
      card: "oklch(1.0000 0 0)",
      cardForeground: "oklch(0.4355 0.0430 279.3250)",
      popover: "oklch(0.8575 0.0145 268.4756)",
      popoverForeground: "oklch(0.4355 0.0430 279.3250)",
      primary: "oklch(0.5547 0.2503 297.0156)",
      primaryForeground: "oklch(1.0000 0 0)",
      secondary: "oklch(0.8575 0.0145 268.4756)",
      secondaryForeground: "oklch(0.4355 0.0430 279.3250)",
      muted: "oklch(0.9060 0.0117 264.5071)",
      mutedForeground: "oklch(0.5471 0.0343 279.0837)",
      accent: "oklch(0.6820 0.1448 235.3822)",
      accentForeground: "oklch(1.0000 0 0)",
      destructive: "oklch(0.5505 0.2155 19.8095)",
      destructiveForeground: "oklch(1.0000 0 0)",
      border: "oklch(0.8083 0.0174 271.1982)",
      input: "oklch(0.8575 0.0145 268.4756)",
      ring: "oklch(0.5547 0.2503 297.0156)",
      chart1: "oklch(0.5547 0.2503 297.0156)",  
      chart2: "oklch(0.6820 0.1448 235.3822)",
      chart3: "oklch(0.6250 0.1772 140.4448)",
      chart4: "oklch(0.6920 0.2041 42.4293)",
      chart5: "oklch(0.7141 0.1045 33.0967)",
      sidebar: "oklch(0.9335 0.0087 264.5206)",
      sidebarForeground: "oklch(0.4355 0.0430 279.3250)",
      sidebarPrimary: "oklch(0.5547 0.2503 297.0156)",
      sidebarPrimaryForeground: "oklch(1.0000 0 0)",
      sidebarAccent: "oklch(0.6820 0.1448 235.3822)",
      sidebarAccentForeground: "oklch(1.0000 0 0)",
      sidebarBorder: "oklch(0.8083 0.0174 271.1982)",
      sidebarRing: "oklch(0.5547 0.2503 297.0156)",
      fontSans: "Montserrat, sans-serif",
      fontSerif: "Georgia, serif",
      fontMono: "Fira Code, monospace",
      radius: "0.35rem",
      shadow2xs: "0px 4px 6px 0px hsl(240 30% 25% / 0.06)",
      shadowXs: "0px 4px 6px 0px hsl(240 30% 25% / 0.06)",
      shadowSm: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 1px 2px -1px hsl(240 30% 25% / 0.12)",
      shadow: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 1px 2px -1px hsl(240 30% 25% / 0.12)",
      shadowMd: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 2px 4px -1px hsl(240 30% 25% / 0.12)",
      shadowLg: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 4px 6px -1px hsl(240 30% 25% / 0.12)",
      shadowXl: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 8px 10px -1px hsl(240 30% 25% / 0.12)",
      shadow2xl: "0px 4px 6px 0px hsl(240 30% 25% / 0.30)",
    },
    themeDark: {
      background: "oklch(0.2155 0.0254 284.0647)",
      foreground: "oklch(0.8787 0.0426 272.2767)",
      card: "oklch(0.2429 0.0304 283.9110)",
      cardForeground: "oklch(0.8787 0.0426 272.2767)",
      popover: "oklch(0.4037 0.0320 280.1520)",
      popoverForeground: "oklch(0.8787 0.0426 272.2767)",
      primary: "oklch(0.7871 0.1187 304.7693)",
      primaryForeground: "oklch(0.2429 0.0304 283.9110)",
      secondary: "oklch(0.4765 0.0340 278.6430)",
      secondaryForeground: "oklch(0.8787 0.0426 272.2767)",
      muted: "oklch(0.2973 0.0294 276.2144)",
      mutedForeground: "oklch(0.7510 0.0396 273.9320)",
      accent: "oklch(0.8467 0.0833 210.2545)",
      accentForeground: "oklch(0.2429 0.0304 283.9110)",
      destructive: "oklch(0.7556 0.1297 2.7642)",
      destructiveForeground: "oklch(0.2429 0.0304 283.9110)",
      border: "oklch(0.3240 0.0319 281.9784)",
      input: "oklch(0.3240 0.0319 281.9784)",
      ring: "oklch(0.7871 0.1187 304.7693)",
      chart1: "oklch(0.7871 0.1187 304.7693)",
      chart2: "oklch(0.8467 0.0833 210.2545)",
      chart3: "oklch(0.6250 0.1772 140.4448)",
      chart4: "oklch(0.6920 0.2041 42.4293)",
      chart5: "oklch(0.7141 0.1045 33.0967)",
      sidebar: "oklch(0.9335 0.0087 264.5206)",
      sidebarForeground: "oklch(0.4355 0.0430 279.3250)",
      sidebarPrimary: "oklch(0.5547 0.2503 297.0156)",
      sidebarPrimaryForeground: "oklch(1.0000 0 0)",
      sidebarAccent: "oklch(0.6820 0.1448 235.3822)",
      sidebarAccentForeground: "oklch(1.0000 0 0)",
      sidebarBorder: "oklch(0.8083 0.0174 271.1982)",
      sidebarRing: "oklch(0.5547 0.2503 297.0156)",
      fontSans: "Montserrat, sans-serif",
      fontSerif: "Georgia, serif",
      fontMono: "Fira Code, monospace",
      radius: "0.35rem",
      shadow2xs: "0px 4px 6px 0px hsl(240 30% 25% / 0.06)",
      shadowXs: "0px 4px 6px 0px hsl(240 30% 25% / 0.06)",
      shadowSm: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 1px 2px -1px hsl(240 30% 25% / 0.12)",
      shadow: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 1px 2px -1px hsl(240 30% 25% / 0.12)",
      shadowMd: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 2px 4px -1px hsl(240 30% 25% / 0.12)",
      shadowLg: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 4px 6px -1px hsl(240 30% 25% / 0.12)",
      shadowXl: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 8px 10px -1px hsl(240 30% 25% / 0.12)",
      shadow2xl: "0px 4px 6px 0px hsl(240 30% 25% / 0.30)",
    },
    themeInline: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      card: "var(--card)",
      cardForeground: "var(--card-foreground)",
      popover: "var(--popover)",
      popoverForeground: "var(--popover-foreground)",
      primary: "var(--primary)",
      primaryForeground: "var(--primary-foreground)",
      secondary: "var(--secondary)",
      secondaryForeground: "var(--secondary-foreground)",
      muted: "var(--muted)",
      mutedForeground: "var(--muted-foreground)",
      accent: "var(--accent)",
      accentForeground: "var(--accent-foreground)",
      destructive: "var(--destructive)",
      destructiveForeground: "var(--destructive-foreground)",
      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
      chart1: "var(--chart-1)",
      chart2: "var(--chart-2)",
      chart3: "var(--chart-3)",
      chart4: "var(--chart-4)",
      chart5: "var(--chart-5)",
      sidebar: "var(--sidebar)",
      sidebarForeground: "var(--sidebar-foreground)",
      sidebarPrimary: "var(--sidebar-primary)",
      sidebarPrimaryForeground: "var(--sidebar-primary-foreground)",
      sidebarAccent: "var(--sidebar-accent)",
      sidebarAccentForeground: "var(--sidebar-accent-foreground)",
      sidebarBorder: "var(--sidebar-border)",
      sidebarRing: "var(--sidebar-ring)",
      fontSans: "Montserrat, sans-serif",
      fontSerif: "Georgia, serif",
      fontMono: "Fira Code, monospace",
      radius: "0.35rem",
      shadow2xs: "0px 4px 6px 0px hsl(240 30% 25% / 0.06)",
      shadowXs: "0px 4px 6px 0px hsl(240 30% 25% / 0.06)",
      shadowSm: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 1px 2px -1px hsl(240 30% 25% / 0.12)",
      shadow: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 1px 2px -1px hsl(240 30% 25% / 0.12)",
      shadowMd: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 2px 4px -1px hsl(240 30% 25% / 0.12)",
      shadowLg: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 4px 6px -1px hsl(240 30% 25% / 0.12)",
      shadowXl: "0px 4px 6px 0px hsl(240 30% 25% / 0.12), 0px 8px 10px -1px hsl(240 30% 25% / 0.12)",
      shadow2xl: "0px 4px 6px 0px hsl(240 30% 25% / 0.30)",
    },
  },
};

// Always return fresh theme objects to prevent mutations
export const BEAUTIFUL_UI_THEMES = new Proxy(THEME_DEFINITIONS, {
  get(target, prop) {
    const theme = target[prop as string];
    if (theme) {
      return JSON.parse(JSON.stringify(theme));
    }
    return theme;
  },
});

// Function to extract theme objects from CSS
export function extractThemeFromCSS(css: string): {
  themeLight: ThemeVariants;
  themeDark: ThemeVariants;
  themeInline: ThemeVariants;
} {
  const themeLight: Partial<ThemeVariants> = {};
  const themeDark: Partial<ThemeVariants> = {};
  const themeInline: Partial<ThemeVariants> = {};

  // CSS variable name to object key mapping
  const cssVarMapping: Record<string, string> = {
    background: "background",
    foreground: "foreground",
    card: "card",
    "card-foreground": "cardForeground",
    popover: "popover",
    "popover-foreground": "popoverForeground",
    primary: "primary",
    "primary-foreground": "primaryForeground",
    secondary: "secondary",
    "secondary-foreground": "secondaryForeground",
    muted: "muted",
    "muted-foreground": "mutedForeground",
    accent: "accent",
    "accent-foreground": "accentForeground",
    destructive: "destructive",
    "destructive-foreground": "destructiveForeground",
    border: "border",
    input: "input",
    ring: "ring",
    "chart-1": "chart1",
    "chart-2": "chart2",
    "chart-3": "chart3",
    "chart-4": "chart4",
    "chart-5": "chart5",
    sidebar: "sidebar",
    "sidebar-foreground": "sidebarForeground",
    "sidebar-primary": "sidebarPrimary",
    "sidebar-primary-foreground": "sidebarPrimaryForeground",
    "sidebar-accent": "sidebarAccent",
    "sidebar-accent-foreground": "sidebarAccentForeground",
    "sidebar-border": "sidebarBorder",
    "sidebar-ring": "sidebarRing",
    "font-sans": "fontSans",
    "font-serif": "fontSerif",
    "font-mono": "fontMono",
    radius: "radius",
    "shadow-2xs": "shadow2xs",
    "shadow-xs": "shadowXs",
    "shadow-sm": "shadowSm",
    shadow: "shadow",
    "shadow-md": "shadowMd",
    "shadow-lg": "shadowLg",
    "shadow-xl": "shadowXl",
    "shadow-2xl": "shadow2xl",
    "tracking-normal": "trackingNormal",
    spacing: "spacing",
  };

  // Extract light theme values from :root
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/s);
  if (rootMatch) {
    const rootContent = rootMatch[1];
    const variables = rootContent.match(/--([^:]+):\s*([^;]+);/g);
    if (variables) {
      variables.forEach((variable) => {
        const match = variable.match(/--([^:]+):\s*([^;]+);/);
        if (match) {
          const cssVar = match[1].trim();
          const value = match[2].trim();
          const objKey = cssVarMapping[cssVar];
          if (objKey) {
            (themeLight as any)[objKey] = value;
          }
        }
      });
    }
  }

  // Extract dark theme values from .dark
  const darkMatch = css.match(/\.dark\s*\{([^}]+)\}/s);
  if (darkMatch) {
    const darkContent = darkMatch[1];
    const variables = darkContent.match(/--([^:]+):\s*([^;]+);/g);
    if (variables) {
      variables.forEach((variable) => {
        const match = variable.match(/--([^:]+):\s*([^;]+);/);
        if (match) {
          const cssVar = match[1].trim();
          const value = match[2].trim();
          const objKey = cssVarMapping[cssVar];
          if (objKey) {
            (themeDark as any)[objKey] = value;
          }
        }
      });
    }
  }

  // Generate inline theme with var() references
  Object.keys(cssVarMapping).forEach((cssVar) => {
    const objKey = cssVarMapping[cssVar];
    (themeInline as any)[objKey] = `var(--${cssVar})`;
  });

  return {
    themeLight: themeLight as ThemeVariants,
    themeDark: themeDark as ThemeVariants,
    themeInline: themeInline as ThemeVariants,
  };
}

// Theme Selection & CSS Generation Utilities
export function generateThemeCSS(theme: Themes): string {
  const { themeLight, themeDark, themeInline } = theme;

  return `@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
  --background: ${themeLight.background};
  --foreground: ${themeLight.foreground};
  --card: ${themeLight.card};
  --card-foreground: ${themeLight.cardForeground};
  --popover: ${themeLight.popover};
  --popover-foreground: ${themeLight.popoverForeground};
  --primary: ${themeLight.primary};
  --primary-foreground: ${themeLight.primaryForeground};
  --secondary: ${themeLight.secondary};
  --secondary-foreground: ${themeLight.secondaryForeground};
  --muted: ${themeLight.muted};
  --muted-foreground: ${themeLight.mutedForeground};
  --accent: ${themeLight.accent};
  --accent-foreground: ${themeLight.accentForeground};
  --destructive: ${themeLight.destructive};
  --destructive-foreground: ${themeLight.destructiveForeground};
  --border: ${themeLight.border};
  --input: ${themeLight.input};
  --ring: ${themeLight.ring};
  --chart-1: ${themeLight.chart1};
  --chart-2: ${themeLight.chart2};
  --chart-3: ${themeLight.chart3};
  --chart-4: ${themeLight.chart4};
  --chart-5: ${themeLight.chart5};
  --sidebar: ${themeLight.sidebar};
  --sidebar-foreground: ${themeLight.sidebarForeground};
  --sidebar-primary: ${themeLight.sidebarPrimary};
  --sidebar-primary-foreground: ${themeLight.sidebarPrimaryForeground};
  --sidebar-accent: ${themeLight.sidebarAccent};
  --sidebar-accent-foreground: ${themeLight.sidebarAccentForeground};
  --sidebar-border: ${themeLight.sidebarBorder};
  --sidebar-ring: ${themeLight.sidebarRing};
  --font-sans: ${themeLight.fontSans};
  --font-serif: ${themeLight.fontSerif};
  --font-mono: ${themeLight.fontMono};
  --radius: ${themeLight.radius || "0.375rem"};
  --shadow-2xs: ${themeLight.shadow2xs};
  --shadow-xs: ${themeLight.shadowXs};
  --shadow-sm: ${themeLight.shadowSm};
  --shadow: ${themeLight.shadow};
  --shadow-md: ${themeLight.shadowMd};
  --shadow-lg: ${themeLight.shadowLg};
  --shadow-xl: ${themeLight.shadowXl};
  --shadow-2xl: ${themeLight.shadow2xl};
  --tracking-normal: ${themeLight.trackingNormal || "0em"};
  --spacing: ${themeLight.spacing || "0.25rem"};
}

.dark {
  --background: ${themeDark.background};
  --foreground: ${themeDark.foreground};
  --card: ${themeDark.card};
  --card-foreground: ${themeDark.cardForeground};
  --popover: ${themeDark.popover};
  --popover-foreground: ${themeDark.popoverForeground};
  --primary: ${themeDark.primary};
  --primary-foreground: ${themeDark.primaryForeground};
  --secondary: ${themeDark.secondary};
  --secondary-foreground: ${themeDark.secondaryForeground};
  --muted: ${themeDark.muted};
  --muted-foreground: ${themeDark.mutedForeground};
  --accent: ${themeDark.accent};
  --accent-foreground: ${themeDark.accentForeground};
  --destructive: ${themeDark.destructive};
  --destructive-foreground: ${themeDark.destructiveForeground};
  --border: ${themeDark.border};
  --input: ${themeDark.input};
  --ring: ${themeDark.ring};
  --chart-1: ${themeDark.chart1};
  --chart-2: ${themeDark.chart2};
  --chart-3: ${themeDark.chart3};
  --chart-4: ${themeDark.chart4};
  --chart-5: ${themeDark.chart5};
  --sidebar: ${themeDark.sidebar};
  --sidebar-foreground: ${themeDark.sidebarForeground};
  --sidebar-primary: ${themeDark.sidebarPrimary};
  --sidebar-primary-foreground: ${themeDark.sidebarPrimaryForeground};
  --sidebar-accent: ${themeDark.sidebarAccent};
  --sidebar-accent-foreground: ${themeDark.sidebarAccentForeground};
  --sidebar-border: ${themeDark.sidebarBorder};
  --sidebar-ring: ${themeDark.sidebarRing};
  --font-sans: ${themeDark.fontSans};
  --font-serif: ${themeDark.fontSerif};
  --font-mono: ${themeDark.fontMono};
  --radius: ${themeDark.radius || "0.375rem"};
  --shadow-2xs: ${themeDark.shadow2xs};
  --shadow-xs: ${themeDark.shadowXs};
  --shadow-sm: ${themeDark.shadowSm};
  --shadow: ${themeDark.shadow};
  --shadow-md: ${themeDark.shadowMd};
  --shadow-lg: ${themeDark.shadowLg};
  --shadow-xl: ${themeDark.shadowXl};
  --shadow-2xl: ${themeDark.shadow2xl};
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
}`;
}

// Utility function to get a fresh, uncorrupted theme object
export function getFreshTheme(
  themeName: string,
  themes: Record<string, Themes> = BEAUTIFUL_UI_THEMES
): Themes | null {
  const theme = themes[themeName];
  if (!theme) {
    return null;
  }
  // Always return a deep copy to prevent any mutations
  return JSON.parse(JSON.stringify(theme));
}

// Generate theme objects from CSS (this ensures consistency)
export function generateThemeFromCSS(themeName: string, css: string): Themes {
  const extractedThemes = extractThemeFromCSS(css);
  const baseTheme = BEAUTIFUL_UI_THEMES[themeName];

  return {
    name: themeName,
    description: baseTheme?.description || "Generated from CSS",
    tags: baseTheme?.tags || [],
    projectTypes: baseTheme?.projectTypes || [],
    personality: baseTheme?.personality || [],
    themeLight: extractedThemes.themeLight,
    themeDark: extractedThemes.themeDark,
    themeInline: extractedThemes.themeInline,
    body: baseTheme?.body,
  };
}

// Easy AI Usage Functions
export function getThemeCSS(
  themeName: string,
  themes: Record<string, Themes> = BEAUTIFUL_UI_THEMES
): string {
  const theme = themes[themeName];
  if (!theme) {
    throw new Error(`Theme "${themeName}" not found`);
  }
  // Create a deep copy to prevent mutation of the original theme object
  const themeDeepCopy = JSON.parse(JSON.stringify(theme));
  return generateThemeCSS(themeDeepCopy);
}

export function getThemeList(
  themes: Record<string, Themes> = BEAUTIFUL_UI_THEMES
): Array<{
  name: string;
  description: string;
  tags: string[];
}> {
  return Object.values(themes).map((theme) => ({
    name: theme.name,
    description: theme.description,
    tags: theme.tags,
  }));
}

export class IntelligentThemeMatcher {
  static analyzeUserRequest(userRequest: string): ProjectContext {
    const request = userRequest.toLowerCase();

    // Detect project type from functional keywords
    const projectType = this.detectProjectType(request);

    // Extract style preferences
    const styleKeywords = this.extractStyleKeywords(request);

    // Extract emotional tone
    const emotionalTone = this.extractEmotionalTone(request);

    // Assess complexity
    const complexity = this.assessComplexity(request);

    return {
      projectType,
      stylePreferences: styleKeywords,
      emotionalTone,
      complexity,
      originalRequest: userRequest,
    };
  }

  static selectBestTheme(
    context: ProjectContext,
    themes: Record<string, Themes> = BEAUTIFUL_UI_THEMES
  ): ThemeMatchResult {
    const results: Array<{
      theme: Themes;
      score: number;
      reasoning: string[];
    }> = [];

    Object.entries(themes).forEach(([themeName, theme]) => {
      // Use the metadata that's already in your theme object!
      const score = this.calculateMatchScore(context, theme);
      const reasoning = this.generateReasoning(context, theme, score);

      results.push({
        theme,
        score,
        reasoning,
      });
    });

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    return {
      bestMatch: results[0],
      alternatives: results.slice(1, 3),
      context,
    };
  }

  private static detectProjectType(request: string): string {
    const patterns = {
      ecommerce: [
        "shop",
        "store",
        "buy",
        "sell",
        "cart",
        "checkout",
        "product",
        "payment",
        "marketplace",
      ],
      productivity: [
        "todo",
        "task",
        "note",
        "organiz",
        "plan",
        "schedule",
        "manage",
        "productivity",
      ],
      portfolio: [
        "portfolio",
        "showcase",
        "work",
        "project",
        "gallery",
        "resume",
        "cv",
      ],
      blog: ["blog", "article", "post", "write", "publish", "content", "news"],
      dashboard: [
        "dashboard",
        "admin",
        "analytics",
        "data",
        "chart",
        "metric",
        "report",
      ],
      social: [
        "social",
        "chat",
        "message",
        "friend",
        "community",
        "share",
        "connect",
      ],
      creative: ["design", "art", "creative", "studio", "agency", "visual"],
      tech: ["api", "tech", "saas", "software", "platform", "development"],
      documentation: ["docs", "documentation", "guide", "manual", "reference"],
      landing: ["landing", "homepage", "marketing", "company", "business"],
    };

    let maxScore = 0;
    let detectedType = "general";

    Object.entries(patterns).forEach(([type, keywords]) => {
      const score = keywords.reduce((count, keyword) => {
        return request.includes(keyword) ? count + 1 : count;
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        detectedType = type;
      }
    });

    return detectedType;
  }

  private static extractStyleKeywords(request: string): string[] {
    const stylePatterns = {
      minimal: ["minimal", "clean", "simple", "stripped", "bare", "basic"],
      modern: ["modern", "contemporary", "current", "trendy", "fresh", "new"],
      professional: [
        "professional",
        "business",
        "corporate",
        "formal",
        "enterprise",
      ],
      elegant: [
        "elegant",
        "sophisticated",
        "refined",
        "classy",
        "premium",
        "luxury",
      ],
      bold: ["bold", "vibrant", "striking", "powerful", "dramatic", "strong"],
      warm: [
        "warm",
        "friendly",
        "welcoming",
        "cozy",
        "inviting",
        "comfortable",
      ],
      technical: [
        "technical",
        "tech",
        "digital",
        "cyber",
        "advanced",
        "cutting-edge",
      ],
    };

    const found: string[] = [];
    Object.entries(stylePatterns).forEach(([style, keywords]) => {
      if (keywords.some((keyword) => request.includes(keyword))) {
        found.push(style);
      }
    });

    return found;
  }

  private static extractEmotionalTone(request: string): string[] {
    const emotionalPatterns = {
      calm: ["calm", "peaceful", "serene", "tranquil", "relaxing"],
      energetic: ["energetic", "dynamic", "lively", "vibrant", "exciting"],
      professional: ["professional", "serious", "formal", "business"],
      friendly: ["friendly", "approachable", "welcoming", "warm"],
      confident: ["confident", "strong", "powerful", "bold"],
      creative: ["creative", "artistic", "innovative", "unique"],
    };

    const found: string[] = [];
    Object.entries(emotionalPatterns).forEach(([emotion, keywords]) => {
      if (keywords.some((keyword) => request.includes(keyword))) {
        found.push(emotion);
      }
    });

    return found;
  }

  private static assessComplexity(
    request: string
  ): "simple" | "moderate" | "complex" {
    const complexityIndicators = {
      simple: ["simple", "basic", "minimal", "single page"],
      moderate: ["dashboard", "multiple pages", "user auth", "database"],
      complex: ["admin", "analytics", "real-time", "advanced", "enterprise"],
    };

    let complexity: "simple" | "moderate" | "complex" = "simple";

    Object.entries(complexityIndicators).forEach(([level, indicators]) => {
      if (indicators.some((indicator) => request.includes(indicator))) {
        complexity = level as "simple" | "moderate" | "complex";
      }
    });

    return complexity;
  }

  private static calculateMatchScore(
    context: ProjectContext,
    metadata: any
  ): number {
    let score = 0;

    // Project type match (40% weight)
    if (metadata.projectTypes.includes(context.projectType)) {
      score += 40;
    }

    // Style preference match (30% weight)
    const styleMatches = context.stylePreferences.filter(
      (style) =>
        metadata.visualStyle.includes(style) ||
        metadata.personality.includes(style)
    ).length;
    if (context.stylePreferences.length > 0) {
      score += (styleMatches / context.stylePreferences.length) * 30;
    }

    // Emotional tone match (20% weight)
    const emotionalMatches = context.emotionalTone.filter(
      (emotion) =>
        metadata.emotional.includes(emotion) ||
        metadata.personality.includes(emotion)
    ).length;
    if (context.emotionalTone.length > 0) {
      score += (emotionalMatches / context.emotionalTone.length) * 20;
    }

    // Complexity match (10% weight)
    if (metadata.complexity === context.complexity) {
      score += 10;
    }

    return Math.round(score);
  }

  private static generateReasoning(
    context: ProjectContext,
    metadata: any,
    score: number
  ): string[] {
    const reasons: string[] = [];

    // Project type reasoning
    if (metadata.projectTypes.includes(context.projectType)) {
      reasons.push(`✅ Perfect match for ${context.projectType} projects`);
    } else {
      reasons.push(
        `⚠️ Not specifically designed for ${
          context.projectType
        } (better for: ${metadata.projectTypes.join(", ")})`
      );
    }

    // Style reasoning
    const styleMatches = context.stylePreferences.filter(
      (style) =>
        metadata.visualStyle.includes(style) ||
        metadata.personality.includes(style)
    );
    if (styleMatches.length > 0) {
      reasons.push(
        `✅ Matches your style preferences: ${styleMatches.join(", ")}`
      );
    }

    // Emotional reasoning
    const emotionalMatches = context.emotionalTone.filter((emotion) =>
      metadata.emotional.includes(emotion)
    );
    if (emotionalMatches.length > 0) {
      reasons.push(
        `✅ Matches desired emotional tone: ${emotionalMatches.join(", ")}`
      );
    }

    // Complexity reasoning
    if (metadata.complexity === context.complexity) {
      reasons.push(`✅ Appropriate complexity level: ${context.complexity}`);
    }

    return reasons;
  }
}

// REPLACE your selectThemeByRequest function with this:
export function selectThemeByIntelligentMatching(
  userRequest: string,
  themes: Record<string, Themes> = BEAUTIFUL_UI_THEMES
): Themes | null {
  try {
    const context = IntelligentThemeMatcher.analyzeUserRequest(userRequest);
    const result = IntelligentThemeMatcher.selectBestTheme(context, themes);

    // Return the best match if score is decent
    if (result.bestMatch && result.bestMatch.score > 20) {
      return JSON.parse(JSON.stringify(result.bestMatch.theme));
    }

    return null;
  } catch (error) {
    console.error("Theme selection error:", error);
    return null;
  }
}

// Types
interface ProjectContext {
  projectType: string;
  stylePreferences: string[];
  emotionalTone: string[];
  complexity: "simple" | "moderate" | "complex";
  originalRequest: string;
}

interface ThemeMatchResult {
  bestMatch: {
    theme: Themes;
    score: number;
    reasoning: string[];
  };
  alternatives: Array<{
    theme: Themes;
    score: number;
    reasoning: string[];
  }>;
  context: ProjectContext;
}
