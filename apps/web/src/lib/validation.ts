import { z } from "zod";

export interface ValidationSuccess<T> {
  success: true;
  data: T;
  errors?: never;
}

export interface ValidationFailure {
  success: false;
  errors: Record<string, string>;
  data?: never;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validates form data against a Zod schema and maps issues to field-keyed error messages.
 */
export function validateWithZod<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0]?.toString() || "root";
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }

  return { success: false, errors };
}

