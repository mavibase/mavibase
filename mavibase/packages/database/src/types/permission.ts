import type { IdentityContext } from './identity';

export interface PermissionRules {
  read?: PermissionRule[];
  create?: PermissionRule[];
  update?: PermissionRule[];
  delete?: PermissionRule[];
}

export interface PermissionRule {
  role?: string;
  condition?: PermissionCondition;
  fields?: string[]; // Which fields are allowed
}

export interface PermissionCondition {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte' | 'exists';
  value: any;
  context?: 'user' | 'team' | 'document';
}

export type PermissionTarget = 'database' | 'collection' | 'document';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'list';

export interface RoleDefinition {
  id: string;
  database_id?: string;
  name: string;
  description?: string;
  permissions: string[];
  is_system?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectRole {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  created_at: Date;
  updated_at: Date;
}

// Additional types for authorization
export interface Permission {
  userId?: string;
  appId?: string;
  roles?: string[];
  projectId?: string;
  teamId?: string;
  getUserRoles?: () => string[];
  getProjectId?: () => string;
  getTeamId?: () => string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface Actor {
  userId?: string;
  appId?: string;
  roles?: string[];
  teamId?: string;
}
