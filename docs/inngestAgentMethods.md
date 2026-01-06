Agents
Create agents to accomplish specific tasks with tools inside a network.

Agents are the core of AgentKit. Agents are stateless entities with a defined goal and an optional set of Tools that can be used to accomplish a goal.

Agents can be called individually or, more powerfully, composed into a Network with multiple agents that can work together with persisted State.

At the most basic level, an Agent is a wrapper around a specific provider’s model, OpenAI gpt-4 for example, and a set of of tools.

​
Creating an Agent
To create a simple Agent, all that you need is a name, system prompt and a model. All configuration options are detailed in the createAgent reference.

Here is a simple agent created using the createAgent function:


Copy

Ask AI
import { createAgent, openai } from '@inngest/agent-kit';

const codeWriterAgent = createAgent({
  name: 'Code writer',
  system:
    'You are an expert TypeScript programmer.  Given a set of asks, you think step-by-step to plan clean, ' +
    'idiomatic TypeScript code, with comments and tests as necessary.' +
    'Do not respond with anything else other than the following XML tags:' +
    '- If you would like to write code, add all code within the following tags (replace $filename and $contents appropriately):' +
    "  <file name='$filename.ts'>$contents</file>",
  model: openai('gpt-4o-mini'),
});
While system prompts can be static strings, they are more powerful when they are dynamic system prompts defined as callbacks that can add additional context at runtime.

Any Agent can be called using run() with a user prompt. This performs an inference call to the model with the system prompt as the first message and the input as the user message.


Copy

Ask AI
const { output } = codeWriterAgent.run(
  'Write a typescript function that removes unnecessary whitespace',
);
console.log(output);
// [{ role: 'assistant', content: 'function removeUnecessaryWhitespace(...' }]
When including your Agent in a Network, a description is required. Learn more about using Agents in Networks here.

​
Adding tools
Tools are functions that extend the capabilities of an Agent. Along with the prompt (see run()), Tools are included in calls to the language model through features like OpenAI’s “function calling” or Claude’s “tool use.”

Tools are defined using the createTool function and are passed to agents via the tools parameter:


Copy

Ask AI
import { createAgent, createTool, openai } from '@inngest/agent-kit';

const listChargesTool = createTool({
  name: 'list_charges',
  description:
    "Returns all of a user's charges. Call this whenever you need to find one or more charges between a date range.",
  parameters: z.array(
    z.object({
      userId: z.string(),
    }),
  ),
  handler: async (output, { network, agent, step }) => {
    // output is strongly typed to match the parameter type.
  },
});

const supportAgent = createAgent({
  name: 'Customer support specialist',
  system: 'You are an customer support specialist...',
  model: openai('gpt-3.5-turbo'),
  tools: [listChargesTool],
});
When run() is called, any step that the model decides to call is immediately executed before returning the output. Read the “How agents work” section for additional information.

Learn more about Tools in this guide.

​
How Agents work
Agents themselves are relatively simple. When you call run(), there are several steps that happen:

1
Preparing the prompts

The initial messages are created using the system prompt, the run() user prompt, and Network State, if the agent is part of a Network.

For added control, you can dynamically modify the Agent’s prompts before the next step using the onStart lifecycle hook.

2
Inference call

An inference call is made to the provided model using Inngest’s step.ai. step.ai automatically retries on failure and caches the result for durability.

The result is parsed into an InferenceResult object that contains all messages, tool calls and the raw API response from the model.

To modify the result prior to calling tools, use the optional onResponse lifecycle hook.

3
Tool calling

If the model decides to call one of the available tools, the Tool is automatically called.

After tool calling is complete, the onFinish lifecycle hook is called with the updated InferenceResult. This enables you to modify or inspect the output of the called tools.

4
Complete

The result is returned to the caller.

​
Lifecycle hooks
Agent lifecycle hooks can be used to intercept and modify how an Agent works enabling dynamic control over the system:


Copy

Ask AI
import { createAgent, openai } from '@inngest/agent-kit';

const agent = createAgent({
  name: 'Code writer',
  description: 'An expert TypeScript programmer which can write and debug code.',
  system: '...',
  model: openai('gpt-3.5-turbo'),
  lifecycle: {
    onStart: async ({ prompt,  network: { state }, history }) => {
      // Dynamically alter prompts using Network state and history.

      return { prompt, history }
    },
  },
});
As mentioned in the “How Agents work” section, there are a few lifecycle hooks that can be defined on the Agent’s lifecycle options object.

Dynamically alter prompts using Network State or the Network’s history.
Parse output of model after an inference call.
Learn more about lifecycle hooks and how to define them in this reference.

​
System prompts
An Agent’s system prompt can be defined as a string or an async callback. When Agents are part of a Network, the Network State is passed as an argument to create dynamic prompts, or instructions, based on history or the outputs of other Agents.

​
Dynamic system prompts
Dynamic system prompts are very useful in agentic workflows, when multiple models are called in a loop, prompts can be adjusted based on network state from other call outputs.


Copy

Ask AI
const agent = createAgent({
  name: 'Code writer',
  description:
    'An expert TypeScript programmer which can write and debug code.',

  // The system prompt can be dynamically created at runtime using Network state:
  system: async ({ network }) => {
    // A default base prompt to build from:
    const basePrompt =
      'You are an expert TypeScript programmer. ' +
      'Given a set of asks, think step-by-step to plan clean, ' +
      'idiomatic TypeScript code, with comments and tests as necessary.';

    // Inspect the Network state, checking for existing code saved as files:
    const files: Record<string, string> | undefined = network.state.data.files;
    if (!files) {
      return basePrompt;
    }

    // Add the files from Network state as additional context automatically
    let additionalContext = 'The following code already exists:';
    for (const [name, content] of Object.entries(files)) {
      additionalContext += `<file name='${name}'>${content}</file>`;
    }
    return `${basePrompt} ${additionalContext}`;
  },
});
​
Static system prompts
Agents may also just have static system prompts which are more useful for simpler use cases.


