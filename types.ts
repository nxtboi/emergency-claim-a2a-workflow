
export enum WorkflowStep {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  GEMINI_ANALYSIS = 'GEMINI_ANALYSIS',
  A2A_HANDSHAKE = 'A2A_HANDSHAKE',
  COMPLETED = 'COMPLETED'
}

export interface DamageReport {
  intensity: 'Low' | 'Moderate' | 'Severe' | 'Catastrophic';
  estimatedCost: number;
  identifiedItems: string[];
  summary: string;
  structuralIntegrityRisk: boolean;
}

export interface HandshakeLog {
  timestamp: string;
  from: 'GoogleAgent' | 'SalesforceAgent';
  to: 'GoogleAgent' | 'SalesforceAgent';
  protocol: 'A2A' | 'AP2';
  payload: any;
  status: 'SENT' | 'RECEIVED' | 'PROCESSED';
}

export interface ClaimResult {
  status: 'APPROVED' | 'MANUAL_REVIEW';
  paymentInitiated: boolean;
  referenceId: string;
  report: DamageReport;
}
