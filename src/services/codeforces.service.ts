import axios, { AxiosError } from "axios";
import {
  CodeforcesApiResponse,
  CodeforcesSubmission,
  CodeforcesUser,
  Submission,
  UserInfo,
  VerificationResult,
} from "../types/types.js";
import { isSubmissionAfterStart } from "../utils/time.js";

const CODEFORCES_API_BASE = "https://codeforces.com/api";

const REQUEST_DELAY = 250;
let lastRequestTime = 0;

/** Wait to respect rate limits */
async function respectRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < REQUEST_DELAY) {
    await new Promise((resolve) =>
      setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest),
    );
  }

  lastRequestTime = Date.now();
}

/** Make a rate-limited request to Codeforces API */
async function makeRequest<T>(
  endpoint: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  await respectRateLimit();

  try {
    const response = await axios.get<CodeforcesApiResponse<T>>(
      `${CODEFORCES_API_BASE}${endpoint}`,
      {
        params,
        timeout: 15000,
      },
    );

    if (response.data.status !== "OK" || !response.data.result) {
      throw new Error(response.data.comment || "Codeforces API error");
    }

    return response.data.result;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response) {
        const message =
          (error.response.data as CodeforcesApiResponse<unknown>)?.comment ||
          error.message;
        throw new Error(`Codeforces API error: ${message}`);
      }
      if (error.code === "ECONNABORTED") {
        throw new Error("Codeforces API request timed out");
      }
    }
    throw error;
  }
}

/**Validate if a Codeforces user exists */
export async function validateUser(username: string): Promise<boolean> {
  try {
    await makeRequest<CodeforcesUser[]>("/user.info", { handles: username });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return false;
    }
    throw error;
  }
}

/** Get Codeforces user information */
export async function getUserInfo(username: string): Promise<UserInfo> {
  try {
    const users = await makeRequest<CodeforcesUser[]>("/user.info", {
      handles: username,
    });

    const user = users[0];

    if (!user) {
      throw new Error(`User "${username}" not found`);
    }

    return {
      handle: user.handle,
      rank: user.rank ?? "unrated",
      rating: user.rating ?? 0,
      maxRank: user.maxRank ?? "unrated",
      maxRating: user.maxRating ?? 0,
      avatar: user.avatar,
      titlePhoto: user.titlePhoto,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      throw new Error(`Codeforces user "${username}" not found`);
    }
    throw error;
  }
}

/** Get recent submissions for a user */
async function getRecentSubmissions(
  username: string,
  count = 10,
): Promise<Submission[]> {
  try {
    const submissions = await makeRequest<CodeforcesSubmission[]>(
      "/user.status",
      {
        handle: username,
        from: 1,
        count,
      },
    );

    return submissions.map((sub) => ({
      id: sub.id,
      contestId: sub.problem.contestId,
      problemIndex: sub.problem.index,
      problemName: sub.problem.name,
      verdict: sub.verdict,
      creationTimeSeconds: sub.creationTimeSeconds,
      programmingLanguage: sub.programmingLanguage,
    }));
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error fetching submissions:", error.message);
    }
    throw error;
  }
}

/**
 * Check if user has submitted a Compilation Error to a specific problem
 * after a given timestamp.
 */
export async function checkCompilationErrorSubmission(
  username: string,
  contestId: number,
  problemIndex: string,
  startedAt: string | Date,
): Promise<VerificationResult> {
  try {
    const submissions = await getRecentSubmissions(username, 20);

    const matchingSubmission = submissions.find((sub) => {
      const isProblemMatch =
        sub.contestId === contestId &&
        sub.problemIndex.toUpperCase() === problemIndex.toUpperCase();

      const isCompilationError = sub.verdict === "COMPILATION_ERROR";

      const isAfterStart = isSubmissionAfterStart(
        sub.creationTimeSeconds,
        startedAt,
      );

      return isProblemMatch && isCompilationError && isAfterStart;
    });

    if (matchingSubmission) {
      return {
        verified: true,
        submission: matchingSubmission,
        message: "Compilation Error submission found!",
      };
    }

    // Check if there are any submissions to the problem (but wrong verdict)
    const anyProblemSubmission = submissions.find(
      (sub) =>
        sub.contestId === contestId &&
        sub.problemIndex.toUpperCase() === problemIndex.toUpperCase() &&
        isSubmissionAfterStart(sub.creationTimeSeconds, startedAt),
    );

    if (anyProblemSubmission) {
      return {
        verified: false,
        submission: anyProblemSubmission,
        message: `Found submission but verdict was "${anyProblemSubmission.verdict}" instead of "COMPILATION_ERROR"`,
      };
    }

    return {
      verified: false,
      submission: null,
      message: "No submission found to the specified problem",
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error checking CE submission:", error.message);
    }
    throw error;
  }
}

export async function getUserRank(username: string): Promise<string> {
  const userInfo = await getUserInfo(username);
  return userInfo.rank;
}

export default {
  validateUser,
  getUserInfo,
  checkCompilationErrorSubmission,
  getUserRank,
};
