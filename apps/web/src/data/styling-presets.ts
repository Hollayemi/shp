export interface StylingPreset {
  id: string;
  label: string;
  description: string;
  imageUrl: string; // Collage image for AI (kept in public/)
  darkImageUrl?: string; // Optional dark mode collage for AI
  thumbnailUrl: string; // Thumbnail for UI display (in preset-thumbnails/)
  darkThumbnailUrl?: string; // Optional dark mode thumbnail for UI
  prompt: string;
}

/**
 * Strips the "IMPORTANT:" instruction section from a prompt for user display.
 * The full prompt (with IMPORTANT section) should still be sent to the AI.
 */
export function getDisplayPrompt(prompt: string): string {
  // Remove the "IMPORTANT:" section and everything after it
  const importantIndex = prompt.indexOf("IMPORTANT:");
  if (importantIndex === -1) {
    return prompt.trim();
  }
  return prompt.substring(0, importantIndex).trim();
}

export const STYLING_PRESETS: StylingPreset[] = [
  {
    id: "notion",
    label: "Notion",
    description:
      "Clean, content-first design with subtle borders, neutral colors, and exceptional text readability. Emphasizes hierarchy and whitespace.",
    imageUrl: "/notion-collage.png",
    darkImageUrl: "/notion-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/notion-thumbnail-light.png",
    darkThumbnailUrl: "/preset-thumbnails/notion-thumbnail-dark.png",
    prompt: `Design System: Notion aesthetic. Core principle: content is king—design serves readability and organization, not decoration. Color philosophy: neutral base with strategic accent colors for interactivity—extract color relationships from the reference. Typography system: clean sans-serif optimized for extended reading with generous spacing. Layout principle: clear hierarchy through spacing and borders, not shadows or decoration. Visual hierarchy: status tags use color systematically; borders create structure without noise. Interaction model: subtle hover states that don't distract from content. Shape language: moderate rounding maintains friendliness while preserving structure. Depth system: minimal shadows—spacing and borders create hierarchy. Emotional tone: organized, clean, content-focused, optimized for productivity. Match the reference image's theme mode and content-first mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Notion-style workspace interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "airbnb",
    label: "Airbnb",
    description:
      "Clean, welcoming design with warm coral accents, high-quality imagery, card-based layouts, and a focus on trust and community.",
    imageUrl: "/airbnb-collage.png",
    thumbnailUrl: "/preset-thumbnails/airbnb-thumbnail-light.png",
    prompt: `Design System: Airbnb aesthetic. Core principle: build trust through warmth and clarity. Color philosophy: warm, inviting tones with a signature accent used strategically for emphasis—extract color relationships from the reference, not exact values. Typography system: friendly sans-serif that balances approachability with professionalism. Layout principle: card-based architecture creates scannable, digestible content blocks. Visual hierarchy: imagery is primary; let photos breathe with generous whitespace. Trust signals: incorporate social proof elements naturally. Interaction model: gentle, unhurried transitions that feel considerate. Information architecture: clear, logical grouping that guides users without overwhelming. Match the reference image's theme mode and emotional tone. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to an Airbnb-style marketplace interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "apple",
    label: "Apple",
    description:
      "Premium, meticulously crafted interface with SF Pro typography, subtle depth, frosted glass effects, and elegant spacing.",
    imageUrl: "/apple-collage.png",
    darkImageUrl: "/apple-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/apple-thumbnail-light.png",
    darkThumbnailUrl: "/preset-thumbnails/apple-thumbnail-dark.jpeg",
    prompt: `Design System: Apple aesthetic. Core principle: meticulous craftsmanship creates premium experiences through attention to every detail. Color philosophy: refined, sophisticated palettes with strategic accent colors—extract color relationships from the reference. Typography system: system fonts with optical sizing that adapts to context; Display for impact, Text for readability. Material philosophy: frosted glass effects create depth and sophistication through transparency. Layout principle: precise spacing grid creates rhythm and consistency. Visual hierarchy: subtle borders and soft elevation create layers without harshness. Interaction model: smooth, physics-based transitions that feel natural and responsive. Icon system: consistent, thin-weight icons that feel integrated, not decorative. Depth system: multiple layers of subtle elevation create sophisticated hierarchy. Emotional tone: premium, refined, human-interface-guidelines compliant. Match the reference image's theme mode and meticulously crafted mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to an Apple-style interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "spotify",
    label: "Spotify",
    description:
      "Bold, music-first dark interface with vibrant album art, green accents, immersive visuals, and dynamic content cards.",
    imageUrl: "/spotify-dark.png",
    thumbnailUrl: "/preset-thumbnails/spotify-thumbnail-dark.png",
    prompt: `Design System: Spotify aesthetic. Core principle: content is king—create immersive, distraction-free experiences. Color philosophy: deep, rich darks that make content pop; vibrant accent colors used sparingly for energy. Typography system: bold, confident sans-serif that commands attention without shouting. Layout principle: card-based grids that showcase content dynamically. Visual hierarchy: high contrast between primary content and secondary information. Shape language: pill-shaped elements feel modern and approachable. Depth system: subtle elevation creates layers without competing with content. Interaction model: smooth, fluid transitions that feel responsive. Match the reference image's dark theme and energetic mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Spotify-style music streaming interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "stripe",
    label: "Stripe",
    description:
      "Professional, trustworthy payment interface with signature purple accent, clean forms, and exceptional attention to accessibility and micro-interactions.",
    imageUrl: "/stripe-collage.png",
    darkImageUrl: "/stripe-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/stripe-thumbnail-two.png",
    darkThumbnailUrl: "/preset-thumbnails/stripe-thumbnail-dark.png",
    prompt: `Design System: Stripe aesthetic. Core principle: build trust through clarity, accessibility, and exceptional attention to detail. Color philosophy: neutral base with strategic accent colors for actions—extract color relationships from the reference. Typography system: clean, readable sans-serif with clear hierarchy through size and weight. Layout principle: generous whitespace creates breathing room and reduces cognitive load. Visual hierarchy: clear, unambiguous structure that guides users confidently. Accessibility: high contrast ensures readability; thoughtful micro-interactions provide feedback. Depth system: subtle elevation creates layers without distraction. Interaction model: smooth, considered transitions that feel polished. Emotional tone: professional, trustworthy, confident, accessible. Match the reference image's theme mode and trust-focused mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Stripe-style payment interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "bento-grid",
    label: "Bento Grid",
    description:
      "Content organized in card-based containers with clear spacing and grid alignment. Each section is self-contained and easy to scan, perfect for responsive layouts and content-heavy sites.",
    imageUrl: "/bento-grid.png",
    thumbnailUrl: "/bento-grid.png", // Fallback to collage if no thumbnail exists
    prompt: `Design System: Bento Grid aesthetic. Core principle: modular, scannable content organization through self-contained cards. Layout philosophy: grid-based architecture where each card is a complete information unit. Visual hierarchy: consistent padding and spacing create rhythm; subtle borders and shadows define boundaries without overwhelming. Color philosophy: neutral card backgrounds let content shine; extract color relationships from the reference. Shape language: moderate rounding creates friendliness while maintaining structure. Interaction model: subtle hover elevation provides feedback without distraction. Responsive behavior: cards reflow naturally across breakpoints while maintaining relationships. Content grouping: clear visual separation makes complex information scannable. Depth system: gentle elevation creates layers without competing with content. Match the reference image's modular, organized mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a bento grid-style layout. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "tesla",
    label: "Tesla UI",
    description:
      "Futuristic, minimalist automotive interface with large touchscreen-optimized controls, dark mode, and smartphone-like interactions.",
    imageUrl: "/tesla-collage.png",
    darkImageUrl: "/tesla-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/tesla-thumbnail-light.png",
    darkThumbnailUrl: "/preset-thumbnails/tesla-thumbnail-dark.png",
    prompt: `Design System: Tesla UI aesthetic. Core principle: clarity and immediacy for critical information in motion. Color philosophy: dark backgrounds reduce eye strain; high-contrast text ensures readability at a glance. Typography system: large, bold metrics that communicate instantly; hierarchy through size, not decoration. Shape language: touch-optimized sizing with subtle rounding that feels modern. Layout principle: focus on essential information; eliminate distractions. Interaction model: large touch targets for safety; clear state changes. Visual hierarchy: critical information dominates; secondary controls recede. Depth system: subtle elevation separates layers without competing with content. Emotional tone: clean, focused, futuristic, trustworthy. Match the reference image's dark theme and automotive-focused mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Tesla-style automotive control interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "raycast",
    label: "Raycast",
    description:
      "Command launcher with sleek dark UI, red accents, keyboard shortcuts, instant search, and productivity-optimized design.",
    imageUrl: "/raycast-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/raycast-thumbnail-dark.png",
    prompt: `Design System: Raycast aesthetic. Core principle: speed and power through keyboard-first, distraction-free design. Color philosophy: dark, rich backgrounds reduce eye strain; high-contrast text ensures instant readability—extract color relationships from the reference. Typography system: system fonts optimized for scanning and speed. Layout principle: floating panels that feel responsive and immediate. Visual hierarchy: clear text contrast creates instant information parsing. Interaction model: keyboard shortcuts are first-class; visual badges make shortcuts discoverable. Shape language: moderate rounding maintains modernity; frosted glass adds sophistication. Depth system: subtle elevation separates layers without distraction. Emotional tone: fast, powerful, keyboard-first, minimal visual noise. Match the reference image's dark theme and productivity-focused mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Raycast-style command launcher interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "glassmorphism",
    label: "Glassmorphism",
    description:
      "Frosted glass effect with transparency, blur, and subtle borders that create depth and layering.",
    imageUrl: "/glassmorphism.png",
    thumbnailUrl: "/glassmorphism.png", // Fallback to collage if no thumbnail exists
    prompt: `Design System: Glassmorphism aesthetic. Core principle: create depth through transparency and layering, not solidity. Material philosophy: frosted glass panels that reveal context while maintaining focus. Depth system: backdrop blur creates separation; subtle borders and shadows lift panels from background. Color philosophy: let background content show through; use light borders and text that contrast with backgrounds. Layout principle: layered panels create spatial hierarchy; content floats above context. Typography system: modern sans-serif that remains readable over varied backgrounds. Interaction model: subtle hover states that feel responsive without being distracting. Visual hierarchy: transparency and blur create focus, not size or color alone. Avoid: heavy borders, harsh shadows, flat opaque fills. Match the reference image's layered, depth-focused mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a glassmorphism-style interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "duolingo",
    label: "Duolingo",
    description:
      "Playful, gamified learning interface with bright colors, friendly characters, progress tracking, and motivational design.",
    imageUrl: "/duolingo-two-light.png",
    darkImageUrl: "/duolingo-two-dark.png",
    thumbnailUrl: "/preset-thumbnails/duolingo-thumbnail-light.png",
    darkThumbnailUrl: "/preset-thumbnails/duolingo-thumbnail-dark.png",
    prompt: `Design System: Duolingo aesthetic. Core principle: make learning feel like play through gamification and positive reinforcement. Color philosophy: bright, cheerful colors that energize and motivate—extract vibrant color relationships from the reference. Typography system: rounded, friendly weights that feel approachable and encouraging. Shape language: heavy rounding creates toy-like, playful forms that feel safe and inviting. Layout principle: grid-based cards that feel like collectibles; progress tracking is always visible. Visual hierarchy: large, bold buttons make actions obvious; achievement elements celebrate progress. Interaction model: reward animations and feedback loops that feel satisfying. Gamification elements: streaks, XP, badges, and progress bars create motivation through clear goals. Character system: if including a mascot, replicate Duo the owl's authentic design from the reference—simple, friendly, encouraging. If no mascot needed, omit entirely. Emotional tone: encouraging, game-like, accessible, motivating. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Duolingo-style language learning app. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "neumorphism",
    label: "Neumorphism",
    description:
      "Soft, extruded UI elements that appear to push through the surface, using subtle shadows to create a physical, tactile feel.",
    imageUrl: "/neumorphism.png",
    thumbnailUrl: "/neumorphism.png", // Fallback to collage if no thumbnail exists
    prompt: `Design System: Neumorphism aesthetic. Core principle: create physical, tactile interfaces that feel carved from a single material. Material philosophy: all elements appear extruded from the same surface—borderless, unified. Color philosophy: soft, neutral base colors that feel calm and unobtrusive—extract color relationships from the reference. Depth system: dual shadows (light from top-left, dark from bottom-right) create extrusion effect. Typography system: simple, low-contrast sans-serif that doesn't compete with form. Interaction model: buttons that flip shadow direction when pressed create tactile, inset feedback. Visual hierarchy: depth through extrusion, not color or decoration. Avoid: bright saturated colors, hard edges, busy patterns, borders. Emotional tone: physical, tactile, calm, unified. Match the reference image's soft, extruded mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a neumorphism-style interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "headspace",
    label: "Headspace",
    description:
      "Calm, meditation-focused design with soft pastels, circular elements, organic shapes, breathing room, and mindful interactions.",
    imageUrl: "/headspace-collage.png",
    darkImageUrl: "/headspace-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/headspace-thumbnail-light.png",
    darkThumbnailUrl: "/preset-thumbnails/headspace-thumbnail-dark.jpeg",
    prompt: `Design System: Headspace aesthetic. Core principle: reduce cognitive load through calm, organic design. Color philosophy: soft pastels that feel nurturing, not clinical—extract color relationships from the reference. Typography system: friendly, approachable sans-serif with relaxed spacing that doesn't rush the reader. Shape language: generous rounding and circular elements create organic, human-friendly forms. Depth system: soft, diffused shadows that feel gentle, never harsh. Layout principle: generous breathing room prevents overwhelm. Visual elements: playful, organic illustrations that feel hand-drawn, not mechanical. Interaction model: slow, ease-out animations that feel mindful, not rushed. Emotional tone: peaceful, welcoming, stress-free. Match the reference image's theme mode and calming mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Headspace-style meditation and wellness app. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "skeuomorphism",
    label: "Skeuomorphism",
    description:
      "Design that mimics real-world materials and textures—leather, wood, metal, paper. Uses realistic shadows, gradients, and fine details to create familiar, tactile interfaces that resemble physical objects.",
    imageUrl: "/skeumorphism.png",
    thumbnailUrl: "/skeumorphism.png", // Fallback to collage if no thumbnail exists
    prompt: `Design System: Skeuomorphism aesthetic. Core principle: create familiarity through realistic imitation of tangible materials. Material philosophy: mimic physical textures (leather, wood, metal, paper) to create recognizable, tactile interfaces. Color philosophy: realistic material colors that feel authentic—extract color relationships from the reference. Depth system: detailed gradients, embossed effects, and realistic shadows create three-dimensional appearance. Texture system: overlays, grain effects, and patterns add material authenticity. Detail system: fine elements like stitching, reflective highlights, and grain create realism. Typography system: fonts that complement material textures. Shape language: border-radius mimics real object shapes, not arbitrary rounding. Interaction model: buttons that feel three-dimensional with gradient fills and multiple shadow layers. Emotional tone: familiar, tactile, authentic, nostalgic. Match the reference image's material-rich, realistic mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a skeuomorphism-style interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "figma",
    label: "Figma",
    description:
      "Collaborative design tool aesthetic with floating panels, precise controls, color-coded layers, and a professional canvas-centered layout.",
    imageUrl: "/figma-collage.png",
    darkImageUrl: "/figma-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/figma-thumbnail-light.png",
    darkThumbnailUrl: "/preset-thumbnails/figma-thumbnail-dark.png",
    prompt: `Design System: Figma aesthetic. Core principle: precision and organization enable creative work. Color philosophy: neutral base with systematic color coding for different element types—extract color relationships from the reference. Typography system: compact, readable system fonts optimized for dense information. Layout principle: floating panels and toolbars that don't obstruct the canvas. Visual hierarchy: subtle elevation separates UI from content; color coding provides instant context. Interaction model: precise hover states; icon buttons that reveal affordances on interaction. Shape language: minimal rounding maintains precision without feeling harsh. Depth system: subtle shadows create layers without competing with content. Emotional tone: professional, precise, optimized for extended creative sessions. Match the reference image's theme mode and tool-focused mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Figma-style design tool interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "memphis-design",
    label: "Memphis Design",
    description:
      "80s-inspired aesthetic with bright contrasting colors, geometric shapes, squiggly lines, and pattern mixing. Chaotic yet intentional with a retro-futuristic vibe that's energetic and expressive.",
    imageUrl: "/memphis.png",
    thumbnailUrl: "/memphis.png", // Fallback to collage if no thumbnail exists
    prompt: `Design System: Memphis Design aesthetic. Core principle: embrace chaos with intention—energetic, expressive design that rejects minimalism. Color philosophy: high-contrast, saturated complementary colors that clash intentionally—extract color relationships from the reference. Typography system: bold, display-weight fonts that command attention. Shape language: geometric primitives (circles, triangles, squares) create playful, expressive forms. Pattern system: mix dots, stripes, and zigzags for visual interest. Border system: thick, contrasting borders define elements boldly. Layout principle: playful angles and layering create depth and energy. Visual hierarchy: bold colors and shapes create structure, not subtlety. Avoid: gradients, subtle effects, minimalism. Emotional tone: energetic, expressive, chaotic yet intentional, nostalgic. Match the reference image's retro-futuristic, maximalist mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Memphis Design-style interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "perplexity",
    label: "Perplexity AI",
    description:
      "Minimal, information-focused design with dark theme support. Clean typography with FK Grotesk, elevated blue accents, and invisible brand philosophy.",
    imageUrl: "/perplexity-collage.png",
    darkImageUrl: "/perplexity-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/perplexity-thumbnail-light.png",
    darkThumbnailUrl: "/preset-thumbnails/perplexity-thumbnail-dark.png",
    prompt: `Design System: Perplexity AI aesthetic. Core principle: invisible brand—function over decoration, speed over style. Color philosophy: neutral, unobtrusive backgrounds that don't compete with content—extract color relationships from the reference. Typography system: clean, modern sans-serif optimized for reading speed and comprehension. Layout principle: generous whitespace reduces cognitive load; let content breathe. Visual hierarchy: clear, unambiguous structure that guides without decoration. Shape language: subtle rounding maintains modernity without drawing attention. Interaction model: minimal, focused states that don't distract from content. Brand philosophy: the interface should feel invisible, letting information be the hero. Match the reference image's theme mode and information-first mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Perplexity AI-style search interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },

  {
    id: "framer",
    label: "Framer",
    description:
      "Design + code interface with smooth animations, gradient accents, sophisticated dark theme, and interactive prototyping feel.",
    imageUrl: "/framer-collage.png",
    darkImageUrl: "/framer-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/framer-thumbnail-light.png",
    darkThumbnailUrl: "/preset-thumbnails/framer-thumbnail-dark.png",
    prompt: `Design System: Framer aesthetic. Core principle: motion and interactivity are first-class design elements. Color philosophy: vibrant gradient accents that feel dynamic and creative—extract color relationships from the reference. Typography system: modern sans-serif that balances readability with style. Shape language: smooth rounding creates friendliness; glass-morphism adds sophistication. Layout principle: floating panels and layered interfaces that feel interactive. Visual hierarchy: color coding and motion guide attention; depth through transparency and blur. Interaction model: smooth, fluid transitions that feel responsive and alive. Motion philosophy: animations aren't decoration—they're part of the interface language. Emotional tone: creative, powerful, motion-forward, professionally polished. Match the reference image's theme mode and animation-focused mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Framer-style design and prototyping interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "neo-brutalism",
    label: "Neo-Brutalism",
    description:
      'Bold colors, high contrast, thick borders, and intentionally "undesigned" aesthetics with rough edges.',
    imageUrl: "/neo-brutalism.png",
    thumbnailUrl: "/neo-brutalism.png", // Fallback to collage if no thumbnail exists
    prompt: `Design System: Neo-Brutalism aesthetic. Core principle: reject polish—embrace raw, expressive design that prioritizes function and personality over refinement. Color philosophy: high-contrast, saturated colors that demand attention; stark backgrounds make content pop. Typography system: oversized, heavy weights that feel bold and unapologetic. Shape language: sharp corners, no softening—geometric precision. Depth system: harsh, offset shadows with no blur create intentional roughness. Border system: thick, solid borders define elements clearly, not subtly. Layout principle: embrace chaos within structure—expressive, not random. Avoid: gradients, subtle shadows, polish, rounded corners. Emotional tone: bold, confident, intentionally unrefined. Match the reference image's high-contrast, expressive mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a neo-brutalist style interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "canva",
    label: "Canva",
    description:
      "Accessible design platform with drag-and-drop simplicity, template library, colorful elements, and intuitive creative tools.",
    imageUrl: "/canva-collage.png",
    darkImageUrl: "/canva-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/canva-thumbnail-light.png",
    darkThumbnailUrl: "/preset-thumbnails/canva-thumbnail-dark.jpeg",
    prompt: `Design System: Canva aesthetic. Core principle: democratize design through clarity and approachability. Color philosophy: vibrant, organized color systems that inspire creativity without overwhelming—extract color relationships from the reference. Typography system: clean, friendly sans-serif that feels professional yet accessible. Shape language: moderate rounding creates friendliness without losing structure. Layout principle: grid-based organization makes content discoverable and scannable. Interaction model: clear visual feedback for drag-and-drop operations; hover states reveal possibilities. Visual affordances: make actions obvious through clear cues and organized categories. Depth system: subtle elevation helps organize content without distraction. Emotional tone: approachable, creative, empowering for non-designers. Match the reference image's theme mode and creative mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Canva-style design platform interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "claymorphism",
    label: "Claymorphism",
    description:
      "Soft, puffy, rounded UI elements that appear like clay, with soft shadows and pastel colors.",
    imageUrl: "/Claymorphism.png",
    thumbnailUrl: "/Claymorphism.png", // Fallback to collage if no thumbnail exists
    prompt: `Design System: Claymorphism aesthetic. Core principle: create tactile, physical feeling through soft, extruded forms. Material philosophy: UI elements appear to push through the surface, like soft clay. Color philosophy: gentle pastels that feel nurturing and approachable—extract color relationships from the reference. Shape language: heavy rounding creates organic, friendly forms. Depth system: dual shadows (inner and outer) create puffy, three-dimensional appearance. Typography system: rounded, friendly sans-serif that complements the soft aesthetic. Interaction model: buttons that invert shadows when pressed create tactile feedback. Visual hierarchy: depth through extrusion, not harsh contrast. Avoid: hard edges, harsh contrast, dark heavy lines. Emotional tone: soft, friendly, approachable, toy-like. Match the reference image's gentle, tactile mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a claymorphism-style interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "vercel",
    label: "Vercel",
    description:
      "Ultra-minimal, high-contrast design with sharp typography, strong blacks and whites, and focus on speed. Clean geometric precision.",
    imageUrl: "/vercel-collage.png",
    darkImageUrl: "/vercel-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/vercel-thumbnail-light.jpeg",
    darkThumbnailUrl: "/preset-thumbnails/vercel-thumbnail-dark.png",
    prompt: `Design System: Vercel aesthetic. Core principle: speed and precision through extreme minimalism. Color philosophy: maximum contrast creates clarity; use pure blacks and whites with strategic accent colors for status. Typography system: geometric sans-serif with tight spacing for technical precision; monospace for code to signal technicality. Shape language: sharp, geometric forms communicate precision; minimal rounding. Depth system: borders and contrast create hierarchy, not shadows—avoid decorative depth. Layout principle: generous whitespace lets information breathe. Visual hierarchy: clear, unambiguous information architecture. Interaction model: instant, no-nonsense feedback. Technical indicators: use color coding systematically for status. Match the reference image's theme mode and precision-focused mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Vercel-style deployment platform interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "modern-minimal",
    label: "Modern Minimal",
    description:
      "Generous whitespace, subtle shadows, clean typography, and a focus on content over decoration.",
    imageUrl: "/Modern-minimal.png",
    thumbnailUrl: "/Modern-minimal.png", // Fallback to collage if no thumbnail exists
    prompt: `Design System: Modern Minimal aesthetic. Core principle: clarity through reduction—let content shine by removing unnecessary decoration. Color philosophy: neutral base with strategic accent colors for emphasis—extract color relationships from the reference. Typography system: clear type scale with bold headings and readable body text. Layout principle: consistent spacing grid creates rhythm and organization. Depth system: systematic elevation levels create hierarchy without randomness. Shape language: moderate rounding maintains friendliness without softness. Interaction model: subtle hover states and smooth transitions provide feedback. Visual hierarchy: spacing and elevation create structure, not decoration. Avoid: inconsistent spacing, random shadow depths, excessive colors. Emotional tone: clean, organized, content-focused, timeless. Match the reference image's minimal, refined mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a modern minimal-style interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "linear",
    label: "Linear",
    description:
      "Sleek, fast, keyboard-first design with purple accents, crisp typography, and sophisticated dark mode. Minimal friction, maximum productivity.",
    imageUrl: "/linear-collage.png",
    darkImageUrl: "/linear-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/linear-thumbnail-light.png",
    darkThumbnailUrl: "/preset-thumbnails/linear-thumbnail-dark.png",
    prompt: `Design System: Linear aesthetic. Core principle: speed and efficiency through minimal friction. Color philosophy: clean, neutral base with strategic accent colors for actions and status—extract color relationships from the reference. Typography system: crisp, readable sans-serif optimized for scanning and speed. Shape language: precise, slightly rounded edges that feel modern without being soft. Depth system: borders and spacing create hierarchy, not shadows—minimal visual noise. Layout principle: information-dense but scannable; every pixel serves a purpose. Status system: color-coded indicators provide instant context. Interaction model: instant feedback, keyboard-first navigation patterns. Visual hierarchy: clear, unambiguous structure that guides without decoration. Match the reference image's theme mode and productivity-focused mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Linear-style project management interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "hey",
    label: "Hey.com",
    description:
      "Opinionated email client with bold typography, strong opinions in design, feed-like inbox, and focus on the important.",
    imageUrl: "/hey-collage.png",
    darkImageUrl: "/hey-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/hey-thumbnail-light.png",
    darkThumbnailUrl: "/preset-thumbnails/hey-thumbnail-dark.png",
    prompt: `Design System: Hey Email aesthetic. Core principle: strong opinions create clarity through confident design choices. Color philosophy: warm, inviting tones with strategic amber accents for emphasis—extract color relationships from the reference. Typography system: bold, confident weights that feel authoritative without being aggressive. Layout principle: clear separation through thick dividers; generous spacing prevents clutter. Visual hierarchy: important information stands out through color and weight, not decoration. Interaction model: clear, unambiguous states; emoji reactions add personality. Shape language: moderate rounding maintains structure while feeling approachable. Emotional tone: opinionated, organized, optimized for clarity and efficiency. Match the reference image's theme mode and confident mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Hey Email-style email client interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "retro-y2k",
    label: "Retro/Y2K",
    description:
      "Late 90s/early 2000s aesthetic with chrome effects, vibrant gradients, pixelated elements, bold typography, and playful digital artifacts. Attention-grabbing and nostalgic with Gen-Z appeal.",
    imageUrl: "/retro.png",
    thumbnailUrl: "/retro.png", // Fallback to collage if no thumbnail exists
    prompt: `Design System: Retro/Y2K aesthetic. Core principle: embrace maximalism and nostalgia through attention-grabbing, energetic design. Color philosophy: vibrant, high-saturation colors with chrome effects and multi-stop gradients—extract color relationships from the reference. Typography system: bold, thick-stroke fonts that command attention. Visual effects: metallic sheens, rainbow gradients, pixelated elements, glow effects create digital artifacts. Shape language: thick rounded borders with gradient fills create playful, expressive forms. Layout principle: layered effects and energetic compositions embrace chaos. Decorative elements: stars, sparkles, and digital artifacts add personality. Interaction model: effects that feel alive and responsive. Avoid: minimalism, subtlety, restraint. Emotional tone: attention-grabbing, nostalgic, Gen-Z appealing, energetic. Match the reference image's retro-futuristic, maximalist mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Retro/Y2K-style interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "arc",
    label: "Arc Browser",
    description:
      "Colorful, personality-driven browser UI with sidebar navigation, vibrant tabs, playful interactions, and customizable themes.",
    imageUrl: "/arc-collage.png",
    darkImageUrl: "/arc-collage-dark.png",
    thumbnailUrl: "/preset-thumbnails/arc-thumbnail-light.png",
    darkThumbnailUrl: "/preset-thumbnails/arc-thumbnail-dark.jpeg",
    prompt: `Design System: Arc Browser aesthetic. Core principle: personality-driven, playful, and modern. Color philosophy: vibrant, customizable gradients that express brand identity—use the reference image's color relationships, not exact hex values. Typography system: medium-weight sans-serif that feels approachable yet professional. Shape language: generous rounding creates friendliness; depth through subtle elevation, not harsh shadows. Interaction model: smooth, fluid animations that feel responsive and alive. Visual hierarchy: content-first with personality expressed through color and motion, not decoration. Match the reference image's theme mode and overall mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to an Arc Browser-style interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
  {
    id: "pitch",
    label: "Pitch",
    description:
      "Presentation software with collaborative editing, beautiful templates, smart layouts, and design-forward slide creation.",
    imageUrl: "/pitch-collage.png",
    thumbnailUrl: "/preset-thumbnails/pitch-thumbnail-light.png",
    prompt: `Design System: Pitch aesthetic. Core principle: make beautiful presentations accessible through smart design and collaboration. Color philosophy: clean, neutral backgrounds let content shine; strategic accent colors for actions—extract color relationships from the reference. Typography system: modern sans-serif that balances readability with style. Layout principle: floating elements create depth; collaborative cues make teamwork visible. Visual hierarchy: subtle elevation separates content layers; gradients and imagery inspire creativity. Interaction model: smooth transitions that feel polished and responsive. Collaboration system: visual indicators (avatars, colors) make team presence clear. Shape language: moderate rounding maintains friendliness and modernity. Emotional tone: creative, collaborative, optimized for beautiful, shareable work. Match the reference image's presentation-focused, creative mood. IMPORTANT: If the user specifies an app type, design that app using this visual system. If unspecified, default to a Pitch-style presentation interface. The user's request always overrides the preset's functionality—this preset only determines visual style.`,
  },
];
