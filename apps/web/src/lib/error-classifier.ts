import { ErrorType, ErrorSeverity } from "@/lib/db";
import type { ProjectErrors, ProjectError } from "./error-detector";

export interface ErrorCategory {
  quickFix: ProjectError[]; // Simple imports, typos, basic fixes
  mediumFix: ProjectError[]; // Missing components, logic fixes, moderate complexity
  complexFix: ProjectError[]; // Architecture changes, major refactoring
  unfixable: ProjectError[]; // Requires human intervention
}

export interface FixStrategy {
  type: "quick" | "medium" | "complex" | "unfixable";
  estimatedTime: number; // in seconds
  confidence: number; // 0-1, likelihood of success
  description: string;
  examples: string[];
}

export interface ClassificationResult {
  categories: ErrorCategory;
  strategies: FixStrategy[];
  overallComplexity: "simple" | "moderate" | "complex" | "impossible";
  estimatedFixTime: number; // total estimated time in seconds
  successConfidence: number; // 0-1, overall confidence in auto-fix success
  recommendedApproach: "auto-fix" | "manual-review" | "hybrid";
}

export class ErrorClassifier {
  /**
   * Main entry point for error classification
   * Categorizes errors by fix complexity and provides fix strategies
   */
  static categorizeErrors(errors: ProjectErrors): ClassificationResult {
    console.log("[ErrorClassifier] Classifying errors by fix complexity...");

    const categories: ErrorCategory = {
      quickFix: [],
      mediumFix: [],
      complexFix: [],
      unfixable: [],
    };

    // Categorize all errors
    const allErrors = [
      ...errors.buildErrors,
      ...errors.importErrors,
      ...errors.navigationErrors,
    ];

    for (const error of allErrors) {
      const category = this.classifyError(error);
      categories[category].push(error);
    }

    // Generate fix strategies
    const strategies = this.generateFixStrategies(categories);

    // Calculate overall metrics
    const overallComplexity = this.determineOverallComplexity(categories);
    const estimatedFixTime = this.calculateEstimatedFixTime(categories);
    const successConfidence = this.calculateSuccessConfidence(
      categories,
      strategies
    );
    const recommendedApproach = this.recommendApproach(
      categories,
      successConfidence
    );

    const result: ClassificationResult = {
      categories,
      strategies,
      overallComplexity,
      estimatedFixTime,
      successConfidence,
      recommendedApproach,
    };

    console.log(
      `[ErrorClassifier] Classification complete: ${overallComplexity} complexity, ${estimatedFixTime}s estimated`
    );

    return result;
  }

  /**
   * Classify individual error by fix complexity
   */
  private static classifyError(error: ProjectError): keyof ErrorCategory {
    // Quick fixes - simple, low-risk changes
    if (this.isQuickFix(error)) {
      return "quickFix";
    }

    // Medium fixes - moderate complexity, some risk
    if (this.isMediumFix(error)) {
      return "mediumFix";
    }

    // Complex fixes - high complexity, significant risk
    if (this.isComplexFix(error)) {
      return "complexFix";
    }

    // Unfixable - requires human intervention
    return "unfixable";
  }

  /**
   * Determine if error is a quick fix
   */
  private static isQuickFix(error: ProjectError): boolean {
    // Simple import fixes
    if (error.type === ErrorType.IMPORT) {
      const importError = error as any;
      return (
        importError.importPath.includes("@/lib/store") ||
        importError.importPath.includes("@/lib/types") ||
        importError.importPath.includes("@/components/ui/")
      );
    }

    // Simple ESLint fixes
    if (error.type === ErrorType.ESLINT) {
      const ruleId = error.details.ruleId;
      if (ruleId) {
        const quickFixRules = [
          "prefer-const",
          "no-var",
          "no-unused-vars",
          "no-console",
          "prefer-template",
        ];
        return quickFixRules.some((rule) => ruleId.includes(rule));
      }
    }

    // Simple TypeScript fixes
    if (error.type === ErrorType.TYPE_SCRIPT) {
      const errorCode = error.details.errorCode;
      if (errorCode) {
        const quickFixCodes = ["TS2304"]; // Cannot find name (can add imports)
        return quickFixCodes.includes(errorCode);
      }
    }

    // Simple navigation fixes
    if (error.type === ErrorType.NAVIGATION) {
      return (
        error.severity === ErrorSeverity.LOW ||
        error.severity === ErrorSeverity.MEDIUM
      );
    }

    return false;
  }

