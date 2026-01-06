"use client";

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search,
  FileText,
  Eye,
  Zap,
  Loader2,
  CheckCircle,
  AlertCircle,
  Monitor,
  TrendingUp,
  X,
  MessageSquare,
  Lightbulb,
  ArrowRight,
  Play,
  Target,
  Users,
  Code,
  Palette,
  Zap as ZapIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  halAssistantOpenAtom,
  halAssistantHasNewDeliverableAtom,
  halAssistantActiveTabAtom,
  halAssistantHasResultsAtom,
  setHalAssistantHasNewDeliverableAtom,
} from "@/lib/hal-assistant-state";

interface AnalysisResult {
  type: string;
  analysis: string;
  timestamp: string;
}

interface ProjectAnalysisAssistantProps {
  projectId: string;
  projectFiles: { [path: string]: string } | null;
  isSandboxReady: boolean;
  isGenerationActive?: boolean;
  hasNewDeliverable?: boolean;
}

const ANALYSIS_TYPES = [
  {
    key: "seo",
    label: "SEO & Content",
    description:
      "Page titles, meta descriptions, heading structure, content optimization, internal linking, image alt text, URL structure, content readability",
    icon: Search,
    color: "bg-blue-500",
  },
  {
    key: "copy",
    label: "Copywriting",
    description:
      "Headlines, value propositions, CTAs, product descriptions, social proof, brand voice, content clarity and persuasiveness",
    icon: FileText,
    color: "bg-green-500",
  },
  {
    key: "accessibility",
    label: "Accessibility",
    description:
      "Semantic HTML, ARIA labels, color contrast, keyboard navigation, screen reader compatibility, focus management, alternative text",
    icon: Eye,
    color: "bg-purple-500",
  },
  {
    key: "performance",
    label: "Performance",
    description:
      "Code optimization, image optimization, bundle size, lazy loading, caching, critical rendering path, mobile performance",
    icon: Zap,
    color: "bg-orange-500",
  },
];

// Proactive advisor suggestions based on project state
const getProactiveSuggestions = (projectState: string) => {
  switch (projectState) {
    case "new-project":
      return [
        {
          icon: Target,
          label: "Define your project goals and target audience",
          action: "plan",
        },
        {
          icon: Palette,
          label: "Choose a design theme and brand voice",
          action: "theme",
        },
        {
          icon: Code,
          label: "Start building core features and structure",
          action: "build",
        },
        {
          icon: Users,
          label: "Plan user experience and navigation flow",
          action: "ux",
        },
      ];
    case "building":
      return [
        {
          icon: Search,
          label: "Optimize for search engines (SEO)",
          action: "seo",
        },
        {
          icon: FileText,
          label: "Improve copywriting and messaging",
          action: "copy",
        },
        {
          icon: Eye,
          label: "Ensure accessibility compliance",
          action: "accessibility",
        },
        {
          icon: Zap,
          label: "Optimize performance and speed",
          action: "performance",
        },
      ];
    case "testing":
      return [
        {
          icon: CheckCircle,
          label: "Run comprehensive performance tests",
          action: "performance",
        },
        {
          icon: Users,
          label: "Get user feedback and usability insights",
          action: "user-testing",
        },
        { icon: Search, label: "Validate SEO implementation", action: "seo" },
        {
          icon: Eye,
          label: "Test accessibility across devices",
          action: "accessibility",
        },
      ];
    case "completed":
      return [
        {
          icon: Search,
          label: "Final SEO optimization and keyword targeting",
          action: "seo",
        },
        {
          icon: FileText,
          label: "Polish copywriting and brand messaging",
          action: "copy",
        },
        {
          icon: Zap,
          label: "Performance optimization and monitoring",
          action: "performance",
        },
        {
          icon: TrendingUp,
          label: "Add analytics and conversion tracking",
          action: "analytics",
        },
      ];
    default:
      return [
        {
          icon: Lightbulb,
          label: "Get comprehensive project insights",
          action: "analyze",
        },
        {
          icon: Target,
          label: "Set clear development goals and priorities",
          action: "plan",
        },
        {
          icon: Code,
          label: "Review current progress and identify gaps",
          action: "review",
        },
        {
          icon: Users,
          label: "Plan user experience and engagement",
          action: "ux",
        },
      ];
  }
};

