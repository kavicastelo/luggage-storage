import {
  ALLOWED_MIME_TYPES,
  ConfirmUploadResponse,
  HOST_DOCUMENT_TYPES,
  MAX_FILE_SIZE_BYTES,
  UploadPurpose
} from "@luggage-storage/contracts";
import { marketplaceApi } from "@/services/marketplace-api";

export interface UploadToR2Params {
  file: File;
  purpose: UploadPurpose;
  resourceId: string;
  documentType?: (typeof HOST_DOCUMENT_TYPES)[number] | null;
  caption?: string | null;
  isPrimary?: boolean;
}

export interface UploadedR2Result {
  intentId: string;
  fileKey: string;
  confirmed: ConfirmUploadResponse;
}

export function validateFileForUpload(file: File, purpose: UploadPurpose): void {
  const allowed = ALLOWED_MIME_TYPES[purpose] as readonly string[];
  if (!file.type || !allowed.includes(file.type)) {
    throw new Error(
      `Unsupported file type "${file.type || "unknown"}". Allowed types: ${allowed.join(", ")}.`
    );
  }

  const maxBytes = MAX_FILE_SIZE_BYTES[purpose];
  if (file.size <= 0 || file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`File "${file.name}" must be between 1 byte and ${maxMb} MB.`);
  }
}

/**
 * Performs the 3-step R2/mock-storage upload flow:
 * 1) Initiate pre-signed upload intent via authenticated API
 * 2) Direct binary PUT to uploadUrl with strict SEC-08 credential isolation
 * 3) Confirm upload via authenticated API
 */
export async function uploadFileToR2(params: UploadToR2Params): Promise<UploadedR2Result> {
  const { file, purpose, resourceId, documentType, caption, isPrimary = false } = params;

  validateFileForUpload(file, purpose);

  const initiated = await marketplaceApi.initiateUpload({
    purpose,
    resourceType:
      purpose === "HOST_VERIFICATION"
        ? "HOST_BUSINESS"
        : purpose === "CUSTODY_EVIDENCE"
          ? "BOOKING"
          : "STORAGE_LOCATION",
    resourceId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type
  });

  // SEC-08: NEVER send Authorization headers or session cookies to pre-signed object storage URLs
  const putResponse = await fetch(initiated.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type
    },
    body: file,
    credentials: "omit"
  });

  if (!putResponse.ok) {
    throw new Error(
      `Direct storage upload failed with HTTP ${putResponse.status} ${putResponse.statusText}`
    );
  }

  const confirmed = await marketplaceApi.confirmUpload({
    intentId: initiated.intentId,
    fileKey: initiated.fileKey,
    purpose,
    resourceId,
    documentType: documentType ?? undefined,
    caption: caption ?? undefined,
    isPrimary
  });

  return {
    intentId: initiated.intentId,
    fileKey: initiated.fileKey,
    confirmed
  };
}