  /**
   * Determine if error is a medium complexity fix
   */
  private static isMediumFix(error: ProjectError): boolean {
    // Missing component files
    if (error.type === ErrorType.IMPORT) {
      const importError = error as any;
      return (
        importError.importPath.includes("@/components/") ||
        importError.importPath.includes("@/lib/")
      );
    }

    // TypeScript type errors
    if (error.type === ErrorType.TYPE_SCRIPT) {
      const errorCode = error.details.errorCode;
      if (errorCode) {
        const mediumFixCodes = ["TS2339", "TS2322"]; // Property doesn't exist, type assignment
        return mediumFixCodes.includes(errorCode);
      }
    }

    // ESLint rules requiring code changes
    if (error.type === ErrorType.ESLINT) {
      const ruleId = error.details.ruleId;
      if (ruleId) {
        const mediumFixRules = [
          "react-hooks/exhaustive-deps",
          "@typescript-eslint/no-explicit-any",
          "prefer-const",
        ];
        return mediumFixRules.some((rule) => ruleId.includes(rule));
      }
    }

    // Navigation fixes requiring page creation
    if (error.type === ErrorType.NAVIGATION) {
      return error.severity === ErrorSeverity.HIGH;
    }

    return false;
  }

  /**
   * Determine if error is a complex fix
   */
  private static isComplexFix(error: ProjectError): boolean {
    // Complex TypeScript errors
    if (error.type === ErrorType.TYPE_SCRIPT) {
      const errorCode = error.details.errorCode;
      if (errorCode) {
        const complexFixCodes = ["TS2345", "TS2307"]; // Type compatibility, module resolution
        return complexFixCodes.includes(errorCode);
      }
    }

    // Complex ESLint rules
    if (error.type === ErrorType.ESLINT) {
      const ruleId = error.details.ruleId;
      if (ruleId) {
        const complexFixRules = [
          "no-undef",
          "react/jsx-key",
          "@typescript-eslint/no-unused-vars",
        ];
        return complexFixRules.some((rule) => ruleId.includes(rule));
      }
    }

    // High severity errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      return true;
    }

