export interface Config {
  port: number;
  host: string;
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  logLevel: string;
  corsOrigins: string[];
}

export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${name} is required`);
    }
    return defaultValue;
  }
  return value;
}

function getEnvVarAsNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  const numValue = parseInt(value, 10);
  if (isNaN(numValue)) {
    throw new Error(`Environment variable ${name} must be a valid number`);
  }
  return numValue;
}

function getEnvVarAsArray(name: string, defaultValue: string[] = []): string[] {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

const nodeEnv = getEnvVar('NODE_ENV', 'development');

export const config: Config = {
  port: getEnvVarAsNumber('PORT', 4000),
  host: getEnvVar('HOST', '0.0.0.0'),
  nodeEnv,
  isDevelopment: nodeEnv === 'development',
  isProduction: nodeEnv === 'production',
  logLevel: getEnvVar('LOG_LEVEL', nodeEnv === 'development' ? 'debug' : 'info'),
  corsOrigins: getEnvVarAsArray('CORS_ORIGINS', ['http://localhost:4000']),
};