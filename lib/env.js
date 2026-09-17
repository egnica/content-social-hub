import "server-only";

export class ConfigurationError extends Error {
  constructor(variableName) {
    super(`Missing required environment variable: ${variableName}`);
    this.name = "ConfigurationError";
    this.variableName = variableName;
  }
}

export function requireEnv(variableName) {
  const value = process.env[variableName]?.trim();

  if (!value) {
    throw new ConfigurationError(variableName);
  }

  return value;
}

export function getDatabaseName() {
  return process.env.MONGODB_DB?.trim() || "content_social_hub";
}

export function getAwsRegion() {
  return (
    process.env.APP_AWS_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "us-east-2"
  );
}