    return false;
  }

  /**
   * Generate fix strategies based on error categories
   */
  private static generateFixStrategies(
    categories: ErrorCategory
  ): FixStrategy[] {
    const strategies: FixStrategy[] = [];

    if (categories.quickFix.length > 0) {
      strategies.push({
        type: "quick",
        estimatedTime: categories.quickFix.length * 5, // 5 seconds per quick fix
        confidence: 0.95,
        description:
          "Simple automated fixes for imports, typos, and basic issues",
        examples: [
          "Add missing import statements",
          "Fix simple ESLint violations",
          "Correct basic TypeScript errors",
          "Update navigation links",
        ],
      });
    }

    if (categories.mediumFix.length > 0) {
      strategies.push({
        type: "medium",
        estimatedTime: categories.mediumFix.length * 15, // 15 seconds per medium fix
        confidence: 0.8,
        description:
          "Moderate complexity fixes requiring code generation or modification",
        examples: [
          "Create missing component files",
          "Fix TypeScript type definitions",
          "Generate missing page components",
          "Resolve import path issues",
        ],
      });
    }

    if (categories.complexFix.length > 0) {
      strategies.push({
        type: "complex",
        estimatedTime: categories.complexFix.length * 30, // 30 seconds per complex fix
        confidence: 0.6,
        description:
          "Complex fixes requiring architectural changes or significant refactoring",
        examples: [
          "Refactor component architecture",
          "Fix complex type compatibility issues",
          "Resolve dependency conflicts",
          "Restructure project layout",
        ],
      });
    }

    if (categories.unfixable.length > 0) {
      strategies.push({
        type: "unfixable",
        estimatedTime: 0,
        confidence: 0.0,
        description: "Errors requiring human intervention or manual review",
        examples: [
          "Business logic errors",
          "Design system conflicts",
          "Complex architectural decisions",
          "Custom implementation requirements",
        ],
      });
    }

    return strategies;
  }

  /**
   * Determine overall complexity of the error set
   */
  private static determineOverallComplexity(
    categories: ErrorCategory
  ): "simple" | "moderate" | "complex" | "impossible" {
    const totalErrors =
      categories.quickFix.length +
      categories.mediumFix.length +
      categories.complexFix.length +
      categories.unfixable.length;

    if (totalErrors === 0) return "simple";

    // If more than 50% are unfixable, it's impossible
    if (categories.unfixable.length / totalErrors > 0.5) {
      return "impossible";
    }

    // If more than 30% are complex, it's complex
    if (categories.complexFix.length / totalErrors > 0.3) {
      return "complex";
    }

    // If more than 50% are quick fixes, it's simple
    if (categories.quickFix.length / totalErrors > 0.5) {
      return "simple";
    }

    // Otherwise, it's moderate
    return "moderate";
  }

  /**
   * Calculate estimated total fix time
   */
  private static calculateEstimatedFixTime(categories: ErrorCategory): number {
    return (
      categories.quickFix.length * 5 +
      categories.mediumFix.length * 15 +
      categories.complexFix.length * 30 +
      categories.unfixable.length * 0
    );
  }

  /**
   * Calculate overall confidence in auto-fix success
   */
  private static calculateSuccessConfidence(
    categories: ErrorCategory,
    strategies: FixStrategy[]
  ): number {
    const totalErrors =
      categories.quickFix.length +
      categories.mediumFix.length +
      categories.complexFix.length +
      categories.unfixable.length;

    if (totalErrors === 0) return 1.0;

    // Weighted average of confidence by error count
    const weightedConfidence =
      (categories.quickFix.length * 0.95 +
        categories.mediumFix.length * 0.8 +
        categories.complexFix.length * 0.6 +
        categories.unfixable.length * 0.0) /
      totalErrors;

    return Math.round(weightedConfidence * 100) / 100;
  }

  /**
   * Recommend the best approach for fixing errors
   */
  private static recommendApproach(
    categories: ErrorCategory,
    successConfidence: number
  ): "auto-fix" | "manual-review" | "hybrid" {
    // If confidence is very high and mostly quick fixes, recommend auto-fix
    if (successConfidence >= 0.9 && categories.quickFix.length > 0) {
      return "auto-fix";
    }

    // If confidence is very low or mostly unfixable, recommend manual review
    if (
      successConfidence <= 0.3 ||
      categories.unfixable.length > categories.quickFix.length
    ) {
      return "manual-review";
    }

    // Otherwise, recommend hybrid approach
    return "hybrid";
  }

  /**
   * Get human-readable description of error categories
   */
  static getCategoryDescription(category: keyof ErrorCategory): string {
    const descriptions = {
      quickFix:
        "Simple fixes that can be applied automatically with high confidence",
      mediumFix:
        "Moderate complexity fixes requiring some code generation or modification",
      complexFix:
        "Complex fixes requiring architectural changes or significant refactoring",
      unfixable: "Errors that require human intervention or manual review",
    };

    return descriptions[category];
  }

  /**
   * Get fix priority order for applying fixes
   */
  static getFixPriority(): Array<keyof ErrorCategory> {
    return ["quickFix", "mediumFix", "complexFix", "unfixable"];
  }
}
