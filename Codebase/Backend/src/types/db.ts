export interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface AnalysisRunRow {
  id: number;
  source_name: string;
  source_text: string;
  analysis_json: string;
  artifact_path: string;
  structure_score: number;
  modernization_score: number;
  findings_count: number;
  created_at: string;
  user_id: number | null;
}

export interface ReviewRow {
  id: number;
  user_id: number;
  scope: string;
  analysis_run_id: number | null;
  answers_json: string;
  schema_version: string;
  created_at: string;
}

export interface LogRow {
  id: number;
  user_id: number | null;
  event_type: string;
  message: string;
  created_at: string;
}