export function ProjectAnalysisAssistant({
  projectId,
  projectFiles,
  isSandboxReady,
  isGenerationActive = false,
  hasNewDeliverable = false,
}: ProjectAnalysisAssistantProps) {
  const [selectedType, setSelectedType] = useState<string>("seo");
  const [customContext, setCustomContext] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [activeTab, setActiveTab] = useAtom(halAssistantActiveTabAtom);
  const [isOpen, setIsOpen] = useAtom(halAssistantOpenAtom);
  const [hasResults, setHasResults] = useAtom(halAssistantHasResultsAtom);
  const [showProactiveNotification, setShowProactiveNotification] =
    useState(false);
  const [projectState, setProjectState] = useState<string>("new-project");

  // Proactive notification logic
  useEffect(() => {
    if (hasNewDeliverable && !isOpen) {
      setShowProactiveNotification(true);
      // Auto-hide after 8 seconds
      const timer = setTimeout(() => setShowProactiveNotification(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [hasNewDeliverable, isOpen]);

  // Sync hasNewDeliverable with Jotai state
  const [, setHasNewDeliverable] = useAtom(
    setHalAssistantHasNewDeliverableAtom
  );

  useEffect(() => {
    setHasNewDeliverable(hasNewDeliverable);
  }, [hasNewDeliverable, setHasNewDeliverable]);

  // Update project state based on conditions
  useEffect(() => {
    if (isGenerationActive) {
      setProjectState("building");
    } else if (hasResults && analysisResults.length > 0) {
      setProjectState("completed");
    } else if (isSandboxReady && projectFiles) {
      setProjectState("testing");
    } else {
      setProjectState("new-project");
    }
  }, [
    isGenerationActive,
    hasResults,
    analysisResults.length,
    isSandboxReady,
    projectFiles,
  ]);

  const handleAnalysis = async () => {
    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      toast.error("No project files available for analysis");
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          type: selectedType,
          context: customContext.trim() || undefined,
          files: projectFiles,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Analysis failed");
      }

      const result = await response.json();

      setAnalysisResults((prev) => [
        {
          type: selectedType,
          analysis: result.analysis,
          timestamp: result.timestamp,
        },
        ...prev,
      ]);

      setHasResults(true);
      setActiveTab("results");

      toast.success(
        `${
          ANALYSIS_TYPES.find((t) => t.key === selectedType)?.label
        } analysis completed!`
      );
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getAnalysisTypeInfo = (type: string) => {
    return ANALYSIS_TYPES.find((t) => t.key === type) || ANALYSIS_TYPES[0];
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleProactiveAction = (action: string) => {
    // Handle different proactive actions
    switch (action) {
      case "plan":
        setActiveTab("analyze");
        setCustomContext(
          "Help me plan the next development phase and set clear goals for SEO, accessibility, and performance optimization"
        );
        break;
      case "theme":
        setActiveTab("analyze");
        setSelectedType("copy");
        setCustomContext(
          "Help me choose and implement a design theme that matches my brand voice and messaging strategy"
        );
        break;
      case "build":
        setActiveTab("analyze");
        setSelectedType("performance");
        setCustomContext(
          "Help me identify the most important features to build next and ensure they follow best practices for performance and accessibility"
        );
        break;
      case "ux":
        setActiveTab("analyze");
        setSelectedType("accessibility");
        setCustomContext(
          "Help me plan user experience and navigation flow that's accessible to all users and optimized for search engines"
        );
        break;
      case "seo":
        setActiveTab("analyze");
        setSelectedType("seo");
        setCustomContext(
          "Help me optimize my website for search engines with proper page titles, meta descriptions, heading structure, and content optimization"
        );
        break;
      case "copy":
        setActiveTab("analyze");
        setSelectedType("copy");
        setCustomContext(
          "Help me improve my copywriting with better headlines, value propositions, CTAs, and brand voice consistency"
        );
        break;
      case "accessibility":
        setActiveTab("analyze");
        setSelectedType("accessibility");
        setCustomContext(
          "Help me ensure my website is accessible to all users with proper semantic HTML, ARIA labels, and keyboard navigation"
        );
        break;
      case "performance":
        setActiveTab("analyze");
        setSelectedType("performance");
        setCustomContext(
          "Help me optimize my website's performance with code optimization, image optimization, and caching strategies"
        );
        break;
      case "user-testing":
        setActiveTab("analyze");
        setSelectedType("accessibility");
        setCustomContext(
          "Help me get user feedback and usability insights to improve accessibility and user experience"
        );
        break;
      case "analytics":
        setActiveTab("analyze");
        setSelectedType("seo");
        setCustomContext(
          "Help me add analytics and conversion tracking to measure SEO performance and user engagement"
        );
        break;
      default:
        setActiveTab("analyze");
    }
    setIsOpen(true);
  };

  // Proactive notification - show as a small indicator on the header button
  if (showProactiveNotification && !isOpen) {
    return (
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-2xl border-2 border-blue-400 p-3 max-w-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium">HAL has a suggestion!</span>
            <Button
              size="sm"
              onClick={() => setIsOpen(true)}
              className="bg-white text-blue-700 hover:bg-blue-50 text-xs px-2 py-1 h-6 ml-auto"
            >
              <Play className="h-3 w-3 mr-1" />
              View
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No floating button needed when closed since HAL is now in the header
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-h-[80vh] overflow-hidden">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-200 overflow-hidden">
        {/* HAL Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-4 py-4 relative">
          {/* HAL Eye in Header */}
          <div className="absolute top-3 left-4">
            <div className="w-10 h-10 bg-blue-900 rounded-full border-2 border-blue-300 flex items-center justify-center">
              <div className="w-7 h-7 bg-blue-700 rounded-full border border-blue-200 flex items-center justify-center">
                <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>

          <div className="ml-16">
            <h2 className="font-bold text-xl">HAL</h2>
            <p className="text-blue-100 text-sm flex items-center gap-2">
              {activeTab === "analyze" && selectedType ? (
                <>
                  {(() => {
                    const Icon = ANALYSIS_TYPES.find(
                      (t) => t.key === selectedType
                    )?.icon;
                    return Icon ? <Icon className="h-4 w-4" /> : null;
                  })()}
                  {ANALYSIS_TYPES.find((t) => t.key === selectedType)?.label}{" "}
                  Analysis
                </>
              ) : (
                "Your AI Development Advisor"
              )}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="absolute top-3 right-3 text-white hover:bg-blue-500 p-1 rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 h-9 mb-4">
              <TabsTrigger value="advisor" className="text-xs">
                Advisor
              </TabsTrigger>
              <TabsTrigger value="analyze" className="text-xs">
                Analyze
              </TabsTrigger>
              <TabsTrigger
                value="results"
                className="text-xs"
                disabled={!hasResults}
              >
                Results
              </TabsTrigger>
            </TabsList>

            {/* Proactive Advisor Tab */}
            <TabsContent value="advisor" className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lightbulb className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  What would you like to do next?
                </h3>
                <p className="text-gray-600 text-sm">
                  HAL is here to guide you through your development journey
                </p>
              </div>

              <div className="space-y-3">
                {getProactiveSuggestions(projectState).map(
                  (suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      onClick={() => handleProactiveAction(suggestion.action)}
                      className="w-full justify-start text-left h-auto p-3 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-blue-200 hover:border-blue-300 transition-all duration-200"
                    >
                      <suggestion.icon className="h-5 w-5 text-blue-600 mr-3" />
                      <span className="text-sm font-medium text-blue-900">
                        {suggestion.label}
                      </span>
                      <ArrowRight className="h-4 w-4 text-blue-500 ml-auto" />
                    </Button>
                  )
                )}
              </div>

              <div className="pt-3 border-t border-gray-200">
                <Button
                  onClick={() => setActiveTab("analyze")}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <Code className="h-4 w-4 mr-2" />
                  Deep Code Analysis
                </Button>
              </div>
            </TabsContent>

            {/* Analysis Tab */}
            <TabsContent value="analyze" className="space-y-4">
              {!isSandboxReady ||
              !projectFiles ||
              Object.keys(projectFiles).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    {!isSandboxReady
                      ? "Wait for your sandbox to be ready before running analysis"
                      : "No project files available for analysis"}
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      What would you like me to analyze?
                    </Label>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {ANALYSIS_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                          <Button
                            key={type.key}
                            variant={
                              selectedType === type.key ? "default" : "outline"
                            }
                            className="h-auto p-3 flex flex-col items-center gap-2 text-xs"
                            onClick={() => setSelectedType(type.key)}
                          >
                            <div
                              className={`w-2 h-2 rounded-full ${type.color}`}
                            />
                            <Icon className="h-4 w-4" />
                            <div className="text-center">
                              <div className="font-medium">{type.label}</div>
                            </div>
                          </Button>
                        );
                      })}
                    </div>

                    {/* Show detailed description for selected analysis type */}
                    {selectedType && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              ANALYSIS_TYPES.find((t) => t.key === selectedType)
                                ?.color
                            } mt-1`}
                          />
                          <div className="flex-1">
                            <h4 className="font-medium text-blue-900 text-sm mb-1">
                              {
                                ANALYSIS_TYPES.find(
                                  (t) => t.key === selectedType
                                )?.label
                              }
                            </h4>
                            <p className="text-blue-700 text-xs leading-relaxed">
                              {
                                ANALYSIS_TYPES.find(
                                  (t) => t.key === selectedType
                                )?.description
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="context"
                      className="text-sm font-medium text-gray-700 mb-2 block"
                    >
                      Any specific context or goals?
                    </Label>
                    <Textarea
                      id="context"
                      placeholder={
                        selectedType === "seo"
                          ? "e.g., Target keywords, business goals, specific SEO improvements..."
                          : selectedType === "copy"
                          ? "e.g., Brand voice, target audience, conversion goals..."
                          : selectedType === "accessibility"
                          ? "e.g., User needs, compliance requirements, specific accessibility issues..."
                          : selectedType === "performance"
                          ? "e.g., Performance goals, target devices, specific optimization areas..."
                          : "e.g., Target audience, business goals, specific improvements..."
                      }
                      value={customContext}
                      onChange={(e) => setCustomContext(e.target.value)}
                      className="text-sm"
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <TrendingUp className="h-3 w-3" />
                    <span>This analysis will cost 1 credit</span>
                  </div>

                  <Button
                    onClick={handleAnalysis}
                    disabled={isAnalyzing}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Monitor className="h-4 w-4 mr-2" />
                        Let HAL Analyze{" "}
                        {selectedType &&
                          `(${
                            ANALYSIS_TYPES.find((t) => t.key === selectedType)
                              ?.label
                          })`}
                      </>
                    )}
                  </Button>
                </>
              )}
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Analysis Results
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHasResults(false);
                    setActiveTab("advisor");
                  }}
                  className="text-xs"
                >
                  New Analysis
                </Button>
              </div>

              <div className="space-y-3">
                {analysisResults.map((result, index) => {
                  const typeInfo = getAnalysisTypeInfo(result.type);
                  const Icon = typeInfo.icon;

                  return (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm">
                          {typeInfo.label}
                        </span>
                        <Badge variant="secondary" className="text-xs ml-auto">
                          {result.type.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-700 line-clamp-4">
                        {result.analysis}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {formatTimestamp(result.timestamp)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
