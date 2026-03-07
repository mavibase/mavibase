// Database package exports

// Types
export * from './types';

// Repositories
export { DatabaseRepository } from './engine/databases/DatabaseRepository';
export { CollectionRepository } from './engine/collections/CollectionRepository';
export { DocumentRepository } from './engine/documents/DocumentRepository';
export { IndexRepository } from './engine/indexes/IndexRepository';

// Managers
export { VersionManager } from './engine/versioning/VersionManager';
export { RelationshipManager } from './engine/relationships/RelationshipManager';
// export { RelationshipResolver } from './engine/relationships/RelationshipResolver';
// export { TransactionManager } from './transaction/TransactionManager';
// export { TransactionLogger } from './transaction/TransactionLogger';

// Query
export { QueryParser } from './query/QueryParser';
export { QueryExecutor } from './query/QueryExecutor';

// Schema
export { SchemaValidator } from './schema/SchemaValidator';

// Security
export { ApiKeyHasher } from './security/authentication/ApiKeyHasher';
export { AuthorizationPolicy } from './security/authorization/AuthorizationPolicy';
// export { RoleManager } from './security/authorization/RoleManager';
export { PermissionRuleEvaluator as PermissionEvaluator } from './security/authorization/PermissionEvaluator';
export { PermissionRuleEvaluator } from './security/authorization/PermissionRuleEvaluator';

// Storage
export { QuotaManager } from './storage/QuotaManager';

// Utils
export { CursorPaginator } from './services/cursor-paginator';
export { ETagGenerator as EtagGenerator } from '@mavibase/database/utils/EtagGenerator';

export { FieldProjector } from './utils/FieldProjector';
export { HealthChecker } from './services/health-checker';
export { PatchOperator } from './utils/PatchOperator';
export { generateId } from './utils/id-generator';
export { logger } from './utils/logger';
export * from './utils/response';
export * from './utils/sanitize';

// Config
export { pool, query } from './config/database';
export { getRedisClient, closeRedisClient } from './config/redis';

// Middleware
export * from './middleware/error-handler';
