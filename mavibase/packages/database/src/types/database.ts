export interface Database {
  id: string;
  name: string;
  key: string;
  description?: string;
  project_id: string;
  team_id?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface DatabaseQuota {
  id: string;
  database_id: string;
  collections_limit: number;
  documents_limit: number;
  storage_limit: number; // in bytes
  api_calls_limit: number; // per month
  bandwidth_limit: number; // in bytes per month
  current_collections: number;
  current_documents: number;
  current_storage: number;
  current_api_calls: number;
  current_bandwidth: number;
  reset_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseStats {
  collections: number;
  documents: number;
  storage: number;
  api_calls: number;
  bandwidth: number;
}
