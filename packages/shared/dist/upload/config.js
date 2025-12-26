"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2_CONFIG = exports.UPLOAD_CONFIGS = void 0;
exports.getUploadTypeFromMimeType = getUploadTypeFromMimeType;
exports.validateFile = validateFile;
exports.UPLOAD_CONFIGS = {
    IMAGE: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: [
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/gif",
            "image/webp",
            "image/svg+xml",
        ],
        allowedExtensions: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
    },
    DOCUMENT: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "text/markdown",
            "application/json",
            "text/javascript",
            "text/typescript",
            "text/jsx",
            "text/tsx",
            "text/css",
            "text/html",
            "text/xml",
            "application/javascript",
            "application/typescript",
            "application/x-javascript",
            "application/x-typescript",
        ],
        allowedExtensions: [
            ".pdf",
            ".doc",
            ".docx",
            ".txt",
            ".md",
            ".json",
            ".js",
            ".jsx",
            ".ts",
            ".tsx",
            ".css",
            ".html",
            ".xml",
            ".py",
            ".java",
            ".c",
            ".cpp",
            ".h",
            ".hpp",
            ".cs",
            ".rb",
            ".go",
            ".rs",
            ".php",
            ".swift",
            ".kt",
            ".scala",
            ".sh",
            ".bash",
            ".yml",
            ".yaml",
            ".toml",
            ".ini",
            ".env",
        ],
    },
    VIDEO: {
        maxSize: 100 * 1024 * 1024, // 100MB
        allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
        allowedExtensions: [".mp4", ".webm", ".mov"],
    },
    AUDIO: {
        maxSize: 50 * 1024 * 1024, // 50MB
        allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
        allowedExtensions: [".mp3", ".wav", ".ogg", ".webm"],
    },
    OTHER: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ["*/*"], // Allow all
        allowedExtensions: [], // Allow all
    },
};
// R2 Configuration
exports.R2_CONFIG = {
    BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME || "shipper-uploads",
    PUBLIC_URL: process.env.CLOUDFLARE_R2_PUBLIC_URL || "",
    ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || "",
    ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
    SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
    REGION: "auto", // R2 uses 'auto' region
};
// Helper to determine upload type from MIME type
function getUploadTypeFromMimeType(mimeType) {
    if (mimeType.startsWith("image/"))
        return "IMAGE";
    if (mimeType.startsWith("video/"))
        return "VIDEO";
    if (mimeType.startsWith("audio/"))
        return "AUDIO";
    if (mimeType === "application/pdf" ||
        mimeType.includes("document") ||
        mimeType.startsWith("text/")) {
        return "DOCUMENT";
    }
    return "OTHER";
}
// Helper to validate file
function validateFile(file, uploadType) {
    const config = exports.UPLOAD_CONFIGS[uploadType];
    // Check size
    if (file.size > config.maxSize) {
        return {
            valid: false,
            error: `File size exceeds ${config.maxSize / (1024 * 1024)}MB limit`,
        };
    }
    // Check MIME type
    const isAllowedMimeType = config.allowedMimeTypes.some((allowed) => {
        if (allowed === "*/*")
            return true;
        if (allowed.endsWith("/*")) {
            return file.type.startsWith(allowed.replace("/*", ""));
        }
        return file.type === allowed;
    });
    if (!isAllowedMimeType) {
        return {
            valid: false,
            error: "File type not allowed",
        };
    }
    // Check extension
    if (config.allowedExtensions.length > 0) {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (!config.allowedExtensions.includes(ext)) {
            return {
                valid: false,
                error: "File extension not allowed",
            };
        }
    }
    return { valid: true };
}
//# sourceMappingURL=config.js.map