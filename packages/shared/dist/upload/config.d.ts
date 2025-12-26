import type { UploadType } from "./types";
export interface UploadConfig {
    maxSize: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
}
export declare const UPLOAD_CONFIGS: Record<UploadType, UploadConfig>;
export declare const R2_CONFIG: {
    BUCKET_NAME: string;
    PUBLIC_URL: string;
    ACCOUNT_ID: string;
    ACCESS_KEY_ID: string;
    SECRET_ACCESS_KEY: string;
    REGION: string;
};
export declare function getUploadTypeFromMimeType(mimeType: string): UploadType;
export declare function validateFile(file: {
    size: number;
    type: string;
    name: string;
}, uploadType: UploadType): {
    valid: boolean;
    error?: string;
};
//# sourceMappingURL=config.d.ts.map