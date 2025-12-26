import { createAgent, createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { createAzureOpenAIModel } from "@/helpers/createAzureOpenAIModel";
import { MultiAgentState } from "@/inngest/multi-agent-workflow";
import { ENHANCED_CONTEXT_ANALYZER_PROMPT } from "@/lib/prompts/CONTEXT_ANALYZER";
// Enhanced project analysis schema with validation
const ProjectAnalysisSchema = z.object({
  projectType: z.enum([
    "productivity",
    "e-commerce",
    "dashboard",
    "social",
    "portfolio",
    "blog",
    "landing",
    "saas",
    "other",
  ]),
  complexity: z.enum(["simple", "moderate", "complex"]),
  targetAudience: z.string().min(10, "Target audience must be specific"),
  keyFeatures: z.array(z.string()).min(3, "At least 3 key features required"),
  dataEntities: z.array(z.string()).min(1, "At least 1 data entity required"),
  userFlows: z.array(z.string()).min(2, "At least 2 user flows required"),
  techRequirements: z
    .array(z.string())
    .min(2, "At least 2 tech requirements needed"),
  designDirection: z.string().min(20, "Design direction must be detailed"),
  businessLogic: z.array(z.string()).min(1, "Business logic rules required"),
  integrations: z.array(z.string()).optional(),
  performance: z.array(z.string()).optional(),
});

// Phase advancement validation schema
const PhaseAdvancementSchema = z.object({
  currentPhase: z.enum(["analysis", "build", "verify", "done"]),
  nextPhase: z.enum(["build", "verify", "done"]),
  validationChecks: z
    .array(z.string())
    .min(3, "At least 3 validation checks required"),
  confidence: z.number().min(0.8, "Confidence must be at least 80%"),
  reason: z.string().min(50, "Detailed reason for advancement required"),
});

export const enhancedContextAnalyzer = createAgent<MultiAgentState>({
  name: "enhanced-context-analyzer",
  description:
    "Advanced project analyst with structured analysis and validation",
  system: ENHANCED_CONTEXT_ANALYZER_PROMPT,

  model: createAzureOpenAIModel("gpt-4.1"),

  tools: [
    // Step 1: Requirements Analysis
    createTool({
      name: "analyzeRequirements",
      description: "Extract and analyze user requirements from input",
      parameters: z.object({
        userIntent: z.string().min(20, "User intent must be detailed"),
        projectScope: z.enum(["mvp", "full-featured", "enterprise"]),
        constraints: z.array(z.string()).optional(),
        assumedFeatures: z.array(z.string()).optional(),
        clarificationsNeeded: z.array(z.string()).optional(),
      }),
      handler: async (
        {
          userIntent,
          projectScope,
          constraints,
          assumedFeatures,
          clarificationsNeeded,
        },
        { network }
      ) => {
        // Initialize analysis state
        if (!network.state.data.projectAnalysis) {
          network.state.data.projectAnalysis = {
            projectType: "",
            complexity: "simple",
            targetAudience: "",
            keyFeatures: [],
            dataEntities: [],
            userFlows: [],
            techRequirements: [],
            designDirection: "",
          };
        }

        // Store requirements analysis
        (network.state.data as any).requirementsAnalysis = {
          userIntent,
          projectScope,
          constraints: constraints || [],
          assumedFeatures: assumedFeatures || [],
          clarificationsNeeded: clarificationsNeeded || [],
        };

        return `✅ Requirements analyzed: ${userIntent.slice(
          0,
          100
        )}... | Scope: ${projectScope}`;
      },
    }),

    // Step 2: Project Classification
    createTool({
      name: "classifyProject",
      description: "Classify project type and complexity",
      parameters: z.object({
        projectType: z.enum([
          "productivity",
          "e-commerce",
          "dashboard",
          "social",
          "portfolio",
          "blog",
          "landing",
          "saas",
          "other",
        ]),
        complexity: z.enum(["simple", "moderate", "complex"]),
        targetAudience: z.string().min(10),
        reasoning: z.string().min(50, "Detailed reasoning required"),
      }),
      handler: async (
        { projectType, complexity, targetAudience, reasoning },
        { network }
      ) => {
        network.state.data.projectAnalysis.projectType = projectType;
        network.state.data.projectAnalysis.complexity = complexity;
        network.state.data.projectAnalysis.targetAudience = targetAudience;

        (network.state.data as any).classificationReasoning = reasoning;

        return `✅ Project classified: ${projectType} | Complexity: ${complexity} | Audience: ${targetAudience}`;
      },
    }),

    // Step 3: Feature Definition
    createTool({
      name: "defineFeatures",
      description: "Define core features and user flows",
      parameters: z.object({
        keyFeatures: z.array(z.string()).min(3),
        userFlows: z.array(z.string()).min(2),
        businessLogic: z.array(z.string()).min(1),
        dataEntities: z.array(z.string()).min(1),
        featurePriority: z.enum(["high", "medium", "low"]).optional(),
      }),
      handler: async (
        {
          keyFeatures,
          userFlows,
          businessLogic,
          dataEntities,
          featurePriority,
        },
        { network }
      ) => {
        network.state.data.projectAnalysis.keyFeatures = keyFeatures;
        network.state.data.projectAnalysis.userFlows = userFlows;
        network.state.data.projectAnalysis.dataEntities = dataEntities;

        (network.state.data as any).businessLogic = businessLogic;
        (network.state.data as any).featurePriority = featurePriority || "high";

        return `✅ Features defined: ${keyFeatures.length} features, ${userFlows.length} user flows, ${dataEntities.length} entities`;
      },
    }),

    // Step 4: Technical Architecture Planning
    createTool({
      name: "planTechnicalArchitecture",
      description: "Plan technical architecture and requirements",
      parameters: z.object({
        techRequirements: z.array(z.string()).min(2),
        designDirection: z.string().min(20),
        stateManagement: z.enum(["useState", "useContext", "jotai"]),
        styling: z.enum([
          "tailwind",
          "css-modules",
          "styled-components",
          "emotion",
        ]),
        routing: z.enum(["react-router", "reach-router", "none"]),
        buildOptimizations: z.array(z.string()).optional(),
      }),
      handler: async (
        {
          techRequirements,
          designDirection,
          stateManagement,
          styling,
          routing,
          buildOptimizations,
        },
        { network }
      ) => {
        network.state.data.projectAnalysis.techRequirements = techRequirements;
        network.state.data.projectAnalysis.designDirection = designDirection;

        (network.state.data as any).technicalArchitecture = {
          stateManagement,
          styling,
          routing,
          buildOptimizations: buildOptimizations || [],
        };

        return `✅ Technical architecture planned: ${stateManagement} + ${styling} + ${routing}`;
      },
    }),

    // Step 5: Analysis Validation
    createTool({
      name: "validateAnalysis",
      description: "Validate analysis completeness before advancing",
      parameters: z.object({
        completenessScore: z.number().min(0).max(1),
        validationChecks: z.array(z.string()).min(5),
        missingElements: z.array(z.string()).optional(),
        confidence: z.number().min(0.8, "Must be at least 80% confident"),
        readyToAdvance: z.boolean(),
      }),
      handler: async (
        {
          completenessScore,
          validationChecks,
          missingElements,
          confidence,
          readyToAdvance,
        },
        { network }
      ) => {
        (network.state.data as any).analysisValidation = {
          completenessScore,
          validationChecks,
          missingElements: missingElements || [],
          confidence,
          readyToAdvance,
          timestamp: new Date().toISOString(),
        };

        return `✅ Analysis validated: ${(completenessScore * 100).toFixed(
          0
        )}% complete | Confidence: ${(confidence * 100).toFixed(
          0
        )}% | Ready: ${readyToAdvance}`;
      },
    }),

    // Step 6: Phase Advancement (only after validation)
    createTool({
      name: "markAnalysisComplete",
      description: "Mark analysis as complete - MANDATORY to call",
      parameters: z.object({
        summary: z.string(),
      }),
      handler: async ({ summary }, { network }) => {
        network.state.data.analysisComplete = true;
        network.state.data.summary = summary;
        console.log(`[Analyzer] ✅ ANALYSIS COMPLETE`);
        return `✅ Analysis phase complete: ${summary}`;
      },
    }),
  ],
});
