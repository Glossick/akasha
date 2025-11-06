/**
 * ESLint Configuration for Semantic Map GraphRAG Project
 * 
 * This configuration file serves as both a linting rule set AND a comprehensive
 * guide for LLM agents working with this codebase. Each rule includes detailed
 * comments explaining WHY the pattern is enforced, not just WHAT it does.
 * 
 * CRITICAL FOR LLM AGENTS: Read all comments carefully. They explain the
 * architectural decisions, code patterns, and constraints that make this
 * codebase maintainable and sustainable.
 * 
 * ============================================================================
 * ARCHITECTURAL PRINCIPLES & CODE ORGANIZATION PATTERNS
 * ============================================================================
 * 
 * This codebase follows predictable architectural patterns that ensure code
 * organization remains consistent as the codebase grows. These patterns are
 * designed to be self-documenting and LLM-friendly.
 * 
 * 1. SERVICE LAYER ARCHITECTURE (Backend)
 *    - Each service is a class in backend/src/services/
 *    - Services accept optional dependencies in constructor (DI pattern)
 *    - Services encapsulate one domain concern (Neo4j, Embedding, GraphRAG)
 *    - All public methods have explicit return types
 *    - Services are testable through dependency injection
 * 
 * 2. COMPONENT ARCHITECTURE (Frontend)
 *    - Components are functional components in frontend/public/components/
 *    - Each component has a TypeScript interface for props
 *    - Components are composed hierarchically (parent → child)
 *    - State is lifted up when shared between components
 *    - Components handle their own local state and API calls
 * 
 * 3. MODULE ORGANIZATION
 *    - backend/src/services/ - Business logic services
 *    - backend/src/config/ - Configuration files
 *    - backend/src/types/ - Shared TypeScript types
 *    - backend/src/utils/ - Pure utility functions
 *    - backend/src/__tests__/ - Test files mirror source structure
 *    - frontend/public/components/ - React components
 *    - frontend/public/utils/ - Frontend utilities
 *    - frontend/public/__tests__/ - Frontend tests
 * 
 * 4. CODE ORGANIZATION PATTERNS
 *    - One class/component per file
 *    - Related types in shared types file
 *    - Utilities are pure functions (no side effects)
 *    - Tests mirror source structure
 * 
 * 5. DEPENDENCY FLOW
 *    - Backend: app.ts → services → config/types/utils
 *    - Frontend: app.tsx → components → api.ts → utils
 *    - No circular dependencies
 *    - Clear dependency hierarchy
 * 
 * 6. ERROR HANDLING PATTERN
 *    - Backend: Structured error objects { error, message, hint? }
 *    - Frontend: Try/catch with user-friendly error messages
 *    - Errors are logged but not exposed to users directly
 * 
 * 7. STATE MANAGEMENT PATTERN
 *    - Frontend: useState for local state, lift when shared
 *    - Backend: Stateless services (no shared mutable state)
 *    - State flows down via props, up via callbacks
 * 
 * 8. API LAYER PATTERN
 *    - Frontend: api.ts contains all API client functions
 *    - Backend: app.ts contains all API route handlers
 *    - Types shared between frontend and backend in types/graph.ts
 *    - Consistent request/response formats
 * 
 * Architecture Principles:
 * 1. Type Safety: TypeScript strict mode with explicit types
 * 2. Service Layer: Dependency injection for testability
 * 3. Separation of Concerns: Backend services, frontend components, utilities
 * 4. Testability: All code must be easily testable with mocks
 * 5. Maintainability: Clear patterns that LLMs can follow and extend
 * 6. Self-Documentation: Code patterns explain themselves through structure
 * 7. Sustainable Development: Patterns that scale and remain maintainable
 * 8. Predictability: Code organization is predictable - you know where to add code
 */

