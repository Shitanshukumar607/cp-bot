import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJokes(): string[] {
  try {
    const jokesPath = join(__dirname, "../data/jokes.txt");
    const jokesContent = readFileSync(jokesPath, "utf-8");
    return jokesContent
      .split("\n")
      .map((joke) => joke.trim())
      .filter((joke) => joke.length > 0);
  } catch (error) {
    console.error("Failed to load jokes:", error);
    return ["Your code is so bad, even the compiler refuses to roast you."];
  }
}

export const data = new SlashCommandBuilder()
  .setName("roast")
  .setDescription("Brutally roast a fellow competitive programmer 🔥")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The victim to roast")
      .setRequired(true),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const targetUser = interaction.options.getUser("user", true);

  if (targetUser.id === interaction.user.id) {
    await interaction.reply(
      "Imagine being so lonely you have to roast yourself. That's not a flex, that's just sad. 💀",
    );
    return;
  }

  const jokes = loadJokes();

  const randomIndex = Math.floor(Math.random() * jokes.length);
  const randomJoke =
    jokes[randomIndex] ??
    "Your code is so bad, even the compiler refuses to roast you.";

  await interaction.reply(`<@${targetUser.id}> ${randomJoke}`);
}

export default { data, execute };
