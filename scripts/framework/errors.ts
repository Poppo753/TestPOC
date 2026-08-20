export class ScriptSuiteError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ConfigurationError extends ScriptSuiteError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super("CONFIGURATION_ERROR", message, context);
  }
}

export class PreflightError extends ScriptSuiteError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super("PREFLIGHT_ERROR", message, context);
  }
}

export class OperationError extends ScriptSuiteError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super("OPERATION_ERROR", message, context);
  }
}

export function serializeError(error: unknown): { code: string; message: string; context?: Record<string, unknown> } {
  if (error instanceof ScriptSuiteError) {
    return { code: error.code, message: error.message, context: error.context };
  }
  if (error instanceof Error) {
    return { code: "UNEXPECTED_ERROR", message: error.message };
  }
  return { code: "UNEXPECTED_ERROR", message: String(error) };
}

