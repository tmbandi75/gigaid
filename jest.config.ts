import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'api',
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
    },
    {
      displayName: 'encouragement',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/encouragement/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.json',
          diagnostics: false,
        }],
      },
      testTimeout: 10000,
      modulePathIgnorePatterns: ['<rootDir>/.cache/'],
    },
    {
      displayName: 'utils',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/utils/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.json',
          diagnostics: false,
        }],
      },
      testTimeout: 10000,
      modulePathIgnorePatterns: ['<rootDir>/.cache/'],
    },
    {
      displayName: 'nba',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/nba/**/*.test.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/client/src/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1',
      },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.json',
          diagnostics: false,
        }],
      },
      testTimeout: 10000,
      modulePathIgnorePatterns: ['<rootDir>/.cache/'],
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/client/**/*.test.tsx'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/client/src/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1',
        '^@assets/(.*)$': '<rootDir>/attached_assets/$1',
        '\\.(css|less|scss|sass)$': '<rootDir>/tests/client/styleMock.ts',
      },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: '<rootDir>/tests/client/tsconfig.json',
          diagnostics: false,
        }],
      },
      testTimeout: 15000,
      modulePathIgnorePatterns: ['<rootDir>/.cache/'],
    },
  ],
};

export default config;
