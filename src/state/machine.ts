export const STATES = [
  'received',
  'analyzing',
  'awaiting_approval',
  'approved',
  'posted',
  'rejected_low_quality',
  'rejected',
  'failed_analysis',
  'failed_publish',
] as const;

export type SubmissionState = (typeof STATES)[number];

const TRANSITIONS: Record<SubmissionState, SubmissionState[]> = {
  received: ['analyzing', 'rejected_low_quality'],
  analyzing: ['awaiting_approval', 'failed_analysis'],
  awaiting_approval: ['awaiting_approval', 'approved', 'rejected'],
  approved: ['posted', 'failed_publish'],
  posted: [],
  rejected_low_quality: [],
  rejected: [],
  failed_analysis: [],
  failed_publish: ['approved'],
};

export function isValidTransition(from: SubmissionState, to: SubmissionState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: SubmissionState, to: SubmissionState): void {
  if (!isValidTransition(from, to)) {
    throw new Error(`Invalid submission state transition: ${from} -> ${to}`);
  }
}
