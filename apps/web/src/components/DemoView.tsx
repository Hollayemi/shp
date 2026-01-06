"use client";

import { useState, useEffect, useCallback } from "react";
import { DemoProjectViewV3 } from "@/modules/projects/ui/view/demo-v3-project-view";
import { UIMessage } from "@ai-sdk/react";
import { TODO_APP_DEMO_STEPS } from "@/data/demo-messages";
import { SPOTIFY_DEMO_STEPS } from "@/data/shopify-demo-messages";
import { AIRBNB_DEMO_STEPS } from "@/data/airbnb-demo-messages";
import { VACATION_DEMO_STEPS } from "@/data/vacation-demo-messages";

type StepGroup = {
    userMessages: UIMessage[];
    assistantMessages: UIMessage[];
};

export default function DemoPage() {
    const [currentStepGroup, setCurrentStepGroup] = useState(0);
    const [displayedMessages, setDisplayedMessages] = useState<UIMessage[]>([]);
    const [isSimulating, setIsSimulating] = useState(false);
    const [stepGroups, setStepGroups] = useState<StepGroup[]>([]);
    const [previewStep, setPreviewStep] = useState(0);
    const [demoType, setDemoType] = useState<string>("");
    const [showDemo, setShowDemo] = useState(false);

    // Get messages based on demo type
    const getMessages = (type: string): UIMessage[] => {
        switch (type) {
            case "TODO_APP":
                return TODO_APP_DEMO_STEPS;
            case "AIRBNB_CLONE":
                return AIRBNB_DEMO_STEPS;
            case "SPOTIFY_CLONE":
                return SPOTIFY_DEMO_STEPS;
            case "VACATION_APP":
                return VACATION_DEMO_STEPS;
            default:
                return [];
        }
    };

    const messages = getMessages(demoType);

    // Helper function to group messages into step groups
    const groupMessages = (messages: UIMessage[]): StepGroup[] => {
        if (!messages || messages.length === 0) return [];

        const groups: StepGroup[] = [];
        let currentGroup: StepGroup = { userMessages: [], assistantMessages: [] };
        let expectingUser = true; // Start expecting user messages

        for (const message of messages) {
            if (message.role === "user") {
                // If we were collecting assistant messages and now see a user message,
                // finish the current group and start a new one
                if (!expectingUser && currentGroup.assistantMessages.length > 0) {
                    groups.push(currentGroup);
                    currentGroup = { userMessages: [], assistantMessages: [] };
                }
                currentGroup.userMessages.push(message);
                expectingUser = true;
            } else if (message.role === "assistant") {
                currentGroup.assistantMessages.push(message);
                expectingUser = false;
            }
        }
        // Don't forget the last group
        if (currentGroup.userMessages.length > 0 || currentGroup.assistantMessages.length > 0) {
            groups.push(currentGroup);
        }
        return groups;
    };



    // Helper function to simulate text streaming
    const simulateTextStreaming = useCallback(async (text: string, onUpdate: (partialText: string) => void) => {
        const words = text.split(' ');
        let currentText = '';
        for (let i = 0; i < words.length; i++) {
            currentText += (i > 0 ? ' ' : '') + words[i];
            onUpdate(currentText);
            await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 5)); // 10-15ms per word
        }
    }, []);



    // Helper function to simulate reasoning part
    const simulateReasoningPart = useCallback(async (
        reasoningPart: any,
        currentMessage: UIMessage,
        updateMessage: (updater: (prev: UIMessage[]) => UIMessage[]) => void
    ) => {
        // Start with streaming reasoning
        const streamingReasoningPart = {
            ...reasoningPart,
            text: "",
            state: "streaming" as const
        };
        const updatedMessage = {
            ...currentMessage,
            parts: [...currentMessage.parts, streamingReasoningPart]
        };
        updateMessage(prev => [...prev.slice(0, -1), updatedMessage]);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Stream the reasoning text
        await simulateTextStreaming(reasoningPart.text, (partialText) => {
            const updatedReasoningPart = {
                ...streamingReasoningPart,
                text: partialText,
                state: "streaming" as const
            };
            const messageWithUpdatedReasoning = {
                ...updatedMessage,
                parts: [...updatedMessage.parts.slice(0, -1), updatedReasoningPart]
            };
            updateMessage(prev => [...prev.slice(0, -1), messageWithUpdatedReasoning]);
        });

        // Mark reasoning as complete
        const completedReasoningPart = {
            ...reasoningPart,
            state: "done" as const
        };
        const finalMessage = {
            ...updatedMessage,
            parts: [...updatedMessage.parts.slice(0, -1), completedReasoningPart]
        };
        updateMessage(prev => [...prev.slice(0, -1), finalMessage]);
        return finalMessage;
    }, [simulateTextStreaming]);

    // Helper function to simulate tool part
    const simulateToolPart = useCallback(async (
        toolPart: any,
        currentMessage: UIMessage,
        updateMessage: (updater: (prev: UIMessage[]) => UIMessage[]) => void
    ) => {
        // Start with input-streaming state
        const streamingToolPart = {
            ...toolPart,
            state: "input-streaming" as const
        };
        const messageWithTool = {
            ...currentMessage,
            parts: [...currentMessage.parts, streamingToolPart]
        };
        updateMessage(prev => [...prev.slice(0, -1), messageWithTool]);
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));

        // Move to input-available
        const inputAvailableToolPart = {
            ...toolPart,
            state: "input-available" as const
        };
        const messageWithInputAvailable = {
            ...messageWithTool,
            parts: [...messageWithTool.parts.slice(0, -1), inputAvailableToolPart]
        };
        updateMessage(prev => [...prev.slice(0, -1), messageWithInputAvailable]);
        await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));

        // Move to output-available (completed)
        const completedToolPart = {
            ...toolPart,
            state: "output-available" as const
        };
        const finalMessage = {
            ...messageWithInputAvailable,
            parts: [...messageWithInputAvailable.parts.slice(0, -1), completedToolPart]
        };
        updateMessage(prev => [...prev.slice(0, -1), finalMessage]);
        return finalMessage;
    }, []);

    // Helper function to simulate text part
    const simulateTextPart = useCallback(async (
        textPart: any,
        currentMessage: UIMessage,
        updateMessage: (updater: (prev: UIMessage[]) => UIMessage[]) => void
    ) => {
        // Start with empty streaming text
        const streamingTextPart = {
            ...textPart,
            text: "",
            state: "streaming" as const
        };
        const messageWithText = {
            ...currentMessage,
            parts: [...currentMessage.parts, streamingTextPart]
        };
        updateMessage(prev => [...prev.slice(0, -1), messageWithText]);

        // Stream the text
        await simulateTextStreaming(textPart.text, (partialText) => {
            const updatedTextPart = {
                ...streamingTextPart,
                text: partialText,
                state: "streaming" as const
            };
            const messageWithUpdatedText = {
                ...messageWithText,
                parts: [...messageWithText.parts.slice(0, -1), updatedTextPart]
            };
            updateMessage(prev => [...prev.slice(0, -1), messageWithUpdatedText]);
        });

        // Mark text as complete
        const completedTextPart = {
            ...textPart,
            state: "done" as const
        };
        const finalMessage = {
            ...messageWithText,
            parts: [...messageWithText.parts.slice(0, -1), completedTextPart]
        };
        updateMessage(prev => [...prev.slice(0, -1), finalMessage]);
        return finalMessage;
    }, [simulateTextStreaming]);

    const simulateAssistantMessage = useCallback(async (assistantMessage: UIMessage) => {
        // Start assistant response with step-start
        let currentAssistantMessage: UIMessage = {
            id: assistantMessage.id,
            role: "assistant",
            parts: [{ type: "step-start" }]
        };
        setDisplayedMessages(prev => [...prev, currentAssistantMessage]);
        await new Promise(resolve => setTimeout(resolve, 150));

        // Group parts according to the specified logic
        const parts = assistantMessage.parts;
        let firstReasoningProcessed = false;
        let workGroupParts: any[] = []; // For subsequent reasoning + tool parts

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            if (part.type === "reasoning") {
                if (!firstReasoningProcessed) {
                    // First reasoning: process immediately as its own step
                    currentAssistantMessage = await simulateReasoningPart(part, currentAssistantMessage, setDisplayedMessages);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    firstReasoningProcessed = true;
                } else {
                    // Subsequent reasoning: add to work group
                    workGroupParts.push(part);
                }
            } else if (part.type?.startsWith("tool-")) {
                // All tool parts go to work group
                workGroupParts.push(part);
            } else if (part.type === "text") {
                // Process any pending work group first
                if (workGroupParts.length > 0) {
                    for (const workPart of workGroupParts) {
                        if (workPart.type === "reasoning") {
                            currentAssistantMessage = await simulateReasoningPart(workPart, currentAssistantMessage, setDisplayedMessages);
                            await new Promise(resolve => setTimeout(resolve, 50));
                        } else if (workPart.type?.startsWith("tool-")) {
                            currentAssistantMessage = await simulateToolPart(workPart, currentAssistantMessage, setDisplayedMessages);
                            await new Promise(resolve => setTimeout(resolve, 25));
                        }
                    }
                    workGroupParts = [];
                }
                // Process text part immediately at its natural position
                await new Promise(resolve => setTimeout(resolve, 75));
                currentAssistantMessage = await simulateTextPart(part, currentAssistantMessage, setDisplayedMessages);
            }
        }
        // Process any remaining work group parts at the end
        if (workGroupParts.length > 0) {
            for (const workPart of workGroupParts) {
                if (workPart.type === "reasoning") {
                    currentAssistantMessage = await simulateReasoningPart(workPart, currentAssistantMessage, setDisplayedMessages);
                    await new Promise(resolve => setTimeout(resolve, 50));
                } else if (workPart.type?.startsWith("tool-")) {
                    currentAssistantMessage = await simulateToolPart(workPart, currentAssistantMessage, setDisplayedMessages);
                    await new Promise(resolve => setTimeout(resolve, 25));
                }
            }
        }
    }, [simulateReasoningPart, simulateToolPart, simulateTextPart]);

    const simulateStepGroup = useCallback(async (targetStepGroup: number) => {
        if (isSimulating) return;
        if (targetStepGroup >= stepGroups.length) return;

        setIsSimulating(true);
        const stepGroup = stepGroups[targetStepGroup];

        // Step 1: Stream all user messages in the group
        for (const userMessage of stepGroup.userMessages) {
            setDisplayedMessages(prev => [...prev, userMessage]);
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Step 2: Simulate each assistant message in the group
        for (const assistantMessage of stepGroup.assistantMessages) {
            await simulateAssistantMessage(assistantMessage);
        }

        setCurrentStepGroup(targetStepGroup);
        setPreviewStep(targetStepGroup + 1);
        setIsSimulating(false);
    }, [isSimulating, stepGroups, simulateAssistantMessage]);

    // Initialize step groups and reset state when messages change
    useEffect(() => {
        if (messages && messages.length > 0) {
            const groups = groupMessages(messages);
            setStepGroups(groups);
            setDisplayedMessages([]);
            setCurrentStepGroup(0);
        }
    }, [messages]);

    // Auto-start simulation when stepGroups are loaded and we have a demo type
    useEffect(() => {
        if (stepGroups.length > 0 && demoType && showDemo && !isSimulating) {
            simulateStepGroup(0);
        }
    }, [stepGroups, demoType, showDemo, isSimulating, simulateStepGroup]);

    const handleDemoTypeSelect = (type: string) => {
        setDemoType(type);
        setShowDemo(true);
        setCurrentStepGroup(0);
        setDisplayedMessages([]);
        setPreviewStep(0);
    };

    const handleStartBuilding = () => {
        // setShowDemo(true);
        // setCurrentStepGroup(0);
        // setPreviewStep(1);

    };



    console.log("displayedMessages", displayedMessages);
    console.log("currentStepGroup", currentStepGroup);
    console.log("stepGroups", stepGroups);
    console.log("isSimulating", isSimulating);

    console.log("demoStep", currentStepGroup);
    // Calculate previewStep as currentStepGroup + 1 for code view and preview
    console.log("previewStep", previewStep);

    return (
        <DemoProjectViewV3
            demoType={demoType}
            demoTypeSelect={handleDemoTypeSelect}
            handleStartBuilding={handleStartBuilding}
            showDemo={showDemo}
            seed="demo-seed"
            demoStep={currentStepGroup}
            previewStep={previewStep}
            onDemoStepChange={simulateStepGroup}
            displayedMessages={displayedMessages}
            allMessages={messages}
            isSimulating={isSimulating}
            simulateUserInteraction={simulateStepGroup}
        />
    );
}