module.exports = {
  // ============================================================================
  // ENVIRONMENT CONFIGURATION
  // ============================================================================
  // These environments define global variables available in different contexts
  // WHY: ESLint needs to know what globals are available to avoid false positives
  env: {
    // Browser environment: Provides global variables like `window`, `document`, etc.
    // Used in: Frontend React components, browser-based code
    // WHY: Frontend code uses browser APIs - need to avoid "window is not defined" errors
    browser: true,
    
    // ES2021: Modern JavaScript features (async/await, optional chaining, etc.)
    // Used in: Both backend and frontend - we use modern JavaScript throughout
    // WHY: We target modern JavaScript features - no need for polyfills or legacy code
    es2021: true,
    
    // Node.js environment: Provides Node.js globals like `process`, `Buffer`, etc.
    // Used in: Backend services, API routes, server-side code
    // WHY: Backend code uses Node.js APIs - need to avoid "process is not defined" errors
    node: true,
  },

  // ============================================================================
  // BASE RULE SETS
  // ============================================================================
  // These are industry-standard rule sets that provide sensible defaults
  // WHY: Starting with proven rule sets prevents reinventing the wheel
  extends: [
    // ESLint recommended rules: Catches common JavaScript errors and anti-patterns
    // WHY: Provides baseline quality without being overly strict
    // PATTERN: Enable recommended rules, then customize per-project needs
    'eslint:recommended',
    
    // React recommended rules: React-specific best practices
    // WHY: Ensures React components follow React patterns correctly
    // NOTE: Only applies to frontend files (React components)
    // PATTERN: Use React patterns consistently - components, hooks, props
    'plugin:react/recommended',
    
    // TypeScript recommended rules: TypeScript-specific linting
    // WHY: Catches TypeScript errors that the compiler might miss, enforces type safety
    // PATTERN: Leverage TypeScript's type system fully - no `any` types, explicit returns
    'plugin:@typescript-eslint/recommended',
  ],

  // ============================================================================
  // PARSER CONFIGURATION
  // ============================================================================
  // Configuration for TypeScript parser
  parser: '@typescript-eslint/parser',
  parserOptions: {
    // Enable JSX syntax parsing
    // WHY: We use React with TypeScript, need JSX parsing for frontend components
    // PATTERN: All frontend components use JSX/TSX syntax
    ecmaFeatures: {
      jsx: true,
    },
    // ECMAScript version: 2021 features
    // WHY: Use modern JavaScript features (optional chaining, nullish coalescing, etc.)
    // PATTERN: Prefer modern syntax - ?. operator, ?? operator, async/await
    ecmaVersion: 12,
    // Module system: ES modules (import/export)
    // WHY: We use ES modules throughout - no CommonJS require()
    // PATTERN: Always use import/export, never require/module.exports
    sourceType: 'module',
  },

  // ============================================================================
  // PLUGINS
  // ============================================================================
  // Plugins provide additional rule sets beyond the base extends
  // WHY: Extend ESLint with framework-specific and language-specific rules
  plugins: [
    // React plugin: Provides React-specific linting rules
    // WHY: React has specific patterns that should be enforced
    'react',
    // React Hooks plugin: Provides React hooks linting rules
    // WHY: React hooks have specific rules (order, dependencies, etc.) that must be enforced
    // NOTE: Uncomment when installed: bun add -d eslint-plugin-react-hooks
    // PATTERN: Hooks must be called in same order, dependencies must be exhaustive
    // 'react-hooks',
    // TypeScript ESLint plugin: Provides TypeScript-specific rules
    // WHY: TypeScript has unique patterns (generics, type guards, etc.) that need linting
    '@typescript-eslint',
  ],

  // ============================================================================
  // PLUGIN SETTINGS
  // ============================================================================
  // Configuration for plugin behavior
  settings: {
    react: {
      // Auto-detect React version from package.json
      // WHY: Allows rules to adapt to the React version we're using
      // Prevents false positives for React 17+ features (new JSX transform)
      // PATTERN: React 17+ doesn't require React import for JSX
      version: 'detect',
    },
  },

  // ============================================================================
  // GLOBAL RULES
  // ============================================================================
  // These rules apply to all files unless overridden in overrides section
  rules: {
    // ============================================================================
    // ARCHITECTURAL PATTERNS
    // ============================================================================
    // These rules enforce the architectural patterns we use throughout the codebase
    // WHY: Consistency in architecture makes code predictable and maintainable
    
    /**
     * Explicit Module Boundary Types
     * WHY: Forces all exported functions/methods to have explicit return types
     * 
     * PATTERN: All public APIs (exports, class methods) must declare return types
     * BENEFITS:
     * - Makes code self-documenting (types = documentation)
     * - Helps LLMs understand function contracts without reading implementation
     * - Catches type errors at boundaries where they matter most
     * - Improves IDE autocomplete and refactoring
     * - Enables better code generation by LLMs (they know what to return)
     * 
     * ARCHITECTURAL DECISION: We prioritize explicit contracts over convenience
     * This makes the codebase more maintainable and LLM-friendly
     * 
     * EXAMPLE GOOD:
     *   export async function queryDatabase(id: string): Promise<Entity> { ... }
     *   export class GraphRAGService {
     *     async query(query: GraphRAGQuery): Promise<GraphRAGResponse> { ... }
     *   }
     * 
     * EXAMPLE BAD:
     *   export async function queryDatabase(id: string) { ... } // Missing return type
     * 
     * SEVERITY: 'warn' - We want to catch this but not break the build
     * LLM GUIDANCE: When generating code, always include explicit return types on exports
     */
    '@typescript-eslint/explicit-module-boundary-types': 'warn',

    /**
     * No Unused Variables
     * WHY: Dead code is confusing for LLMs and humans alike
     * 
     * PATTERN: All variables must be used, except those prefixed with '_'
     * BENEFITS:
     * - Keeps codebase clean and maintainable
     * - Prevents accidental dead code from confusing LLMs
     * - The '_' prefix convention explicitly marks "intentionally unused" variables
     *   (e.g., function parameters we need for interface compliance but don't use)
     * - Makes it clear when code is intentionally unused vs accidentally forgotten
     * 
     * ARCHITECTURAL DECISION: We prefer explicit unused markers over silently ignoring
     * This makes code intent clearer for LLMs
     * 
     * EXAMPLE GOOD:
     *   const [entity, setEntity] = useState<Entity | null>(null);
     *   function handleEvent(_event: Event) { ... } // Explicitly unused
     * 
     * EXAMPLE BAD:
     *   const unusedVariable = computeSomething(); // Never used, will error
     * 
     * SEVERITY: 'error' - Unused code is always a problem
     * LLM GUIDANCE: Remove unused variables or prefix with '_' if intentionally unused
     */
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        // Allow variables prefixed with '_' to be unused
        // WHY: Common pattern for intentionally unused parameters (e.g., in callbacks)
        // PATTERN: Use '_' prefix when you need a parameter for interface compliance
        argsIgnorePattern: '^_',
        // Also allow unused vars prefixed with '_'
        varsIgnorePattern: '^_',
      },
    ],

    // ============================================================================
    // REACT-SPECIFIC PATTERNS (Frontend Only)
    // ============================================================================
    // These rules are React-specific and only apply to frontend files
    // WHY: React has specific patterns that should be enforced for consistency
    
    /**
     * React in JSX Scope
     * WHY: React 17+ doesn't require importing React for JSX
     * 
     * PATTERN: JSX can be used without `import React from 'react'`
     * BENEFITS:
     * - Modern React (17+) automatically handles JSX transform
     * - Reduces unnecessary imports
     * - Cleaner component files
     * - Less boilerplate
     * 
     * ARCHITECTURAL DECISION: We use React 17+ new JSX transform
     * This is the modern standard and reduces boilerplate
     * 
     * EXAMPLE GOOD (React 17+):
     *   export function MyComponent() {
     *     return <div>Hello</div>; // No React import needed
     *   }
     * 
     * EXAMPLE BAD (Old React):
     *   import React from 'react'; // Not needed in React 17+
     *   export function MyComponent() { ... }
     * 
     * SEVERITY: 'off' - We use React 17+, so this rule is disabled
     * LLM GUIDANCE: Don't import React just for JSX - use new JSX transform
     */
    'react/react-in-jsx-scope': 'off',

    /**
     * Prop Types
     * WHY: We use TypeScript for type checking, not React PropTypes
     * 
     * PATTERN: Use TypeScript interfaces for props, not PropTypes
     * BENEFITS:
     * - TypeScript provides compile-time type checking (better than runtime)
     * - Single source of truth for types (no duplication)
     * - Better IDE support and autocomplete
     * - Props are validated at compile time, not runtime
     * - TypeScript types are more expressive than PropTypes
     * 
     * ARCHITECTURAL DECISION: TypeScript over PropTypes for type safety
     * This provides better developer experience and LLM understanding
     * 
     * EXAMPLE GOOD:
     *   interface MyComponentProps {
     *     name: string;
     *     age: number;
     *   }
     *   function MyComponent({ name, age }: MyComponentProps) { ... }
     * 
     * EXAMPLE BAD:
     *   MyComponent.propTypes = { name: PropTypes.string }; // Don't use this
     * 
     * SEVERITY: 'off' - We use TypeScript, not PropTypes
     * LLM GUIDANCE: Always use TypeScript interfaces for component props
     */
    'react/prop-types': 'off',

    /**
     * React Display Name
     * WHY: React DevTools and debugging benefit from display names
     * 
     * PATTERN: Components should have display names for better debugging
     * BENEFITS:
     * - Better debugging experience in React DevTools
     * - Clearer error messages
     * - Easier to identify components in stack traces
     * 
     * NOTE: Function components get display names automatically from function name
     * Only need explicit displayName for anonymous components or HOCs
     * 
     * SEVERITY: 'warn' - Helpful but not critical
     * LLM GUIDANCE: Use named function components (they get display names automatically)
     */
    'react/display-name': 'warn',

    // ============================================================================
    // CODE ORGANIZATION & QUALITY
    // ============================================================================
    // These rules ensure code is organized, readable, and maintainable
    // WHY: Well-organized code is easier for LLMs to understand and modify
    
    /**
     * No Console (with exceptions)
     * WHY: Console.log statements should not be in production code
     * 
     * PATTERN: Only console.warn and console.error allowed
     * BENEFITS:
     * - Prevents accidental console.log statements in production
     * - console.warn/error are acceptable for debugging and error reporting
     * - Keeps console output clean in production
     * - Encourages proper logging infrastructure
     * 
     * ARCHITECTURAL DECISION: Structured logging preferred over console.log
     * In production, use proper logging service, not console.log
     * 
     * EXAMPLE GOOD:
     *   console.warn('Deprecated API used'); // Allowed
     *   console.error('Failed to connect:', error); // Allowed
     * 
     * EXAMPLE BAD:
     *   console.log('Debug value:', value); // Not allowed - use proper logging
     * 
     * SEVERITY: 'warn' - Catch this but don't break the build
     * LLM GUIDANCE: Use console.warn/error for important messages, avoid console.log
     */
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    /**
     * Prefer Const Over Let
     * WHY: Immutability and const makes code more predictable
     * 
     * PATTERN: Use const by default, only use let when reassignment is needed
     * BENEFITS:
     * - Makes code more predictable (can't accidentally reassign)
     * - Easier for LLMs to understand (fewer state mutations)
     * - Better for functional programming patterns
     * - Catches accidental reassignments
     * 
     * ARCHITECTURAL DECISION: Prefer immutability where possible
     * This aligns with React's immutability patterns and functional programming
     * 
     * EXAMPLE GOOD:
     *   const entity = await fetchEntity();
     *   let counter = 0; // Only if you need to reassign
     * 
     * EXAMPLE BAD:
     *   let entity = await fetchEntity(); // Should be const if not reassigned
     * 
     * SEVERITY: 'warn' - Prefer const but allow let when needed
     * LLM GUIDANCE: Always use const unless you need to reassign the variable
     */
    'prefer-const': 'warn',

    /**
     * No Var
     * WHY: var has function scope and can cause bugs, let/const have block scope
     * 
     * PATTERN: Always use let or const, never var
     * BENEFITS:
     * - Block scope is more predictable than function scope
     * - Prevents hoisting-related bugs
     * - Modern JavaScript standard
     * 
     * ARCHITECTURAL DECISION: Modern JavaScript only - no var
     * This is industry standard and prevents common bugs
     * 
     * EXAMPLE GOOD:
     *   const value = 1;
     *   let counter = 0;
     * 
     * EXAMPLE BAD:
     *   var value = 1; // Don't use var
     * 
     * SEVERITY: 'error' - var should never be used
     * LLM GUIDANCE: Never use var - always use let or const
     */
    'no-var': 'error',

    // ============================================================================
    // NAMING CONVENTIONS
    // ============================================================================
    // These rules enforce consistent naming across the codebase
    // Consistency helps LLMs understand and generate code that matches our patterns
    // WHY: Consistent naming is self-documenting and makes code predictable
    
    /**
     * Naming Convention Rules
     * WHY: Consistent naming makes code self-documenting and easier for LLMs to understand
     * 
     * PATTERN: 
     *   - Variables/functions: camelCase
     *   - Classes/Types/Interfaces: PascalCase
     *   - Constants: UPPER_CASE
     *   - Private class members: camelCase (TypeScript handles visibility)
     * 
     * BENEFITS:
     * - Immediate visual identification of what something is (type vs instance)
     * - Matches TypeScript/JavaScript conventions
     * - Makes code more readable and maintainable
     * - LLMs can generate code that matches existing patterns
     * - Self-documenting: naming tells you what it is
     * 
     * ARCHITECTURAL DECISION: Follow TypeScript/JavaScript conventions
     * This makes the codebase approachable to developers and LLMs familiar with JS/TS
     * 
     * EXAMPLE GOOD:
     *   const myVariable = 'value'; // camelCase for variables
     *   class MyService { } // PascalCase for classes
     *   interface UserData { } // PascalCase for interfaces
     *   const MAX_RETRIES = 3; // UPPER_CASE for constants
     *   function processData() { } // camelCase for functions
     * 
     * EXAMPLE BAD:
     *   const MyVariable = 'value'; // Wrong - should be camelCase
     *   class myService { } // Wrong - should be PascalCase
     *   const maxRetries = 3; // Wrong for constant - should be UPPER_CASE
     * 
     * SEVERITY: 'warn' - Important but not breaking
     * LLM GUIDANCE: Follow naming conventions - they're self-documenting
     */
    '@typescript-eslint/naming-convention': [
      'warn',
      {
        // Variables, functions, parameters, properties
        // WHY: camelCase is standard for JavaScript/TypeScript
        // PATTERN: camelCase for everything except constants and types
        selector: 'variableLike',
        format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        // Allow PascalCase for React components (handled separately for frontend)
        // Allow UPPER_CASE for constants/enums
      },
      {
        // Types, interfaces, classes, enums
        // WHY: PascalCase is standard for TypeScript types
        // PATTERN: All type definitions use PascalCase
        // This makes it immediately clear what's a type vs value
        selector: 'typeLike',
        format: ['PascalCase'],
        // This enforces: interface UserData, type QueryResult, class GraphRAGService
      },
    ],

    // ============================================================================
    // TYPE SAFETY ENFORCEMENT
    // ============================================================================
    // These rules ensure we use TypeScript's type system effectively
    // WHY: Type safety catches errors early and makes code self-documenting
    
    /**
     * No Any Types
     * WHY: 'any' defeats the purpose of TypeScript's type safety
     * 
     * PATTERN: Use proper types instead of 'any'
     * BENEFITS:
     * - Maintains type safety throughout the codebase
     * - Better IDE support and autocomplete
     * - Catches errors at compile time
     * - Makes code self-documenting
     * - Helps LLMs understand what types are expected
     * 
     * ARCHITECTURAL DECISION: Type safety is a priority
     * We prefer explicit types over convenience of 'any'
     * 
     * EXCEPTION: Tests may use 'any' for mocking (but prefer proper types)
     * 
     * EXAMPLE GOOD:
     *   function process(data: Entity): void { ... }
     *   function process(data: Record<string, unknown>): void { ... } // If flexible needed
     * 
     * EXAMPLE BAD:
     *   function process(data: any): void { ... } // Use proper type
     * 
     * SEVERITY: 'warn' - We want to catch this but allow it in tests
     * LLM GUIDANCE: Always use proper types, avoid 'any' - use Record<string, unknown> if needed
     */
    '@typescript-eslint/no-explicit-any': 'warn',

    /**
     * No Non-Null Assertion Operator
     * WHY: Using '!' (non-null assertion) can hide potential null/undefined errors
     * 
     * PATTERN: Handle null/undefined explicitly instead of asserting non-null
     * BENEFITS:
     * - Forces proper null checking
     * - Prevents runtime errors from null assertions
     * - Makes code more defensive and robust
     * - Clearer intent: explicit checks vs hidden assumptions
     * 
     * ARCHITECTURAL DECISION: Explicit null handling over assertions
     * This makes code more maintainable and less error-prone
     * 
     * EXAMPLE GOOD:
     *   if (value) { use(value); } // Explicit null check
     *   const result = value ?? defaultValue; // Null coalescing
     *   if (value !== null && value !== undefined) { use(value); }
     * 
     * EXAMPLE BAD:
     *   use(value!); // Dangerous - assumes value is never null
     *   use(value!.property); // Even more dangerous
     * 
     * SEVERITY: 'warn' - Sometimes necessary but should be avoided
     * LLM GUIDANCE: Handle null/undefined explicitly, avoid non-null assertions
     */
    '@typescript-eslint/no-non-null-assertion': 'warn',

    /**
     * No Empty Interface
     * WHY: Empty interfaces don't add value and can be replaced with type aliases
     * 
     * PATTERN: Use type aliases for simple type definitions, interfaces for contracts
     * BENEFITS:
     * - Clearer intent: interface for contracts, type for aliases
     * - Prevents unnecessary interface declarations
     * - Encourages proper type design
     * 
     * ARCHITECTURAL DECISION: Interfaces for contracts, types for aliases
     * This makes code intent clearer
     * 
     * EXAMPLE GOOD:
     *   type EntityId = string; // Simple alias
     *   interface Entity { id: string; label: string; } // Contract with properties
     * 
     * EXAMPLE BAD:
     *   interface Empty {} // Don't use empty interfaces
     * 
     * SEVERITY: 'warn' - Prefer type aliases for simple cases
     * LLM GUIDANCE: Use interfaces when you need to extend/implement, types for simple aliases
     */
    '@typescript-eslint/no-empty-interface': 'warn',

    /**
     * Prefer Type Literals Over Interfaces When Possible
     * WHY: Type literals are more flexible for unions and intersections
     * 
     * PATTERN: Use interfaces for object shapes, types for unions/intersections
     * BENEFITS:
     * - More flexible type composition
     * - Better for complex type operations
     * - Still maintains type safety
     * 
     * NOTE: This is a style preference - both work, but types are more flexible
     * 
     * SEVERITY: 'off' - Personal preference, both approaches are valid
     * LLM GUIDANCE: Use interfaces for object contracts, types for unions/intersections
     */
    '@typescript-eslint/consistent-type-definitions': 'off', // Allow both interfaces and types

    // ============================================================================
    // ASYNC/PROMISE PATTERNS
    // ============================================================================
    // These rules ensure proper async/await usage
    // WHY: Consistent async patterns make code more predictable and maintainable
    
    /**
     * No Floating Promises
     * WHY: Unhandled promises can cause uncaught errors
     * 
     * PATTERN: Always await or handle promises
     * BENEFITS:
     * - Prevents uncaught promise rejections
     * - Makes async flow explicit
     * - Easier to debug async code
     * 
     * ARCHITECTURAL DECISION: Explicit async handling
     * This prevents subtle bugs and makes code intent clear
     * 
     * EXAMPLE GOOD:
     *   await someAsyncFunction();
     *   someAsyncFunction().catch(error => handleError(error));
     *   void someAsyncFunction(); // Explicitly ignoring result
     * 
     * EXAMPLE BAD:
     *   someAsyncFunction(); // Floating promise - might not be handled
     * 
     * SEVERITY: 'error' - Unhandled promises are dangerous
     * LLM GUIDANCE: Always await, catch, or explicitly void promises
     */
    '@typescript-eslint/no-floating-promises': 'error',

    /**
     * No Misused Promises
     * WHY: Promises shouldn't be used in places where they're not expected
     * 
     * PATTERN: Don't use promises in conditionals or other non-promise contexts
     * BENEFITS:
     * - Prevents logic errors
     * - Makes async code clearer
     * 
     * EXAMPLE GOOD:
     *   if (await isReady()) { ... }
     * 
     * EXAMPLE BAD:
     *   if (isReady()) { ... } // Missing await
     * 
     * SEVERITY: 'error' - This is a logic error
     * LLM GUIDANCE: Always await promises in conditionals
     */
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: false, // Allow void returns (for event handlers)
      },
    ],

    // ============================================================================
    // IMPORT/EXPORT PATTERNS
    // ============================================================================
    // These rules ensure consistent import/export usage
    // WHY: Consistent imports make code more readable and maintainable
    
    /**
     * No Unused Imports
     * WHY: Unused imports clutter code and can cause confusion
     * 
     * PATTERN: Remove unused imports
     * BENEFITS:
     * - Cleaner code
     * - Faster builds (fewer imports to resolve)
     * - Clearer dependencies
     * 
     * SEVERITY: 'error' - Unused imports are dead code
     * LLM GUIDANCE: Remove unused imports when generating code
     */
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        // Also check imports
        ignoreRestSiblings: true,
      },
    ],

    /**
     * Consistent Import Order
     * WHY: Consistent import order makes code more readable
     * 
     * PATTERN: External imports first, then internal imports
     * BENEFITS:
     * - Easier to scan imports
     * - Consistent code style
     * - Better for LLMs to understand dependencies
     * 
     * EXAMPLE GOOD:
     *   import { useState } from 'react'; // External
     *   import { GraphRAGService } from './services/graphrag.service'; // Internal
     * 
     * NOTE: This is handled by import sorting tools, not ESLint directly
     * 
     * SEVERITY: 'off' - Use import sorting tools instead
     * LLM GUIDANCE: Group imports: external first, then internal
     */
  },

  // ============================================================================
  // OVERRIDES: Backend vs Frontend Specific Rules
  // ============================================================================
  // Different parts of the codebase need different rules
  // Backend: Services, API routes, database operations
  // Frontend: React components, UI logic, browser APIs
  // WHY: Backend and frontend have different concerns and patterns
  
  overrides: [
    {
      // ==========================================================================
      // BACKEND RULES
      // ==========================================================================
      // These rules apply to backend code (services, API routes, utilities)
      // WHY: Backend code has different patterns and concerns than frontend
      
      files: ['backend/**/*.ts', 'backend/**/*.tsx'],
      
      rules: {
        /**
         * Backend: Strict Console Rules
         * WHY: Backend should use proper logging, not console statements
         * 
         * PATTERN: Use a logging library or structured logging in production
         * For now: Allow console.warn/error for debugging, but prefer structured logging
         * 
         * ARCHITECTURAL DECISION: Structured logging for production
         * Console.log is fine for development, but production needs proper logging
         * 
         * EXAMPLE GOOD:
         *   console.error('Database connection failed:', error); // Allowed for errors
         *   // In production: logger.error('Database connection failed', { error });
         * 
         * EXAMPLE BAD:
         *   console.log('Processing request'); // Use structured logging instead
         * 
         * LLM GUIDANCE: Use console.error/warn for errors, prefer structured logging
         */
        'no-console': ['warn', { allow: ['warn', 'error'] }],

        /**
         * Backend: Require Return Types on Exported Functions
         * WHY: Backend services are the public API - types must be explicit
         * 
         * PATTERN: All exported functions must have explicit return types
         * BENEFITS:
         * - Makes API contracts clear
         * - Helps LLMs understand service interfaces
         * - Improves IDE autocomplete for consumers of the service
         * - Self-documenting API contracts
         * 
         * ARCHITECTURAL DECISION: Explicit contracts for public APIs
         * Backend services are consumed by other code - contracts must be clear
         * 
         * EXAMPLE:
         *   export async function createEntity(data: EntityData): Promise<Entity> {
         *     // Must have : Promise<Entity> return type
         *   }
         * 
         * LLM GUIDANCE: Always include explicit return types on exported backend functions
         */
        '@typescript-eslint/explicit-function-return-type': 'warn',

        /**
         * Backend: Prefer Async/Await Over Promises
         * WHY: Async/await is more readable and easier for LLMs to understand
         * 
         * PATTERN: Use async/await instead of .then() chains
         * BENEFITS:
         * - More readable code
         * - Easier error handling with try/catch
         * - Better stack traces
         * - LLMs can more easily understand control flow
         * - Consistent async pattern throughout backend
         * 
         * ARCHITECTURAL DECISION: Async/await is the standard pattern
         * This makes backend code more maintainable and LLM-friendly
         * 
         * EXAMPLE GOOD:
         *   async function fetchData() {
         *     const result = await api.get('/data');
         *     return result;
         *   }
         * 
         * EXAMPLE BAD:
         *   function fetchData() {
         *     return api.get('/data').then(result => result);
         *   }
         * 
         * LLM GUIDANCE: Always use async/await in backend code, never .then() chains
         */
        '@typescript-eslint/promise-function-async': 'warn',

        /**
         * Backend: Service Layer Architecture Pattern
         * WHY: Backend services should be classes with dependency injection
         * 
         * ARCHITECTURAL PATTERN:
         * - Each service is a class in backend/src/services/
         * - Services encapsulate one domain concern (e.g., Neo4jService, EmbeddingService)
         * - Services accept optional dependencies in constructor (DI pattern)
         * - Services are instantiated in app.ts or passed as dependencies
         * - All public methods have explicit return types
         * 
         * CODE ORGANIZATION:
         * - One service class per file
         * - File name matches class name: GraphRAGService → graphrag.service.ts
         * - Services import from config/ for configuration
         * - Services import from types/ for TypeScript types
         * - Services import from utils/ for pure utility functions
         * 
         * DEPENDENCY INJECTION PATTERN:
         * - Constructor accepts optional service dependencies
         * - If not provided, creates default instances
         * - Enables testing with mocks
         * 
         * BENEFITS:
         * - Dependency injection for testability
         * - Clear service boundaries
         * - Easy to mock for testing
         * - Consistent service structure
         * - Predictable code organization
         * 
         * ARCHITECTURAL DECISION: Class-based services with DI
         * This pattern makes services testable, maintainable, and predictable
         * 
         * EXAMPLE GOOD:
         *   // backend/src/services/graphrag.service.ts
         *   export class GraphRAGService {
         *     private neo4j: Neo4jService;
         *     private embeddings: EmbeddingService;
         *     
         *     constructor(
         *       neo4jService?: Neo4jService,
         *       embeddingService?: EmbeddingService
         *     ) {
         *       this.neo4j = neo4jService || new Neo4jService();
         *       this.embeddings = embeddingService || new EmbeddingService();
         *     }
         *     
         *     async query(query: GraphRAGQuery): Promise<GraphRAGResponse> {
         *       // Implementation
         *     }
         *   }
         * 
         * WHERE TO ADD NEW SERVICES:
         * - Create new file in backend/src/services/
         * - Follow naming: MyService → my-service.service.ts
         * - Follow DI pattern in constructor
         * - Add explicit return types to all public methods
         * 
         * LLM GUIDANCE: 
         * - New services go in backend/src/services/
         * - Use class-based pattern with DI
         * - One service per file
         * - File name: kebab-case.service.ts
         */
        // Note: This is enforced by code structure, not a specific ESLint rule

        /**
         * Backend: API Route Organization Pattern
         * WHY: API routes should be organized predictably in app.ts
         * 
         * ARCHITECTURAL PATTERN:
         * - All API routes are in backend/src/app.ts
         * - Routes are organized by domain (health, graphrag, graph operations)
         * - Routes follow RESTful patterns where applicable
         * - Each route has consistent error handling
         * 
         * CODE ORGANIZATION:
         * - Routes grouped by functionality (health, graphrag, entities, relationships)
         * - Each route handler is an async function
         * - Routes use service layer (never direct database access)
         * - Routes return consistent response format
         * 
         * ERROR HANDLING PATTERN:
         * - Try/catch in API routes
         * - Return structured error objects: { error, message, hint? }
         * - Log errors with console.error
         * - Never expose internal errors directly to clients
         * 
         * BENEFITS:
         * - Graceful error handling
         * - Proper error responses to clients
         * - Error logging for debugging
         * - Consistent error format
         * - Predictable route organization
         * 
         * ARCHITECTURAL DECISION: Structured error responses
         * All API errors return { error, message, hint? } format
         * 
         * EXAMPLE GOOD:
         *   // In app.ts
         *   app.post('/api/graphrag/query', async ({ body }) => {
         *     try {
         *       const query = body as GraphRAGQuery;
         *       if (!query.query || typeof query.query !== 'string') {
         *         return { error: 'Invalid request', message: 'Query string is required' };
         *       }
         *       const service = getGraphRAG();
         *       const response = await service.query(query);
         *       return response;
         *     } catch (error) {
         *       console.error('GraphRAG query error:', error);
         *       return {
         *         error: 'Failed to process GraphRAG query',
         *         message: error instanceof Error ? error.message : 'Unknown error',
         *       };
         *     }
         *   });
         * 
         * WHERE TO ADD NEW ROUTES:
         * - Add to appropriate section in app.ts
         * - Follow existing error handling pattern
         * - Use service layer, never direct database access
         * - Return consistent response format
         * 
         * LLM GUIDANCE: 
         * - New routes go in app.ts
         * - Group by domain (health, graphrag, graph operations)
         * - Always wrap in try/catch
         * - Return structured error objects
         * - Use service layer methods
         */
        // Note: This is enforced by code structure, not a specific ESLint rule

        /**
         * Backend: Module Boundary Pattern
         * WHY: Clear module boundaries prevent circular dependencies and organize code
         * 
         * ARCHITECTURAL PATTERN:
         * - Services import from config/, types/, utils/
         * - Services don't import from other services directly (use DI)
         * - Config files are pure configuration (no business logic)
         * - Types are shared interfaces (no implementation)
         * - Utils are pure functions (no side effects, no state)
         * 
         * DEPENDENCY FLOW:
         *   app.ts → services → config/types/utils
         *   services → config (for configuration)
         *   services → types (for TypeScript types)
         *   services → utils (for pure utility functions)
         *   services → other services (via DI, not direct import)
         * 
         * CODE ORGANIZATION:
         * - backend/src/services/ - Business logic (can import config/types/utils)
         * - backend/src/config/ - Configuration (no dependencies)
         * - backend/src/types/ - Type definitions (no dependencies)
         * - backend/src/utils/ - Pure functions (can import types, no services)
         * - backend/src/app.ts - Route handlers (imports services)
         * 
         * BENEFITS:
         * - Clear dependency hierarchy
         * - No circular dependencies
         * - Predictable code organization
         * - Easy to test (utils are pure, services are DI)
         * 
         * LLM GUIDANCE:
         * - New business logic → services/
         * - New configuration → config/
         * - New types → types/
         * - New pure functions → utils/
         * - Don't create circular dependencies
         */
        // Note: This is enforced by code structure, not a specific ESLint rule
      },
    },
    {
      // ==========================================================================
      // FRONTEND RULES
      // ==========================================================================
      // These rules apply to frontend code (React components, UI logic)
      // WHY: Frontend code has different patterns and concerns than backend
      
      files: ['frontend/**/*.ts', 'frontend/**/*.tsx'],
      
      rules: {
        /**
         * Frontend: Allow Console for Debugging
         * WHY: Frontend debugging often needs console.log temporarily
         * 
         * PATTERN: Console statements are warnings, not errors
         * BENEFITS:
         * - Allows temporary debugging
         * - Still catches accidental console.log in production (via warnings)
         * - Development-friendly
         * 
         * NOTE: In production builds, console.log should be removed/stripped
         * 
         * ARCHITECTURAL DECISION: Development-friendly but production-aware
         * Allow console in development, but be aware it should be removed in production
         * 
         * LLM GUIDANCE: Use console.log for debugging, but prefer console.warn/error for important messages
         */
        'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],

        /**
         * Frontend: React Hooks Rules
         * WHY: React hooks have specific rules that must be followed
         * 
         * PATTERN: 
         * - Hooks must be called in the same order every render
         * - Hooks can only be called from React functions
         * - Dependencies in useEffect/useMemo must be exhaustive
         * 
         * BENEFITS:
         * - Prevents React hooks bugs
         * - Ensures components work correctly
         * - Makes hooks behavior predictable
         * - Catches dependency array mistakes
         * 
         * ARCHITECTURAL DECISION: Strict hooks rules
         * This prevents common React bugs and makes code more maintainable
         * 
         * NOTE: Requires eslint-plugin-react-hooks to be installed
         * Run: bun add -d eslint-plugin-react-hooks
         * 
         * LLM GUIDANCE: 
         * - Always include all dependencies in useEffect/useMemo/useCallback
         * - Hooks must be called at top level, not conditionally
         * - Use exhaustive-deps rule to catch missing dependencies
         */
        // 'react-hooks/rules-of-hooks': 'error',
        // 'react-hooks/exhaustive-deps': 'warn',
        // Uncomment above when eslint-plugin-react-hooks is installed

        /**
         * Frontend: React Component Naming
         * WHY: React components must be PascalCase
         * 
         * PATTERN: All React components must use PascalCase
         * BENEFITS:
         * - JSX distinguishes components from HTML elements
         * - Matches React conventions
         * - Makes JSX more readable
         * - Self-documenting: PascalCase = component
         * 
         * ARCHITECTURAL DECISION: PascalCase for all components
         * This is React standard and makes code more readable
         * 
         * EXAMPLE:
         *   function MyComponent() { ... } // Correct
         *   function myComponent() { ... } // Wrong
         * 
         * LLM GUIDANCE: All React components must use PascalCase naming
         */
        '@typescript-eslint/naming-convention': [
          'warn',
          {
            // Variables can be camelCase (normal variables) or PascalCase (components)
            // WHY: React components are just functions, but we use PascalCase to distinguish
            selector: 'variableLike',
            format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          },
          {
            // Types/interfaces must be PascalCase
            selector: 'typeLike',
            format: ['PascalCase'],
          },
          {
            // React components must be PascalCase
            // WHY: This is how we distinguish components from regular functions
            selector: 'function',
            filter: {
              regex: '^[A-Z]',
              match: true,
            },
            format: ['PascalCase'],
          },
        ],

        /**
         * Frontend: Component Architecture Pattern
         * WHY: Components should be organized predictably and follow consistent patterns
         * 
         * ARCHITECTURAL PATTERN:
         * - Components are functional components in frontend/public/components/
         * - Each component has a TypeScript interface for props
         * - Components are composed hierarchically (parent → child)
         * - One component per file
         * - File name matches component name: MyComponent → MyComponent.tsx
         * 
         * CODE ORGANIZATION:
         * - Components in frontend/public/components/
         * - Shared utilities in frontend/public/utils/
         * - API client in frontend/public/api.ts
         * - Types can be in api.ts or separate types file
         * - Main app in frontend/public/app.tsx
         * 
         * COMPONENT COMPOSITION PATTERN:
         * - Parent components compose child components
         * - State flows down via props
         * - Events flow up via callbacks
         * - No prop drilling - lift state when needed
         * 
         * PROPS PATTERN:
         * - Every component has a TypeScript interface for props
         * - Interface name: ComponentNameProps
         * - Props are destructured in function signature
         * - Optional props use ? modifier
         * 
         * BENEFITS:
         * - Type safety for props
         * - Self-documenting component API
         * - Better IDE autocomplete
         * - Predictable component structure
         * - Clear component boundaries
         * 
         * ARCHITECTURAL DECISION: Functional components with TypeScript
         * This provides better type safety and developer experience
         * 
         * EXAMPLE GOOD:
         *   // frontend/public/components/MyComponent.tsx
         *   interface MyComponentProps {
         *     name: string;
         *     age?: number;
         *     onAction: () => void;
         *   }
         *   
         *   function MyComponent({ name, age, onAction }: MyComponentProps) {
         *     // Component implementation
         *   }
         * 
         * WHERE TO ADD NEW COMPONENTS:
         * - Create new file in frontend/public/components/
         * - Follow naming: MyComponent → MyComponent.tsx
         * - Define props interface: MyComponentProps
         * - Import from api.ts for API calls
         * - Import from utils/ for utilities
         * 
         * LLM GUIDANCE:
         * - New components go in frontend/public/components/
         * - One component per file
         * - Always define props interface
         * - Use functional component pattern
         * - File name: PascalCase.tsx
         */
        // Note: This is enforced by code structure, not ESLint

        /**
         * Frontend: State Management Architecture Pattern
         * WHY: State should be managed predictably and consistently
         * 
         * ARCHITECTURAL PATTERN:
         * - Use useState for component-local state
         * - Lift state up when shared between components
         * - State flows down via props
         * - Events flow up via callbacks
         * - No global state management (keep it simple for MVP)
         * 
         * CODE ORGANIZATION:
         * - Local state: useState in component
         * - Shared state: Lift to common parent
         * - State type: Explicitly type useState<T | null>(null)
         * - State updates: Use setState functions, never mutate directly
         * 
         * STATE FLOW PATTERN:
         *   Parent Component (state)
         *     ↓ (props)
         *   Child Component (receives state)
         *     ↑ (callback)
         *   Parent Component (updates state)
         * 
         * BENEFITS:
         * - Predictable state management
         * - Clear data flow
         * - Easier to reason about
         * - No hidden state mutations
         * 
         * ARCHITECTURAL DECISION: Local state by default, lift when needed
         * This keeps components simple and maintainable
         * 
         * EXAMPLE GOOD:
         *   // Parent component manages state
         *   function App() {
         *     const [entity, setEntity] = useState<Entity | null>(null);
         *     return <ChildComponent entity={entity} onUpdate={setEntity} />;
         *   }
         *   
         *   // Child component receives state and can update via callback
         *   function ChildComponent({ entity, onUpdate }: Props) {
         *     // Use entity, call onUpdate to change it
         *   }
         * 
         * LLM GUIDANCE:
         * - Use useState for local state
         * - Type state explicitly: useState<Type | null>(null)
         * - Lift state when shared between components
         * - Never mutate state directly - use setState
         */
        // Note: This is enforced by code structure, not ESLint

        /**
         * Frontend: API Client Organization Pattern
         * WHY: API calls should be centralized and consistent
         * 
         * ARCHITECTURAL PATTERN:
         * - All API client functions in frontend/public/api.ts
         * - Functions match backend API endpoints
         * - Consistent error handling
         * - Shared types between frontend and backend
         * 
         * CODE ORGANIZATION:
         * - API client functions in api.ts
         * - Types/interfaces in api.ts (or shared types file)
         * - Components import from api.ts
         * - Components never fetch directly
         * 
         * API CALL PATTERN:
         * - Functions are async and return Promise<T | ApiError>
         * - Use fetchApi helper for common fetch logic
         * - Handle errors in components
         * - Consistent request/response format
         * 
         * BENEFITS:
         * - Centralized API logic
         * - Consistent error handling
         * - Easy to mock for testing
         * - Single source of truth for API calls
         * 
         * ARCHITECTURAL DECISION: Centralized API client
         * This makes API calls predictable and maintainable
         * 
         * EXAMPLE GOOD:
         *   // In api.ts
         *   export async function queryGraphRAG(
         *     query: GraphRAGQuery
         *   ): Promise<GraphRAGResponse | ApiError> {
         *     return fetchApi<GraphRAGResponse | ApiError>('/graphrag/query', {
         *       method: 'POST',
         *       body: JSON.stringify(query),
         *     });
         *   }
         *   
         *   // In component
         *   const result = await queryGraphRAG(query);
         *   if ('error' in result) {
         *     setError(result.message);
         *   } else {
         *     setResponse(result);
         *   }
         * 
         * WHERE TO ADD NEW API CALLS:
         * - Add function to frontend/public/api.ts
         * - Follow naming: verbNoun format (queryGraphRAG, createEntity)
         * - Use fetchApi helper
         * - Return Promise<T | ApiError>
         * 
         * LLM GUIDANCE:
         * - New API calls go in api.ts
         * - Use fetchApi helper
         * - Return Promise<T | ApiError>
         * - Components import from api.ts, never fetch directly
         */
        // Note: This is enforced by code structure, not ESLint

        /**
         * Frontend: Module Boundary Pattern
         * WHY: Clear module boundaries prevent circular dependencies and organize code
         * 
         * ARCHITECTURAL PATTERN:
         * - Components import from api.ts, utils/, and other components
         * - Utils are pure functions (no side effects)
         * - API client is separate from components
         * - Types are shared (can be in api.ts or separate types file)
         * 
         * DEPENDENCY FLOW:
         *   app.tsx → components → api.ts/utils
         *   components → api.ts (for API calls)
         *   components → utils/ (for utilities)
         *   components → components (for composition)
         * 
         * CODE ORGANIZATION:
         * - frontend/public/components/ - React components
         * - frontend/public/api.ts - API client functions
         * - frontend/public/utils/ - Pure utility functions
         * - frontend/public/app.tsx - Main app component
         * 
         * BENEFITS:
         * - Clear dependency hierarchy
         * - No circular dependencies
         * - Predictable code organization
         * - Easy to test (utils are pure, API is mockable)
         * 
         * LLM GUIDANCE:
         * - New components → components/
         * - New API calls → api.ts
         * - New utilities → utils/
         * - Don't create circular dependencies
         */
        // Note: This is enforced by code structure, not ESLint
      },
    },
    {
      // ==========================================================================
      // TEST FILES
      // ==========================================================================
      // Tests have different rules - they need more flexibility for mocking
      // WHY: Tests need to mock and test edge cases that might not be production-ready
      
      files: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx', '**/*.test.ts', '**/*.test.tsx'],
      
      rules: {
        /**
         * Tests: Allow 'any' Types
         * WHY: Tests often need 'any' for mocking complex objects
         * 
         * PATTERN: Tests can use 'any' but prefer proper types when possible
         * BENEFITS:
         * - Allows flexibility in test setup
         * - Mock objects don't need full type definitions
         * - Still maintain type safety in production code
         * - Faster test writing
         * 
         * ARCHITECTURAL DECISION: Flexible types in tests, strict in production
         * Tests need flexibility, production needs type safety
         * 
         * EXAMPLE:
         *   const mockService = { ... } as any; // OK in tests
         *   // But prefer: const mockService: Partial<Service> = { ... }
         * 
         * LLM GUIDANCE: 'any' is OK in tests for mocks, but prefer proper types when possible
         */
        '@typescript-eslint/no-explicit-any': 'off',

        /**
         * Tests: Allow Console Statements
         * WHY: Tests often log debugging information
         * 
         * PATTERN: Console statements are fine in tests
         * BENEFITS:
         * - Helps debug failing tests
         * - Provides test output information
         * - Useful for test development
         * 
         * ARCHITECTURAL DECISION: Console allowed in tests
         * Tests are development tools - console is fine
         * 
         * LLM GUIDANCE: Console statements are fine in test files
         */
        'no-console': 'off',

        /**
         * Tests: Allow Non-Null Assertions
         * WHY: Tests often assert that values are non-null after setup
         * 
         * PATTERN: Non-null assertions are OK in tests when we've verified setup
         * BENEFITS:
         * - Tests can be more concise
         * - We control test setup, so assertions are safe
         * 
         * EXAMPLE:
         *   const service = new GraphRAGService();
         *   await service.initialize();
         *   const result = await service.query(query)!; // OK in tests
         * 
         * LLM GUIDANCE: Non-null assertions are OK in tests when setup is verified
         */
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
    {
      // ==========================================================================
      // CONFIG FILES
      // ==========================================================================
      // Configuration files may have different patterns
      
      files: ['**/*.config.ts', '**/*.config.js', '**/*.config.cjs', '**/*.config.mjs'],
      
      rules: {
        /**
         * Config Files: Allow CommonJS
         * WHY: Some config files (like .eslintrc.cjs) must use CommonJS
         * 
         * PATTERN: Config files can use CommonJS when required
         * BENEFITS:
         * - Some tools require CommonJS config files
         * - Flexibility for tool-specific requirements
         * 
         * LLM GUIDANCE: Use CommonJS in config files when tool requires it
         */
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};

// ============================================================================
// QUICK REFERENCE FOR LLM AGENTS
// ============================================================================
// This section provides a quick summary of key patterns for LLM code generation
// Read the detailed comments above for full context and reasoning

/* 
 * ============================================================================
 * CODE ORGANIZATION PATTERNS (WHERE TO PUT CODE)
 * ============================================================================
 * 
 * BACKEND ORGANIZATION:
 * 
 * - backend/src/services/        → Business logic services (classes)
 * - backend/src/config/          → Configuration files
 * - backend/src/types/           → Shared TypeScript types
 * - backend/src/utils/           → Pure utility functions
 * - backend/src/app.ts           → API route handlers
 * - backend/src/__tests__/      → Test files (mirror source structure)
 * 
 * FRONTEND ORGANIZATION:
 * 
 * - frontend/public/components/ → React components (one per file)
 * - frontend/public/api.ts       → API client functions
 * - frontend/public/utils/       → Pure utility functions
 * - frontend/public/app.tsx      → Main app component
 * - frontend/public/__tests__/  → Test files (mirror source structure)
 * 
 * DEPENDENCY FLOW (WHAT CAN IMPORT WHAT):
 * 
 * Backend:
 *   app.ts → services → config/types/utils
 *   services → config (for configuration)
 *   services → types (for TypeScript types)
 *   services → utils (for pure functions)
 *   services → other services (via DI, NOT direct import)
 * 
 * Frontend:
 *   app.tsx → components → api.ts/utils
 *   components → api.ts (for API calls)
 *   components → utils/ (for utilities)
 *   components → components (for composition)
 * 
 * ============================================================================
 * ARCHITECTURAL PATTERNS (HOW TO STRUCTURE CODE)
 * ============================================================================
 * 
 * BACKEND ARCHITECTURE:
 * 
 * 1. SERVICE LAYER PATTERN:
 *    - Each service is a class in backend/src/services/
 *    - File naming: MyService → my-service.service.ts
 *    - Constructor accepts optional dependencies (DI pattern)
 *    - All public methods have explicit return types
 *    - Example:
 *        export class MyService {
 *          constructor(private dependency?: OtherService) {}
 *          async method(): Promise<Result> { ... }
 *        }
 * 
 * 2. API ROUTE PATTERN:
 *    - All routes in backend/src/app.ts
 *    - Grouped by domain (health, graphrag, entities, relationships)
 *    - Always wrap in try/catch
 *    - Return structured errors: { error, message, hint? }
 *    - Use service layer, never direct database access
 * 
 * 3. MODULE BOUNDARIES:
 *    - Services import from config/, types/, utils/
 *    - Services don't import from other services (use DI)
 *    - Config: pure configuration (no business logic)
 *    - Types: shared interfaces (no implementation)
 *    - Utils: pure functions (no side effects)
 * 
 * FRONTEND ARCHITECTURE:
 * 
 * 1. COMPONENT PATTERN:
 *    - Functional components in frontend/public/components/
 *    - File naming: MyComponent → MyComponent.tsx
 *    - One component per file
 *    - Props interface: interface MyComponentProps { ... }
 *    - Example:
 *        interface MyComponentProps {
 *          name: string;
 *          onAction: () => void;
 *        }
 *        function MyComponent({ name, onAction }: MyComponentProps) { ... }
 * 
 * 2. STATE MANAGEMENT PATTERN:
 *    - useState for local state
 *    - Lift state up when shared between components
 *    - State flows down via props
 *    - Events flow up via callbacks
 *    - Type state explicitly: useState<Entity | null>(null)
 * 
 * 3. API CLIENT PATTERN:
 *    - All API calls in frontend/public/api.ts
 *    - Functions return Promise<T | ApiError>
 *    - Components import from api.ts, never fetch directly
 *    - Handle errors in components with try/catch
 * 
 * ============================================================================
 * CODE PATTERNS (HOW TO WRITE CODE)
 * ============================================================================
 * 
 * BACKEND CODE PATTERNS:
 * 
 * 1. SERVICE METHODS:
 *    - Services are classes with optional constructor dependencies (DI pattern)
 *    - All public methods must have explicit return types
 *    - Use async/await, never .then() chains
 *    - Example: export class MyService { async method(): Promise<Result> { ... } }
 * 
 * 2. ERROR HANDLING:
 *    - Wrap service calls in try/catch
 *    - Return structured error objects: { error: string, message: string, hint?: string }
 *    - Log errors with console.error
 * 
 * 3. API ROUTES:
 *    - Validate input parameters
 *    - Handle errors gracefully
 *    - Return consistent response format
 * 
 * 4. NAMING:
 *    - Classes: PascalCase (GraphRAGService)
 *    - Functions: camelCase (getEntity)
 *    - Constants: UPPER_CASE (MAX_RETRIES)
 * 
 * FRONTEND CODE PATTERNS:
 * 
 * 1. COMPONENTS:
 *    - Functional components with TypeScript interfaces for props
 *    - PascalCase naming (MyComponent)
 *    - Props interface: interface MyComponentProps { ... }
 * 
 * 2. STATE MANAGEMENT:
 *    - useState for local state
 *    - Lift state up when shared
 *    - Type state explicitly: useState<Entity | null>(null)
 * 
 * 3. HOOKS:
 *    - Hooks must be called at top level
 *    - Include all dependencies in useEffect/useMemo/useCallback
 *    - Never call hooks conditionally
 * 
 * 4. API CALLS:
 *    - Use async/await in event handlers
 *    - Handle errors with try/catch
 *    - Set loading states appropriately
 * 
 * COMMON PATTERNS (Both Backend & Frontend):
 * 
 * 1. TYPES:
 *    - Use TypeScript interfaces for object shapes
 *    - Use type aliases for unions/intersections
 *    - Never use 'any' (except in tests)
 *    - Explicit return types on exported functions
 * 
 * 2. NULL HANDLING:
 *    - Explicit null checks: if (value) { ... }
 *    - Null coalescing: value ?? defaultValue
 *    - Never use non-null assertion (!) unless absolutely necessary
 * 
 * 3. ASYNC:
 *    - Always await promises
 *    - Use try/catch for error handling
 *    - Never create floating promises
 * 
 * 4. IMPORTS:
 *    - ES modules only (import/export)
 *    - Group: external first, then internal
 *    - Remove unused imports
 * 
 * 5. VARIABLES:
 *    - Use const by default
 *    - Use let only when reassignment needed
 *    - Never use var
 *    - Prefix unused vars with '_'
 * 
 * TEST PATTERNS:
 * 
 * 1. MOCKING:
 *    - Use dependency injection for testability
 *    - 'any' types OK in tests for mocks
 *    - Console statements OK in tests
 * 
 * 2. STRUCTURE:
 *    - Use describe/it blocks
 *    - Setup/teardown in beforeAll/afterAll
 *    - Reset mocks in beforeEach
 * 
 * ============================================================================
 * KEY ARCHITECTURAL DECISIONS
 * ============================================================================
 * 
 * 1. Dependency Injection: Services accept optional dependencies in constructors
 *    WHY: Makes services testable and maintainable
 * 
 * 2. Explicit Types: All exports have return types
 *    WHY: Self-documenting code and better LLM understanding
 * 
 * 3. Async/Await: Always use async/await, never .then()
 *    WHY: More readable and easier for LLMs to understand
 * 
 * 4. Error Handling: Structured error objects
 *    WHY: Consistent error format across the codebase
 * 
 * 5. Type Safety: Strict TypeScript, no 'any' in production
 *    WHY: Catches errors early and makes code self-documenting
 * 
 * 6. Predictable Organization: Clear module boundaries and file locations
 *    WHY: Makes it easy to know where to add code and maintain consistency
 */
