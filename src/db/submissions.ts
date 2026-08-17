import { db } from './client.js';
import { assertTransition, type SubmissionState } from '../state/machine.js';
import type { CaptionResult } from '../ai/prompt.js';

export interface Submission {
  id: number;
  state: SubmissionState;
  media_type: 'photo' | 'video';
  file_id: string;
  file_unique_id: string;
  phash: string | null;
  blur_score: number | null;
  baker_note: string;
  caption: string | null;
  quality_flag: CaptionResult['quality_flag'] | null;
  quality_reason: string | null;
  draft_message_id: number | null;
  channel_message_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubmissionInput {
  media_type: 'photo' | 'video';
  file_id: string;
  file_unique_id: string;
  baker_note: string;
}

export function createSubmission(input: CreateSubmissionInput): Submission {
  const stmt = db.prepare(`
    INSERT INTO submissions (state, media_type, file_id, file_unique_id, baker_note)
    VALUES ('received', @media_type, @file_id, @file_unique_id, @baker_note)
    RETURNING *
  `);
  return stmt.get(input) as Submission;
}

export function getSubmission(id: number): Submission | undefined {
  return db.prepare('SELECT * FROM submissions WHERE id = ?').get(id) as Submission | undefined;
}

export function getRecentSubmissions(limit: number): Submission[] {
  return db
    .prepare('SELECT * FROM submissions ORDER BY id DESC LIMIT ?')
    .all(limit) as Submission[];
}

export function getOldestApproved(): Submission | undefined {
  return db
    .prepare("SELECT * FROM submissions WHERE state = 'approved' ORDER BY id ASC LIMIT 1")
    .get() as Submission | undefined;
}

export function transitionState(id: number, to: SubmissionState): Submission {
  const current = getSubmission(id);
  if (!current) {
    throw new Error(`Submission ${id} not found`);
  }
  assertTransition(current.state, to);
  db.prepare("UPDATE submissions SET state = ?, updated_at = datetime('now') WHERE id = ?").run(
    to,
    id,
  );
  return getSubmission(id) as Submission;
}

export function setBlurScore(id: number, blurScore: number): void {
  db.prepare("UPDATE submissions SET blur_score = ?, updated_at = datetime('now') WHERE id = ?").run(
    blurScore,
    id,
  );
}

export function setPhash(id: number, phash: bigint): void {
  db.prepare("UPDATE submissions SET phash = ?, updated_at = datetime('now') WHERE id = ?").run(
    phash.toString(),
    id,
  );
}

export function setCaptionResult(id: number, result: CaptionResult): void {
  db.prepare(
    `UPDATE submissions
     SET caption = ?, quality_flag = ?, quality_reason = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(result.caption, result.quality_flag, result.quality_reason, id);
}

export function setCaption(id: number, caption: string): void {
  db.prepare("UPDATE submissions SET caption = ?, updated_at = datetime('now') WHERE id = ?").run(
    caption,
    id,
  );
}

export function setDraftMessageId(id: number, messageId: number): void {
  db.prepare(
    "UPDATE submissions SET draft_message_id = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(messageId, id);
}

export function setChannelMessageId(id: number, messageId: number): void {
  db.prepare(
    "UPDATE submissions SET channel_message_id = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(messageId, id);
}

export function findByDraftMessageId(messageId: number): Submission | undefined {
  return db
    .prepare('SELECT * FROM submissions WHERE draft_message_id = ?')
    .get(messageId) as Submission | undefined;
}

// Recent phashed submissions, newest first — used for near-duplicate comparison
// against an incoming photo. Capped so a full-table scan stays cheap forever.
export function getRecentPhashes(limit = 200): { id: number; phash: bigint }[] {
  const rows = db
    .prepare('SELECT id, phash FROM submissions WHERE phash IS NOT NULL ORDER BY id DESC LIMIT ?')
    .all(limit) as { id: number; phash: string }[];
  return rows.map((r) => ({ id: r.id, phash: BigInt(r.phash) }));
}
