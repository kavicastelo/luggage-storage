/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ENABLE_DEMO_PREVIEW?: string;
  readonly VITE_FEATURE_REVIEWS?: string;
  readonly VITE_FEATURE_PROMOTIONS?: string;
  readonly VITE_MAPTILER_KEY?: string;
  readonly [key: string]: unknown;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
