import type { Database } from "./db.types.ts";

export type GuildConfig = Database["public"]["Tables"]["guild_config"]["Row"];

export type PendingVerification =
  Database["public"]["Tables"]["pending_verifications"]["Row"];

export type LinkedAccounts =
  Database["public"]["Tables"]["linked_accounts"]["Row"];

export type CodeforcesRank =
  | "newbie"
  | "pupil"
  | "specialist"
  | "expert"
  | "candidate master"
  | "master"
  | "international master"
  | "grandmaster"
  | "international grandmaster"
  | "legendary grandmaster";

export interface CodeforcesApiResponse<T> {
  status: "OK" | "FAILED";
  result?: T;
  comment?: string;
}

export interface CodeforcesUser {
  handle: string;
  rank?: string;
  rating?: number;
  maxRank?: string;
  maxRating?: number;
  avatar?: string;
  titlePhoto?: string;
}

export interface CodeforcesProblem {
  contestId: number;
  index: string;
  name: string;
}

export interface CodeforcesSubmission {
  id: number;
  problem: CodeforcesProblem;
  verdict?: string;
  creationTimeSeconds: number;
  programmingLanguage: string;
}

export interface UserInfo {
  handle: string;
  rank: string;
  rating: number;
  maxRank: string;
  maxRating: number;
  avatar?: string | undefined;
  titlePhoto?: string | undefined;
}

export interface Submission {
  id: number;
  contestId: number;
  problemIndex: string;
  problemName: string;
  verdict?: string | undefined;
  creationTimeSeconds: number;
  programmingLanguage: string;
}

export interface VerificationResult {
  verified: boolean;
  submission: Submission | null;
  message: string;
}