Copy

Ask AI
const codeWriterAgent = createAgent({
  name: 'Copy editor',
  system:
    `You are an expert copy editor. Given a draft article, you provide ` +
    `actionable improvements for spelling, grammar, punctuation, and formatting.`,
  model: openai('gpt-3.5-turbo'),
});
​
Using Agents in Networks
Agents are the most powerful when combined into Networks. Networks include state and routers to create stateful workflows that can enable Agents to work together to accomplish larger goals.

​
Agent descriptions
Similar to how Tools have a description that enables an LLM to decide when to call it, Agents also have an description parameter. This is required when using Agents within Networks. Here is an example of an Agent with a description:


Copy

Ask AI
const codeWriterAgent = createAgent({
  name: 'Code writer',
  description:
    'An expert TypeScript programmer which can write and debug code. Call this when custom code is required to complete a task.',
  system: `...`,
  model: openai('gpt-3.5-turbo'),
});


Tools
Extending the functionality of Agents for structured output or performing tasks.

Tools are functions that extend the capabilities of an Agent. Tools have two core uses:

Calling code, enabling models to interact with systems like your own database or external APIs.
Turning unstructured inputs into structured responses.
A list of all available Tools and their configuration is sent in an Agent’s inference calls and a model may decide that a certain tool or tools should be called to complete the task. Tools are included in an Agent’s calls to language models through features like OpenAI’s “function calling” or Claude’s “tool use.”

​
Creating a Tool
Each Tool’s name, description, and parameters are part of the function definition that is used by model to learn about the tool’s capabilities and decide when it should be called. The handler is the function that is executed by the Agent if the model decides that a particular Tool should be called.

Here is a simple tool that lists charges for a given user’s account between a date range:


Copy

Ask AI
import { createTool } from '@inngest/agent-kit';

const listChargesTool = createTool({
  name: 'list_charges',
  description:
    "Returns all of a user's charges. Call this whenever you need to find one or more charges between a date range.",
  parameters: z.object({
    userId: z.string(),
    created: z.object({
      gte: z.string().date(),
      lte: z.string().date(),
    }),
  }),
  handler: async ({ userId, created }, { network, agent, step }) => {
    // input is strongly typed to match the parameter type.
    return [{...}]
  },
});
Writing quality name and description parameters help the model determine when the particular Tool should be called.

​
Optional parameters
Optional parameters should be defined using .nullable() (not .optional()):


Copy

Ask AI
const listChargesTool = createTool({
  name: 'list_charges',
  description:
    "Returns all of a user's charges. Call this whenever you need to find one or more charges between a date range.",
  parameters: z.object({
    userId: z.string(),
    created: z.object({
      gte: z.string().date(),
      lte: z.string().date(),
    }).nullable(),
  }),
  handler: async ({ userId, created }, { network, agent, step }) => {
    // input is strongly typed to match the parameter type.
    return [{...}]
  },
});


Networks
Combine one or more agents into a Network.

Networks are Systems of Agents. Use Networks to create powerful AI workflows by combining multiple Agents.

A network contains three components:

The Agents that the network can use to achieve a goal
A State including past messages and a key value store, shared between Agents and the Router
A Router, which chooses whether to stop or select the next agent to run in the loop
Here’s a simple example:


Copy

Ask AI
import { createNetwork, openai } from '@inngest/agent-kit';

// searchAgent and summaryAgent definitions...

// Create a network with two agents.
const network = createNetwork({
  agents: [searchAgent, summaryAgent],
});

// Run the network with a user prompt
await network.run('What happened in the 2024 Super Bowl?');
By calling run(), the network runs a core loop to call one or more agents to find a suitable answer.

​
How Networks work
Networks can be thought of as while loops with memory (State) that call Agents and Tools until the Router determines that there is no more work to be done.

1
Create the Network of Agents

You create a network with a list of available Agents. Each Agent can use a different model and inference provider.

2
Provide the staring prompt

You give the network a user prompt by calling run().

3
Core execution loop

The network runs its core loop:

1
Call the Network router

The Router decides the first Agent to run with your input.

2
Run the Agent

Call the Agent with your input. This also runs the agent’s lifecycles, and any Tools that the model decides to call.

3
Store the result

Stores the result in the network’s State. State can be accessed by the Router or other Agent’s Tools in future loops.

4
Call the the Router again ↩️

Return to the top of the loop and calls the Router with the new State. The Router can decide to quit or run another Agent.

​
Model configuration
A Network must provide a default model which is used for routing between Agents and for Agents that don’t have one:


Copy

Ask AI
import { createNetwork, openai } from '@inngest/agent-kit';

// searchAgent and summaryAgent definitions...

const network = createNetwork({
  agents: [searchAgent, summaryAgent],
  defaultModel: openai({ model: 'gpt-4o' }),
});
A Network not defining a defaultModel and composed of Agents without model will throw an error.

​
Combination of multiple models
Each Agent can specify it’s own model to use so a Network may end up using multiple models. Here is an example of a Network that defaults to use an OpenAI model, but the summaryAgent is configured to use an Anthropic model:


Copy

Ask AI
import { createNetwork, openai, anthropic } from '@inngest/agent-kit';

const searchAgent = createAgent({
  name: 'Search',
  description: 'Search the web for information',
});

const summaryAgent = createAgent({
  name: 'Summary',
  description: 'Summarize the information',
  model: anthropic({ model: 'claude-3-5-sonnet' }),
});

