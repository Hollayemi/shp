import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  init_esm_shims
} from "./chunk-IXOW5DJO.js";

// src/services/voltagent-agents.ts
init_esm_shims();
import { Agent } from "@voltagent/core";
import { openrouter } from "@openrouter/ai-sdk-provider";
var createErrorFixAgent = () => {
  return new Agent({
    name: "ErrorFixAgent",
    instructions: "You are an expert software engineer specializing in debugging and repairs. You analyze error logs and provide intelligent fix suggestions.",
    model: openrouter("anthropic/claude-sonnet-4", {
      extraBody: {
        max_tokens: 4e3
      }
    })
  });
};
var createErrorClassifierAgent = () => {
  return new Agent({
    name: "ErrorClassifierAgent",
    instructions: "You are a debugging classifier. Given an error message, categorize it into one of these types: Syntax, Missing Import / Undefined Variable, Type Mismatch, API Misuse, Configuration/Environment, or Other.",
    model: openrouter("anthropic/claude-sonnet-4", {
      extraBody: {
        max_tokens: 2e3
      }
    })
  });
};
var createRepairAgent = () => {
  return new Agent({
    name: "RepairAgent",
    instructions: "You are a code repair assistant. Fix code while preserving structure. Respond only with the corrected code snippet.",
    model: openrouter("anthropic/claude-sonnet-4", {
      extraBody: {
        max_tokens: 4e3
      }
    })
  });
};
var createValidatorAgent = () => {
  return new Agent({
    name: "ValidatorAgent",
    instructions: "You are a validator assistant. Given an error and proposed fix, determine if the fix logically resolves the root cause. If not sufficient, suggest an alternative adjustment.",
    model: openrouter("anthropic/claude-sonnet-4", {
      extraBody: {
        max_tokens: 2e3
      }
    })
  });
};
export {
  createErrorClassifierAgent,
  createErrorFixAgent,
  createRepairAgent,
  createValidatorAgent
};
