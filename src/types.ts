export interface CreateActivityRequest {
  sourceName?: string;
  start: Date;
  status?: 'RUNNING' | 'PAUSED' | 'FINISHED';
  applicationName?: string;
  applicationProjectName?: string;
  os?: string;
  metadata: {
    title?: string;
    location?: string;
    hash?: string;
    extra?: {
      [key: string]: any;
    }
  };
}

export interface UpdateActivityRequest {
  updateEnd: boolean;
  status?: 'RUNNING' | 'PAUSED' | 'FINISHED';
  metadata?: {
    title?: string;
    location?: string;
    hash?: string;
    extra?: {
      [key: string]: any;
    }
  };
}

export interface ProjectTime {
  seconds: number;
  lastUpdate: number;
}