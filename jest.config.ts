import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/api/**/*.test.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      diagnostics: false,
    }],
  },
  testTimeout: 30000,
  modulePathIgnorePatterns: ['<rootDir>/.cache/'],
};

export default config;
