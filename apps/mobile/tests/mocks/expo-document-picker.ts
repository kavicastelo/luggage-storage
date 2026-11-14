export interface DocumentPickerAsset {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}

export type DocumentPickerResult =
  | { canceled: true; assets: null }
  | { canceled: false; assets: DocumentPickerAsset[] };

export async function getDocumentAsync(_options?: {
  type?: string | string[];
  copyToCacheDirectory?: boolean;
  multiple?: boolean;
}): Promise<DocumentPickerResult> {
  return {
    canceled: true,
    assets: null
  };
}

