export interface FeatureFlagsEnvInput {
  VITE_FEATURE_REVIEWS?: string | boolean;
  VITE_FEATURE_PROMOTIONS?: string | boolean;
}

function parseBooleanFeatureFlag(
  rawFlag: string | boolean | undefined,
  defaultValue = false
): boolean {
  if (typeof rawFlag === "boolean") {
    return rawFlag;
  }
  if (typeof rawFlag === "string") {
    const normalized = rawFlag.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return defaultValue;
}

function resolveFeatureEnv(envInput?: FeatureFlagsEnvInput): FeatureFlagsEnvInput {
  if (envInput) return envInput;
  return (import.meta as unknown as { env?: FeatureFlagsEnvInput }).env ?? {};
}

export function isFeatureReviewsEnabled(envInput?: FeatureFlagsEnvInput): boolean {
  return parseBooleanFeatureFlag(resolveFeatureEnv(envInput).VITE_FEATURE_REVIEWS, false);
}

export function isFeaturePromotionsEnabled(envInput?: FeatureFlagsEnvInput): boolean {
  return parseBooleanFeatureFlag(resolveFeatureEnv(envInput).VITE_FEATURE_PROMOTIONS, false);
}
