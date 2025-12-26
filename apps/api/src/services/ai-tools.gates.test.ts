import { describe, it, expect, vi, beforeEach } from "vitest";
import { runBuildValidationGate, ensurePreviewHealthy } from "./ai-tools.js";

const {
  prismaUpdateMock,
  validateBuildMock,
  modalExecuteMock,
  probePreviewUrlMock,
} = vi.hoisted(() => ({
  prismaUpdateMock: vi.fn(),
  validateBuildMock: vi.fn(),
  modalExecuteMock: vi.fn(),
  probePreviewUrlMock: vi.fn(),
}));

vi.mock("@shipper/database", () => {
  return {
    prisma: {
      project: {
        update: prismaUpdateMock,
      },
    },
    ProjectBuildStatus: {
      READY: "READY",
      ERROR: "ERROR",
    },
    ErrorStatus: {
      DETECTED: "DETECTED",
      FIXING: "FIXING",
      RESOLVED: "RESOLVED",
    },
    ErrorType: {
      BUILD: "BUILD",
      IMPORT: "IMPORT",
      NAVIGATION: "NAVIGATION",
      RUNTIME: "RUNTIME",
    },
    ErrorSeverity: {
      LOW: "LOW",
      MEDIUM: "MEDIUM",
      HIGH: "HIGH",
      CRITICAL: "CRITICAL",
    },
  };
});

vi.mock("./validation-utils.js", () => {
  return {
    validateBuild: validateBuildMock,
  };
});

vi.mock("./modal-sandbox-manager.js", () => {
  return {
    executeCommand: modalExecuteMock,
    getSandbox: vi.fn(),
    createSandbox: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    listFiles: vi.fn(),
    startDevServer: vi.fn(),
    createFilesystemSnapshot: vi.fn(),
  };
});

vi.mock("./daytona-sandbox-manager.js", () => ({
  getSandbox: vi.fn(),
  createSandbox: vi.fn(),
  createGitCommit: vi.fn(),
  getDevServerStatus: vi.fn(),
  getSkipWarningHeaders: () => ({
    "X-Daytona-Skip-Preview-Warning": "true",
  }),
}));

vi.mock("./daytona-playwright-manager.js", () => ({
  runPlaywrightRuntimeCheck: vi.fn(),
}));

vi.mock("./preview-health.js", () => ({
  probePreviewUrl: probePreviewUrlMock,
}));

const projectId = "test-project-id";

beforeEach(() => {
  prismaUpdateMock.mockReset();
  prismaUpdateMock.mockResolvedValue({});

  validateBuildMock.mockReset();
  validateBuildMock.mockImplementation(async (_sandbox, results) => {
    results.build.passed = true;
    results.build.issues = [];
  });

  modalExecuteMock.mockReset();
  modalExecuteMock.mockResolvedValue({
    exitCode: 0,
    stderr: "",
    stdout: "",
  });

  probePreviewUrlMock.mockReset();
  probePreviewUrlMock.mockResolvedValue({
    healthy: true,
    statusCode: 200,
    responseTime: 25,
  });
});

describe("runBuildValidationGate", () => {
  it("marks project ready when Daytona build passes", async () => {
    validateBuildMock.mockImplementationOnce(async (_sandbox, results) => {
      results.build.passed = true;
      results.build.issues = [];
    });

    await expect(
      runBuildValidationGate({ projectId } as any, { sandbox: {} }),
    ).resolves.not.toThrow();

    expect(validateBuildMock).toHaveBeenCalled();
    expect(modalExecuteMock).not.toHaveBeenCalled();
    expect(prismaUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          buildStatus: "READY",
          buildError: null,
        }),
      }),
    );
  });

  it("throws and marks project error when Daytona build fails", async () => {
    validateBuildMock.mockImplementationOnce(async (_sandbox, results) => {
      results.build.passed = false;
      results.build.issues = ["TypeScript error: missing semicolon"];
    });

    await expect(
      runBuildValidationGate({ projectId } as any, { sandbox: {} }),
    ).rejects.toThrow(/TypeScript error/);

    expect(prismaUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          buildStatus: "ERROR",
          buildError: expect.stringContaining("TypeScript error"),
        }),
      }),
    );
  });

  it("runs TypeScript check for Modal sandboxes", async () => {
    modalExecuteMock.mockResolvedValueOnce({
      exitCode: 0,
      stderr: "",
      stdout: "",
    });

    await expect(
      runBuildValidationGate({ projectId } as any, {
        sandboxId: "sandbox-123",
      }),
    ).resolves.not.toThrow();

    expect(modalExecuteMock).toHaveBeenCalledWith(
      "sandbox-123",
      expect.stringContaining("bunx tsc"),
      expect.objectContaining({ timeoutMs: 60000 }),
    );
    expect(prismaUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ buildStatus: "READY" }),
      }),
    );
  });

  it("throws when Modal TypeScript check fails", async () => {
    modalExecuteMock.mockResolvedValueOnce({
      exitCode: 1,
      stderr: "Cannot find module './foo'",
      stdout: "",
    });

    await expect(
      runBuildValidationGate({ projectId } as any, {
        sandboxId: "sandbox-456",
      }),
    ).rejects.toThrow(/Cannot find module/);

    expect(prismaUpdateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          buildStatus: "ERROR",
          buildError: expect.stringContaining("Cannot find module"),
        }),
      }),
    );
  });
});

describe("ensurePreviewHealthy", () => {
  it("uses existing sandbox URL and passes Daytona headers", async () => {
    const context: any = {
      projectId,
      sandboxUrl: undefined,
    };

    await expect(
      ensurePreviewHealthy(context, {
        sandboxUrl: "https://preview--123.shipper.now",
      }),
    ).resolves.not.toThrow();

    expect(context.sandboxUrl).toBe("https://preview--123.shipper.now");
    expect(probePreviewUrlMock).toHaveBeenCalledWith(
      "https://preview--123.shipper.now",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Daytona-Skip-Preview-Warning": "true",
        }),
      }),
    );
  });

  it("throws when preview probe reports unhealthy", async () => {
    probePreviewUrlMock.mockResolvedValueOnce({
      healthy: false,
      reason: "Timeout after 10000ms",
      statusCode: 503,
      responseTime: 10000,
    });

    await expect(
      ensurePreviewHealthy({ projectId } as any, {
        sandboxUrl: "https://broken-preview",
      }),
    ).rejects.toThrow(/Timeout after 10000ms/);
  });
});