// The searchAgent will use gpt-4o, while the summaryAgent will use claude-3-5-sonnet.
const network = createNetwork({
  agents: [searchAgent, summaryAgent],
  defaultModel: openai({ model: 'gpt-4o' }),
});
​
Routing & maximum iterations
​
Routing
A Network can specify an optional defaultRouter function that will be used to determine the next Agent to run.


Copy

Ask AI
import { createNetwork } from '@inngest/agent-kit';

// classifier and writer Agents definition...

const network = createNetwork({
  agents: [classifier, writer],
  router: ({ lastResult, callCount }) => {
    // retrieve the last message from the output
    const lastMessage = lastResult?.output[lastResult?.output.length - 1];
    const content = lastMessage?.type === 'text' ? lastMessage?.content as string : '';
    // First call: use the classifier
    if (callCount === 0) {
      return classifier;
    }
    // Second call: if it's a question, use the writer
    if (callCount === 1 && content.includes('question')) {
      return writer;
    }
    // Otherwise, we're done!
    return undefined;
  },
});
Refer to the Router documentation for more information about how to create a custom Router.

​
Maximum iterations
A Network can specify an optional maxIter setting to limit the number of iterations.


Copy

Ask AI
import { createNetwork } from '@inngest/agent-kit';

// searchAgent and summaryAgent definitions...

const network = createNetwork({
  agents: [searchAgent, summaryAgent],
  defaultModel: openai({ model: 'gpt-4o' }),
  maxIter: 10,
});
Specifying a maxIter option is useful when using a Default Routing Agent or a Hybrid Router to avoid infinite loops.

A Routing Agent or Hybrid Router rely on LLM calls to make decisions, which means that they can sometimes fail to identify a final condition.

​
Combining maxIter and defaultRouter
You can combine maxIter and defaultRouter to create a Network that will stop after a certain number of iterations or when a condition is met.

However, please note that the maxIter option can prevent the defaultRouter from being called (For example, if maxIter is set to 1, the defaultRouter will only be called once).

​
Providing a default State
A Network can specify an optional defaultState setting to provide a default State.


Copy

Ask AI
import { createNetwork } from '@inngest/agent-kit';

// searchAgent and summaryAgent definitions...

const network = createNetwork({
  agents: [searchAgent, summaryAgent],
  defaultState: new State({
    foo: 'bar',
  }),
});
Providing a defaultState can be useful to persist the state in database between runs or initialize your network with external data.



State
Shared memory, history, and key-value state for Agents and Networks.

State is shared memory, or context, that is be passed between different Agents in a Networks. State is used to store message history and build up structured data from tools.

State enables agent workflows to execute in a loop and contextually make decisions. Agents continuously build upon and leverage this context to complete complex tasks.

AgentKit’s State stores data in two ways:

History of messages - A list of prompts, responses, and tool calls.
Fully typed state data - Typed state that allows you to build up structured data from agent calls, then implement deterministic state-based routing to easily model complex agent workflows.
Both history and state data are used automatically by the Network to store and provide context to the next Agent.

​
History
The history system maintains a chronological record of all Agent interactions in your Network.

Each interaction is stored as an InferenceResult. Refer to the InferenceResult reference for more information.

​
Typed state
State contains typed data that can be used to store information between Agent calls, update agent prompts, and manage routing. Networks, agents, and tools use this type in order to set data:


Copy

Ask AI

export interface NetworkState {
  // username is undefined until extracted and set by a tool
  username?: string;
}

// You can construct typed state with optional defaults, eg. from memory.
const state = createState<NetworkState>({
  username: "default-username",
});

console.log(state.data.username); // 'default-username'
state.data.username = "Alice";
console.log(state.data.username); // 'Alice'
Common uses for data include:

Storing intermediate results that other Agents might need within lifecycles
Storing user preferences or context
Passing data between Tools and Agents
State based routing
The State’s data is only retained for a single Network’s run. This means that it is only short-term memory and is not persisted across different Network run() calls.

You can implement memory by inspecting a network’s state after it has finished running.

State, which is required by Networks, has many uses across various AgentKit components.

Refer to the State reference for more information.

​
Using state in tools
State can be leveraged in a Tool’s handler method to get or set data. Here is an example of a Tool that uses kv as a temporary store for files and their contents that are being written by the Agent.


Copy

Ask AI
const writeFiles = createTool({
  name: "write_files",
  description: "Write code with the given filenames",
  parameters: z.object({
    files: z.array(
      z.object({
        filename: z.string(),
        content: z.string(),
      })
    ),
  }),
  handler: (output, { network }) => {
    // files is the output from the model's response in the format above.
    // Here, we store OpenAI's generated files in the response.
    const files = network.state.data.files || {};
    for (const file of output.files) {
      files[file.filename] = file.content;
    }
    network.state.data.files = files;
  },
});



Routers
Customize how calls are routed between Agents in a Network.

The purpose of a Network’s Router is to decide what Agent to call based off the current Network State.

​
What is a Router?
A router is a function that gets called after each agent runs, which decides whether to:

Call another agent (by returning an Agent)
Stop the network’s execution loop (by returning undefined)
The routing function gets access to everything it needs to make this decision:

The Network object itself, including it’s State.
The stack of Agents to be called.
The number of times the Network has called Agents (the number of iterations).
The result from the previously called Agent in the Network’s execution loop.
For more information about the role of a Router in a Network, read about how Networks work.

​
Using a Router
Providing a custom Router to your Network is optional. If you don’t provide one, the Network will use the “Default Router” Routing Agent.

Providing a custom Router to your Network can be achieved using 3 different patterns:

Writing a custom Code-based Router: Define a function that makes decisions based on the current State.
Creating a Routing Agent: Leverages LLM calls to decide which Agents should be called next based on the current State.
Writing a custom Hybrid Router: Mix code and agent-based routing to get the best of both worlds.
​
Creating a custom Router
Custom Routers can be provided by defining a defaultRouter function returning either an instance of an Agent object or undefined.


Copy

Ask AI
import { createNetwork } from "@inngest/agent-kit";

// classifier and writer Agents definition...

const network = createNetwork({
  agents: [classifier, writer],
  router: ({ lastResult, callCount }) => {
    // retrieve the last message from the output
    const lastMessage = lastResult?.output[lastResult?.output.length - 1];
    const content =
      lastMessage?.type === "text" ? (lastMessage?.content as string) : "";
    // First call: use the classifier
    if (callCount === 0) {
      return classifier;
    }
    // Second call: if it's a question, use the writer
    if (callCount === 1 && content.includes("question")) {
      return writer;
    }
    // Otherwise, we're done!
    return undefined;
  },
});
The defaultRouter function receives a number of arguments:

@inngest/agent-kit

Copy

Ask AI
interface RouterArgs {
  network: Network; // The entire network, including the state and history
  stack: Agent[]; // Future agents to be called
  callCount: number; // Number of times the Network has called agents
  lastResult?: InferenceResult; // The the previously called Agent's result
}
The available arguments can be used to build the routing patterns described below.

​
Routing Patterns
​
Tips
Start simple with code-based routing for predictable behavior, then add agent-based routing for flexibility.
Remember that routers can access the network’s state
You can return agents that weren’t in the original network
The router runs after each agent call
Returning undefined stops the network’s execution loop
That’s it! Routing is what makes networks powerful - it lets you build workflows that can be as simple or complex as you need.

​
Code-based Routers (supervised routing)
The simplest way to route is to write code that makes decisions. Here’s an example that routes between a classifier and a writer:


Copy

Ask AI
import { createNetwork } from "@inngest/agent-kit";

// classifier and writer Agents definition...

const network = createNetwork({
  agents: [classifier, writer],
  router: ({ lastResult, callCount }) => {
    // retrieve the last message from the output
    const lastMessage = lastResult?.output[lastResult?.output.length - 1];
    const content =
      lastMessage?.type === "text" ? (lastMessage?.content as string) : "";
    // First call: use the classifier
    if (callCount === 0) {
      return classifier;
    }
    // Second call: if it's a question, use the writer
    if (callCount === 1 && content.includes("question")) {
      return writer;
    }
    // Otherwise, we're done!
    return undefined;
  },
});
Code-based routing is great when you want deterministic, predictable behavior. It’s also the fastest option since there’s no LLM calls involved.

​
Routing Agent (autonomous routing)
Without a defaultRouter defined, the network will use the “Default Routing Agent” to decide which agent to call next. The “Default Routing Agent” is a Routing Agent provided by Agent Kit to handle the default routing logic.

You can create your own Routing Agent by using the createRoutingAgent helper function:


Copy

Ask AI
import { createRoutingAgent } from "@inngest/agent-kit";

const routingAgent = createRoutingAgent({
  name: "Custom routing agent",
  description: "Selects agents based on the current state and request",
  lifecycle: {
    onRoute: ({ result, network }) => {
      // custom logic...
    },
  },
});

// classifier and writer Agents definition...

const network = createNetwork({
  agents: [classifier, writer],
  router: routingAgent,
});
Routing Agents look similar to Agents but are designed to make routing decisions: - Routing Agents cannot have Tools. - Routing Agents provides a single onRoute lifecycle method.

​
Hybrid code and agent Routers (semi-supervised routing)
And, of course, you can mix code and agent-based routing. Here’s an example that uses code for the first step, then lets an agent take over:


Copy

Ask AI
import { createNetwork, getDefaultRoutingAgent } from "@inngest/agent-kit";

// classifier and writer Agents definition...

const network = createNetwork({
  agents: [classifier, writer],
  router: ({ callCount }) => {
    // Always start with the classifier
    if (callCount === 0) {
      return classifier;
    }
    // Then let the routing agent take over
    return getDefaultRoutingAgent();
  },
});
This gives you the best of both worlds:

Predictable first steps when you know what needs to happen
Flexibility when the path forward isn’t clear
​
Using state in Routing
The router is the brain of your network - it decides which agent to call next. You can use state to make smart routing decisions:


Copy

Ask AI
import { createNetwork } from '@inngest/agent-kit';

// mathAgent and contextAgent Agents definition...

const network = createNetwork({
  agents: [mathAgent, contextAgent],
  router: ({ network, lastResult }): Agent | undefined => {
    // Check if we've solved the problem
    const solution = network.state.data.solution;
    if (solution) {
      // We're done - return undefined to stop the network
      return undefined;
    }

    // retrieve the last message from the output
    const lastMessage = lastResult?.output[lastResult?.output.length - 1];
    const content = lastMessage?.type === 'text' ? lastMessage?.content as string : '';

    // Check the last result to decide what to do next
    if (content.includes('need more context')) {
      return contextAgent;
    }

    return mathAgent;
  };
});


History
Learn how to persist conversations for your agents and networks

​
Overview
AgentKit enables persistent conversations that maintain context across multiple runs. By implementing a History Adapter, you can connect your agents and networks to any database or storage solution, allowing conversations to resume exactly where they left off.

A History Adapter is a configuration object that bridges AgentKit’s execution lifecycle with your database. It tells AgentKit how to:

Create new conversation threads
Load existing conversation history
Save new messages and results
AgentKit is database-agnostic. You can use PostgreSQL, MongoDB, Redis, or any storage solution by implementing the HistoryConfig interface.

The adapter is passed to createAgent() or createNetwork() and AgentKit automatically calls your adapter’s methods at the appropriate times during execution.

​
HistoryConfig Interface
The HistoryConfig interface has three optional methods. Below is an expanded view of the interface showing the context and parameters passed to each method.


Copy

Ask AI
import type {
  State,
  NetworkRun,
  AgentResult,
  GetStepTools,
  StateData,
} from "@inngest/agent-kit";

interface HistoryConfig<T extends StateData> {
  /**
   * Creates a new conversation thread.
   * Invoked at the start of a run if no `threadId` exists in the state.
   */
  createThread?: (ctx: {
    state: State<T>; // The current state, including your custom data
    input: string; // The user's input string
    network?: NetworkRun<T>; // The network instance (if applicable)
    step?: GetStepTools; // Inngest step tools for durable execution
  }) => Promise<{ threadId: string }>;

  /**
   * Retrieves conversation history from your database.
   * Invoked after thread initialization if no history is provided by the client.
   */
  get?: (ctx: {
    threadId: string; // The ID of the conversation thread
    state: State<T>;
    input: string;
    network: NetworkRun<T>;
    step?: GetStepTools;
  }) => Promise<AgentResult[]>;

  /**
   * Saves new messages to your database after a run.
   * Invoked at the end of a successful agent or network run.
   */
  appendResults?: (ctx: {
    threadId: string;
    newResults: AgentResult[]; // The new results generated during this run
    userMessage?: { content: string; role: "user"; timestamp: Date }; // The user's message
    state: State<T>;
    input: string;
    network: NetworkRun<T>;
    step?: GetStepTools;
  }) => Promise<void>;
}
​
createThread
Creates a new conversation thread in your database
Invoked at the start of a run if no threadId exists in the state
Returns an object with the new threadId
​
get
Retrieves conversation history from your database
Invoked after thread initialization, but only if the client didn’t provide results or messages
Returns an array of AgentResult[] representing the conversation history
​
appendResults
Saves new messages to your database after a network or agent run
Invoked at the end of a successful agent or network run
Receives only the new results generated during this run (prevents duplicates)
​
Usage
Here’s a complete example of creating a network with history persistence:


Copy

Ask AI
import {
  createNetwork,
  createAgent,
  createState,
  openai,
} from "@inngest/agent-kit";
import { db } from "./db"; // Your database client

// Define your history adapter with all three methods
const conversationHistoryAdapter: HistoryConfig<any> = {
  // 1. Create new conversation threads
  createThread: async ({ state, input }) => {
    const thread = await db.thread.create({
      data: {
        userId: state.data.userId,
        title: input.slice(0, 50), // First 50 chars as title
        createdAt: new Date(),
      },
    });
    return { threadId: thread.id };
  },

  // 2. Load conversation history
  get: async ({ threadId }) => {
    if (!threadId) return [];

    const messages = await db.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
    });

    // Transform database records to AgentResult format
    return messages
      .filter((msg) => msg.role === "assistant")
      .map((msg) => ({
        agentName: msg.agentName,
        output: [
          {
            type: "text" as const,
            role: "assistant" as const,
            content: msg.content,
          },
        ],
        toolCalls: [],
        createdAt: new Date(msg.createdAt),
      }));
  },

  // 3. Save new messages
  appendResults: async ({ threadId, newResults, userMessage }) => {
    if (!threadId) return;

    // Save user message
    if (userMessage) {
      await db.message.create({
        data: {
          threadId,
          role: "user",
          content: userMessage.content,
          createdAt: userMessage.timestamp,
        },
      });
    }

    // Save agent responses
    for (const result of newResults) {
      const content = result.output
        .filter((msg) => msg.type === "text")
        .map((msg) => msg.content)
        .join("\n");

      await db.message.create({
        data: {
          threadId,
          role: "assistant",
          agentName: result.agentName,
          content,
          createdAt: result.createdAt,
        },
      });
    }
  },
};

// Create agents
const researcher = createAgent({
  name: "researcher",
  description: "Searches for information",
  model: openai({ model: "gpt-4" }),
});

const writer = createAgent({
  name: "writer",
  description: "Writes comprehensive responses",
  model: openai({ model: "gpt-4" }),
});

// Create network with history configuration
const assistantNetwork = createNetwork({
  name: "Research Assistant",
  agents: [researcher, writer],
  defaultModel: openai({ model: "gpt-4" }),
  history: conversationHistoryAdapter, // Add history adapter here
});

// Use the network - conversations will be automatically persisted
const state = createState(
  { userId: "user-123" },
  { threadId: "existing-thread-id" } // Optional: continue existing conversation
);

await assistantNetwork.run("Tell me about quantum computing", { state });
Once you’ve created your adapter, pass it to the history property when creating an agent or network:


Agent

Network

Copy

Ask AI
import { createAgent } from "@inngest/agent-kit";
import { postgresHistoryAdapter } from "./my-postgres-adapter";

const chatAgent = createAgent({
  name: "chat-agent",
  system: "You are a helpful assistant.",
  history: postgresHistoryAdapter, // Add your adapter here
});

// Now the agent will automatically persist conversations
await chatAgent.run("Hello!", {
  state: createState({ userId: "user123" }, { threadId: "thread-456" }),
});
​
Persistence Patterns
AgentKit supports two distint patterns for managing conversation history.

​
Server-Authoritative
The client sends a message with a threadId. AgentKit automatically loads the full conversation context from your database before the network runs.


Copy

Ask AI
// Client sends just the threadId
const state = createState(
  { userId: "user123" },
  { threadId: "existing-thread-id" }
);

await chatNetwork.run("Continue our conversation", { state });
// AgentKit calls history.get() to load full context for all agents
Use case: Perfect for restoring conversations after page refresh or when opening the app on a new device.

​
Client-Authoritative (Performance Optimized)
The client maintains conversation state locally and sends the complete history with each request. AgentKit detects this and skips the database read for better performance.


Copy

Ask AI
// Client sends the full conversation history
const state = createState(
  { userId: "user123" },
  {
    threadId: "thread-id",
    results: previousConversationResults, // Full history from client
  }
);

await chatNetwork.run("New message", { state });
// AgentKit skips history.get() call - faster performance!
// Still calls history.appendResults() to save new messages
Use case: Ideal for interactive chat applications where the frontend maintains conversation state and fetches messages from an existing/seperate API

​
Server/Client Hybrid Pattern
You can combine the Server-Authoritative and Client-Authoritative patterns for an optimal user experience. This hybrid approach allows for fast initial conversation loading and high-performance interactive chat.

Initial Load (Server-Authoritative): When a user opens a conversation thread, the client sends only the threadId. AgentKit fetches the history from your database using history.get(). The application then hydrates the client-side state with this history.
Interactive Session (Client-Authoritative): For all subsequent requests within the session, the client sends the full, up-to-date history (results or messages) along with the threadId. AgentKit detects the client-provided history and skips the database read, resulting in a faster response.
Use case: Ideal for interactive chat applications where the frontend maintains conversation state but lets AgentKit fetch messages via their history adapter

​
How Thread IDs Are Managed
AgentKit offers a flexible system for managing conversation thread IDs, ensuring that history is handled correctly whether you’re starting a new conversation or continuing an existing one. Here’s how AgentKit determines which threadId to use, in order of precedence:

Explicit threadId (Highest Priority): The most direct method is to provide a threadId when you create your state. This is the standard way to resume a specific, existing conversation. AgentKit will use this ID to load the relevant history via the history.get() method.


Copy

Ask AI
// Continue a specific, existing conversation
const state = createState(
  { userId: "user-123" },
  { threadId: "existing-thread-id-123" }
);
await network.run("Let's pick up where we left off.", { state });
Automatic Creation via createThread: If you don’t provide a threadId, AgentKit checks if your history adapter has a createThread method. If so, AgentKit calls it to create a new conversation thread in your database. Your createThread function is responsible for generating and returning the new unique threadId. This is the recommended approach for starting new conversations, as it ensures a record is created in your backend from the very beginning.

Automatic Generation (Fallback): In cases where you don’t provide a threadId and your history adapter does not have a createThread method but does have a get method, AgentKit provides a fallback. It will automatically generate a standard UUID and assign it as the threadId for the current run. This convenience ensures the conversation can proceed with a unique identifier for saving and loading history, even without an explicit creation step.

​
Best Practices
Leverage Inngest's Durable Steps

Handle Missing Threads Gracefully

Index Your Database Properly

​
Future Enhancements
The history system provides a foundation for advanced features to be released in the coming future including:

Database Adapters: Pre-built adapters for popular databases (coming soon)
Progressive Summarization: Automatic conversation compression for long threads
Search & Retrieval: Semantic search across conversation history
​
Complete Example
Check out the AgentKit Starter for a complete implementation featuring:

PostgreSQL history adapter
ChatGPT-style UI with thread management
Real-time streaming responses
Both server and client-authoritative patterns
The starter includes everything you need to build a conversational AI application with persistent history.

Memory
Learn how to give your agents long-term, reflective memory using Mem0.

​
Overview
AgentKit allows you to equip your agents with long-term memory, enabling them to recall past interactions, learn user preferences, and maintain context across conversations. By integrating with Mem0, you can build sophisticated agents that offer personalized and context-aware experiences.

A key advantage of combining Mem0 with AgentKit is the power of Inngest for handling memory operations. When an agent needs to create, update, or delete a memory, it can send an event to Inngest for durable background processing. This means:

Faster Responses
Your agent can respond to the user immediately, without waiting for database writes to complete.

Durable Background Processing
The memory operation runs reliably in the background as a separate, durable Inngest function. If it fails, Inngest automatically retries it.

​
Memory Tools
To empower your agent with memory, you need to provide it with tools. How you design these tools can significantly impact your agent’s behavior, performance, and reliability. AgentKit supports multiple patterns for memory tools, allowing you to choose the best fit for your use case.

The core idea is to abstract memory operations (create, read, update, delete) into tools that an agent can call. These tools can then use Inngest to perform the actual database writes asynchronously, ensuring the agent remains responsive.


Copy

Ask AI
// From examples/mem0-memory/memory-tools.ts

const createMemoriesTool = createTool({
  name: "create_memories",
  description: "Save one or more new pieces of information to memory.",
  parameters: z.object({
    statements: z
      .array(z.string())
      .describe("The pieces of information to memorize."),
  }),
  handler: async ({ statements }, { step }) => {
    // 1. Send an event to an Inngest function for background processing
    await step?.sendEvent("send-create-memories-event", {
      name: "app/memories.create",
      data: {
        statements,
      },
    });
    // 2. Return immediately to the user
    return `I have scheduled the creation of ${statements.length} new memories.`;
  },
});

// A separate Inngest function handles the event
const addMemoriesFn = inngest.createFunction(
  { id: "add-memories" },
  { event: "app/memories.create" },
  async ({ event }) => {
    // 3. Perform the durable memory operation
    const { statements } = event.data;
    await mem0.add(statements.map((s) => ({ role: "user", content: s })));
    return { status: `Added ${statements.length} memories.` };
  }
);
Let’s explore two common patterns for designing and integrating these tools into agents.

​
Pattern 1: Granular, Single-Purpose Tools
This pattern involves creating a distinct tool for each memory operation:

create_memories: Adds new information.
recall_memories: Retrieves existing information.
update_memories: Corrects or changes existing information.
delete_memories: Removes information.
This gives the agent fine-grained control, but requires it to make more decisions and more tool calls.

Here’s how you might define the recall_memories and create_memories tools:


Copy

Ask AI
// From examples/voice-assistant/tools/memory.ts

const recallMemoriesTool = createTool({
  name: "recall_memories",
  description: `Recall memories relevant to one or more queries. Can run multiple queries in parallel.`,
  parameters: z.object({
    queries: z
      .array(z.string())
      .describe(
        `The questions to ask your memory to find relevant information.`
      ),
  }),
  handler: async ({ queries }, { step, network }) => {
    // ... implementation to search memories ...
  },
});

const createMemoriesTool = createTool({
  name: "create_memories",
  description: "Save one or more new pieces of information to memory.",
  parameters: z.object({
    statements: z
      .array(z.string())
      .describe("The pieces of information to memorize."),
  }),
  handler: async ({ statements }, { step }) => {
    await step?.sendEvent("send-create-memories-event", {
      name: "app/memories.create",
      data: { statements },
    });
    return `I have scheduled the creation of ${statements.length} new memories.`;
  },
});
This approach is used in the Autonomous Agent pattern described below, where a single, powerful LLM is prompted to reason about which of the specific tools to use at each turn.

​
Pattern 2: Consolidated Tools
This pattern simplifies the agent’s job by consolidating write operations into a single tool.

recall_memories: Same as above, for reading.
manage_memories: A single tool that handles creating, updating, and deleting memories in one atomic action.
This reduces the number of tools the agent needs to know about and can make its behavior more predictable. It’s particularly effective in structured, multi-agent workflows.

The manage_memories tool can accept lists of creations, updates, and deletions, and then send corresponding events to Inngest.


Copy

Ask AI
// From examples/voice-assistant/tools/memory.ts

const manageMemoriesTool = createTool({
  name: "manage_memories",
  description: `Create, update, and/or delete memories in a single atomic operation. This is the preferred way to modify memories.`,
  parameters: z.object({
    creations: z
      .array(z.string())
      .optional()
      .describe("A list of new statements to save as memories."),
    updates: z
      .array(
        z.object({
          id: z.string().describe("The unique ID of the memory to update."),
          statement: z
            .string()
            .describe("The new, corrected information to save."),
        })
      )
      .optional()
      .describe("A list of memories to update."),
    deletions: z
      .array(
        z.object({
          id: z.string().describe("The unique ID of the memory to delete."),
        })
      )
      .optional()
      .describe("A list of memories to delete."),
  }),
  handler: async ({ creations, updates, deletions }, { step }) => {
    // Send events to Inngest for background processing
    if (creations?.length) {
      await step?.sendEvent("create-memories", {
        name: "app/memories.create",
        data: { statements: creations },
      });
    }
    if (updates?.length) {
      await step?.sendEvent("update-memories", {
        name: "app/memories.update",
        data: { updates },
      });
    }
    if (deletions?.length) {
      await step?.sendEvent("delete-memories", {
        name: "app/memories.delete",
        data: { deletions },
      });
    }
    return `Scheduled memory operations.`;
  },
});
This consolidated manage_memories tool is a perfect fit for a multi-agent network, where a dedicated “Memory Updater” agent has the single, clear responsibility of calling this tool at the end of a conversation - only running once with a tool that can emit many events / memory operations.

​
Deterministic vs Non-Deterministic Memory
There are two primary patterns for integrating memory into your agents:

Autonmous Agent w/ Tools (Non-Deterministic): A single, powerful agent is given memory-related tools and decides for itself when and how to use them based on its system prompt and the conversation. This approach offers maximum flexibility and autonomy.
Multi-Agent or Lifecycle-based (Deterministic): The process is broken down into a structured sequence of specialized agents (e.g., one for retrieval, one for responding, one for updating memory), orchestrated by a code-based router. This approach provides predictability and control.
Let’s explore both!

​
Pattern 1: Autonomous Agent with Memory Tools
In this setup, a single agent is responsible for all tasks. Its system prompt instructs it to follow a recall-reflect-respond process. The agent uses its own reasoning (powered by the LLM) to decide which memory tool to use, making the flow non-deterministic.

​
Example Agent
Here is an agent designed to manage its own memory. Note the detailed system prompt guiding its behavior.


Copy

Ask AI
// From examples/mem0-memory/index.ts
const mem0Agent = createAgent({
  name: "reflective-mem0-agent",
  description:
    "An agent that can reflect on and manage its memories using mem0.",
  system: `
    You are an assistant with a dynamic, reflective memory. You must actively manage your memories to keep them accurate
    and strategically for search queries to retrieve the most relevant memories related to the user and their query.

    On every user interaction, you MUST follow this process:
    1.  **RECALL**: Use the 'recall_memories' tool with a list of queries relevant to the user's input to get context.
    2.  **ANALYZE & REFLECT**:
        - Compare the user's new statement with the memories you recalled.
        - If there are direct contradictions, you MUST use the 'update_memories' tool to correct the old memories.
        - If old memories are now irrelevant or proven incorrect based on the discussion, you MUST use the 'delete_memories' tool.
        - If this is brand new information that doesn't conflict, you may use the 'create_memories' tool.
    3.  **RESPOND**: Never make mention to the user of any memory operations you have executed.
`,
  tools: [
    createMemoriesTool,
    recallMemoriesTool,
    updateMemoriesTool,
    deleteMemoriesTool,
  ],
  model: openai({ model: "gpt-4o" }),
});
​
Execution Flow
The agent’s internal monologue drives the process, deciding which tools to call in sequence.

