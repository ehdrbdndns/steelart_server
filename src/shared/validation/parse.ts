import { z, type ZodType } from 'zod';

import { AppError, type AppErrorCode } from '../api/errors.js';

export interface ValidationIssue {
  code: string;
  message: string;
  path: string;
}

export interface ValidationDetails {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
  issues: ValidationIssue[];
}

export interface ParseInputArgs<TSchema extends ZodType> {
  schema: TSchema;
  input: unknown;
  code?: AppErrorCode;
  message?: string;
}

export function formatZodError(error: z.ZodError): ValidationDetails {
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');

    if (path.length === 0) {
      formErrors.push(issue.message);
    } else {
      fieldErrors[path] ??= [];
      fieldErrors[path].push(issue.message);
    }

    return {
      code: issue.code,
      message: issue.message,
      path,
    };
  });

  return {
    fieldErrors,
    formErrors,
    issues,
  };
}

export function parseInput<TSchema extends ZodType>({
  schema,
  input,
  code,
  message,
}: ParseInputArgs<TSchema>): z.output<TSchema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new AppError(code ?? 'VALIDATION_ERROR', {
      details: formatZodError(result.error),
      message: message ?? 'Validation failed',
    });
  }

  return result.data;
}
