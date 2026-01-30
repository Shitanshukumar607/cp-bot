import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { validateUser, getUserInfo } from "../services/codeforces.service.js";
import {
	createPendingVerification,
	isAccountLinkedByOther,
} from "../services/supabase.client.js";
import { getRandomCodeforcesProblem } from "../utils/randomProblem.js";
import { getExpirationTime, getRemainingTime } from "../utils/time.js";

export const data = new SlashCommandBuilder()
	.setName("link")
	.setDescription("Link your Codeforces account")
	.addStringOption((option) =>
		option
			.setName("username")
			.setDescription("Your Codeforces handle/username")
			.setRequired(true)
			.setMinLength(3)
			.setMaxLength(24),
	);

export async function execute(interaction) {
	try {
		await handleLinkCodeforces(interaction);
	} catch (error) {
		console.error("Link command error:", error);

		const errorMessage = error.message || "An unexpected error occurred.";

		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content: `❌ Error: ${errorMessage}`,
			});
		} else {
			await interaction.reply({
				content: `❌ Error: ${errorMessage}`,
			});
		}
	}
}

/**
 * Handle Codeforces account linking
 */
async function handleLinkCodeforces(interaction) {
	await interaction.deferReply();

	const username = interaction.options.getString("username");
	const userId = interaction.user.id;
	const guildId = interaction.guildId;

	// Step 1: Validate the username exists on Codeforces
	const userExists = await validateUser(username);
	if (!userExists) {
		return await interaction.editReply({
			content: `❌ Codeforces user **${username}** not found.\n\nPlease check the username and try again.`,
		});
	}

	// Step 2: Check if this account is already linked by another user
	const isLinkedByOther = await isAccountLinkedByOther(
		guildId,
		"codeforces",
		username,
		userId,
	);
	if (isLinkedByOther) {
		return await interaction.editReply({
			content: `❌ The Codeforces account **${username}** is already linked to another Discord user in this server.`,
		});
	}

	// Step 3: Get user info for display
	let userInfo;
	try {
		userInfo = await getUserInfo(username);
	} catch {
		userInfo = { handle: username, rank: "unknown", rating: 0 };
	}

	// Step 4: Select a random problem
	const problem = await getRandomCodeforcesProblem();

	// Step 5: Calculate expiration time
	const expiresAt = getExpirationTime();
	const remaining = getRemainingTime(expiresAt);

	// Step 6: Store pending verification in database
	await createPendingVerification({
		discord_user_id: userId,
		guild_id: guildId,
		username: userInfo.handle, // Use the exact handle from CF API
		problem_id: problem.id,
		problem_url: problem.url,
		problem_name: problem.name,
		expires_at: expiresAt.toISOString(),
	});

	// Step 7: Create the verification embed
	const embed = new EmbedBuilder()
		.setTitle("🔗 Codeforces Verification")
		.setColor(0x1f8acb) // Codeforces blue
		.setDescription(
			`To verify you own the Codeforces account **${userInfo.handle}**, you need to submit a **Compilation Error** to the problem below.`,
		)
		.addFields(
			{
				name: "📝 Problem",
				value: `[${problem.name}](${problem.url})`,
				inline: true,
			},
			{
				name: "⭐ Difficulty",
				value: `${problem.rating}`,
				inline: true,
			},
			{
				name: "⏱️ Time Limit",
				value: remaining,
				inline: true,
			},
			{
				name: "📊 Your Current Stats",
				value: `**Rank:** ${userInfo.rank}\n**Rating:** ${userInfo.rating}`,
				inline: false,
			},
			{
				name: "📋 Instructions",
				value: `1. Go to the problem: [Click Here](${problem.url})\n2. Submit any code that causes a **Compilation Error**\n   (e.g., \`int main( { }\` or just \`error\`)\n3. Run \`/verify\` to complete verification`,
				inline: false,
			},
		)
		.setFooter({
			text: `Verification expires in ${remaining}`,
		})
		.setTimestamp(expiresAt);

	await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };
