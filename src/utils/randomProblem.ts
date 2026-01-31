import axios from "axios";

const CF_MIN_RATING = 1500;
const CF_MAX_RATING = 2500;

interface CodeforcesProblem {
  contestId: number;
  index: string;
  name: string;
  rating?: number;
  tags?: string[];
}

interface CodeforcesProblemsetResponse {
  status: "OK" | "FAILED";
  result?: {
    problems: CodeforcesProblem[];
    problemStatistics: unknown[];
  };
  comment?: string;
}

export interface RandomProblem {
  id: string;
  contestId: number;
  index: string;
  name: string;
  rating: number;
  url: string;
}

let cfProblemsCache: CodeforcesProblem[] | null = null;
let cfCacheTimestamp: number | null = null;
const CF_CACHE_DURATION = 3600000;

async function fetchCodeforcesProblems(): Promise<CodeforcesProblem[]> {
  // Return cached problems if still valid
  if (
    cfProblemsCache &&
    cfCacheTimestamp &&
    Date.now() - cfCacheTimestamp < CF_CACHE_DURATION
  ) {
    return cfProblemsCache;
  }

  try {
    const response = await axios.get<CodeforcesProblemsetResponse>(
      "https://codeforces.com/api/problemset.problems",
      {
        timeout: 10000,
      },
    );

    if (response.data.status !== "OK" || !response.data.result) {
      throw new Error("Codeforces API returned non-OK status");
    }

    const problems = response.data.result.problems.filter(
      (problem): problem is CodeforcesProblem & { rating: number } => {
        return (
          problem.rating !== undefined &&
          problem.rating >= CF_MIN_RATING &&
          problem.rating <= CF_MAX_RATING
        );
      },
    );

    cfProblemsCache = problems;
    cfCacheTimestamp = Date.now();

    return problems;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching Codeforces problems:", errorMessage);

    if (cfProblemsCache) {
      console.log("Using stale cache for Codeforces problems");
      return cfProblemsCache;
    }

    throw error;
  }
}

/** Get a random Codeforces problem */
export async function getRandomCodeforcesProblem(): Promise<RandomProblem> {
  const problems = await fetchCodeforcesProblems();

  if (!problems || problems.length === 0) {
    throw new Error("No Codeforces problems available");
  }

  // Select a random problem
  const randomIndex = Math.floor(Math.random() * problems.length);
  const problem = problems[randomIndex];

  if (!problem) {
    throw new Error("Failed to select a random problem");
  }

  // Construct problem URL
  const problemUrl = `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;

  return {
    id: `${problem.contestId}${problem.index}`,
    contestId: problem.contestId,
    index: problem.index,
    name: problem.name,
    rating: problem.rating ?? 0,
    url: problemUrl,
  };
}

export default {
  getRandomCodeforcesProblem,
};