Mem0 SDK
Inngest
Memory Tools
Autonomous Agent
AgentKit Server
User
Mem0 SDK
Inngest
Memory Tools
Autonomous Agent
AgentKit Server
User
Agent generates multiple
search queries
Background Processing
User Input
agent.run(input)
recall_memories(...)
Parallel .search() calls
Returns memories
Returns unique memories
ANALYZE & REFLECT
update_memories(...) or delete_memories(...) etc.
sendEvent('app/memories.update')
Listens for event
.update(id, statement)
Success
"Scheduled"
FORMULATE RESPONSE
Final response
Streams response
Pros:

Flexibility & Autonomy: The agent can handle unforeseen scenarios by reasoning about which tools to use.

Simpler Setup: Requires only one agent and a comprehensive prompt.

Cons:

Unpredictability: The agent’s behavior can be inconsistent. It might get stuck in loops, call tools in the wrong order, or fail to answer the user’s question directly.

Complex Prompting: The system prompt must be carefully engineered to cover all cases, which can be brittle and hard to maintain.

​
Pattern 2: Multi-Agent Network for Memory
To address the unpredictability of a single autonomous agent, you can use a deterministic, multi-agent network. The workflow is broken down into a sequence of specialized agents orchestrated by a code-based router.

​
Example Agents & Router
The process is divided into three distinct steps, each handled by a dedicated agent:

Memory Retrieval Agent: Its sole job is to use the recall_memories tool.
Personal Assistant Agent: Has no tools. Its only job is to synthesize the final answer for the user based on the retrieved memories and history.
Memory Updater Agent: Reviews the entire conversation and uses a manage_memories tool to perform all necessary creations, updates, and deletions in one go.

Copy

Ask AI
// From examples/mem0-memory/multi-agent.ts

// 1. Retrieval Agent
const memoryRetrievalAgent = createAgent({
  name: "memory-retrieval-agent",
  description: "Retrieves relevant memories based on the user query.",
  system: `Your only job is to use the 'recall_memories' tool. ...`,
  tools: [recallMemoriesTool],
  // ...
});

// 2. Assistant Agent
const personalAssistantAgent = createAgent({
  name: "personal-assistant-agent",
  description: "A helpful personal assistant that answers user questions.",
  system: `Answer the user's question based on the conversation history...`,
  // No tools
  // ...
});

// 3. Updater Agent
const memoryUpdaterAgent = createAgent({
  name: "memory-updater-agent",
  description: "Reflects on the conversation and updates memories.",
  system: `Analyze the entire conversation history... you MUST use the 'manage_memories' tool...`,
  tools: [manageMemoriesTool],
  // ...
});

// The Router enforces the sequence
const multiAgentMemoryNetwork = createNetwork({
  name: "multi-agent-memory-network",
  agents: [memoryRetrievalAgent, personalAssistantAgent, memoryUpdaterAgent],
  router: async ({ callCount }) => {
    if (callCount === 0) return memoryRetrievalAgent;
    if (callCount === 1) return personalAssistantAgent;
    if (callCount === 2) return memoryUpdaterAgent;
    return undefined; // Stop the network
  },
  // ...
});
​
Execution Flow
The router guarantees a predictable, step-by-step execution path.

Mem0 SDK
Inngest
Memory Tools
Updater Agent
Assistant Agent
Retrieval Agent
Router
AgentKit Server
User
Mem0 SDK
Inngest
Memory Tools
Updater Agent
Assistant Agent
Retrieval Agent
Router
AgentKit Server
User
Background Processing
User Input
network.run(input)
(callCount == 0)
recall_memories(...)
returns unique memories
(callCount == 1)
Synthesizes answer
Final answer
(callCount == 2)
manage_memories(...)
sendEvent (create/update/delete)
Handles memory ops
Success
"Scheduled"
Network finished
Streams final answer
Pros:

Predictability & Control: The workflow is explicit and reliable. Each agent has a single, well-defined responsibility.

Maintainability: It’s easier to debug and modify a specific part of the process without affecting the others.

Cons:

More Boilerplate: Requires defining multiple agents and a router, which can be more verbose for simple use cases.

Less Flexible: The rigid structure may not adapt as well to unexpected conversational turns compared to an autonomous agent which can determine on its own - when memories should be retrieved.

​
Advanced Patterns
​
State-Based Memory Retrieval / Routing
Instead of callCount, you can use the network state to create more flexible and explicit routing logic. This is powerful when different agents have different memory needs.


Copy

Ask AI
// Define your network state interface
interface NetworkState {
  memoriesRetrieved?: boolean;
  assistantResponded?: boolean;
}

// Use state-based routing
const network = createNetwork<NetworkState>({
  //...
  router: async ({ network }) => {
    const state = network.state.data;

    if (!state.memoriesRetrieved) {
      // In a real implementation, the agent's tool would set this state
      // For example: network.state.data.memoriesRetrieved = true;
      return memoryRetrievalAgent;
    }
    if (!state.assistantResponded) {
      return personalAssistantAgent;
    }
    return memoryUpdaterAgent;
  },
});
​
Lifecycle Integration
For a more seamless approach, you can integrate memory operations directly into an agent’s or network’s lifecycle hooks, avoiding the need for explicit memory tools.

onStart: Fetch memories before an agent runs and inject them into the prompt.
onFinish: Analyze the conversation after an agent has run and schedule memory updates.

Copy

Ask AI
const agentWithLifecycleMemory = createAgent({
  // ... agent config ...
  lifecycle: {
    async onStart({ input, prompt }) {
      // 1. Fetch memories using a custom utility
      const memories = await recallMemoriesForAgent(input);
      // 2. Add memories to the prompt for context
      const memoryMessages = formatMemoriesAsMessages(memories);
      prompt.push(...memoryMessages);
      return { prompt, stop: false };
    },
    async onFinish({ result, network }) {
      // 3. Analyze the full conversation to decide on memory operations.
      await analyzeAndManageMemories(result, network.state.data);
    },
  },
});
