import axios from "axios";

const CF_MIN_RATING = 1500;
const CF_MAX_RATING = 2500;

let cfProblemsCache = null;
let cfCacheTimestamp = null;
const CF_CACHE_DURATION = 3600000;

async function fetchCodeforcesProblems() {
	// Return cached problems if still valid
	if (
		cfProblemsCache &&
    cfCacheTimestamp &&
    Date.now() - cfCacheTimestamp < CF_CACHE_DURATION
	) {
		return cfProblemsCache;
	}

	try {
		const response = await axios.get(
			"https://codeforces.com/api/problemset.problems",
			{
				timeout: 10000,
			},
		);

		if (response.data.status !== "OK") {
			throw new Error("Codeforces API returned non-OK status");
		}

		const problems = response.data.result.problems.filter((problem) => {
			return (
				problem.rating &&
        problem.rating >= CF_MIN_RATING &&
        problem.rating <= CF_MAX_RATING
			);
		});

		cfProblemsCache = problems;
		cfCacheTimestamp = Date.now();

		return problems;
	} catch (error) {
		console.error("Error fetching Codeforces problems:", error.message);

		if (cfProblemsCache) {
			console.log("Using stale cache for Codeforces problems");
			return cfProblemsCache;
		}

		throw error;
	}
}

/**
 * Get a random Codeforces problem
 * @returns {Promise<Object>} Problem object with id, name, and url
 */
export async function getRandomCodeforcesProblem() {
	const problems = await fetchCodeforcesProblems();

	if (!problems || problems.length === 0) {
		throw new Error("No Codeforces problems available");
	}

	// Select a random problem
	const randomIndex = Math.floor(Math.random() * problems.length);
	const problem = problems[randomIndex];

	// Construct problem URL
	const problemUrl = `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;

	return {
		id: `${problem.contestId}${problem.index}`,
		contestId: problem.contestId,
		index: problem.index,
		name: problem.name,
		rating: problem.rating,
		url: problemUrl,
	};
}

export default {
	getRandomCodeforcesProblem,
};
