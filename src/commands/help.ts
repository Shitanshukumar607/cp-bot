import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Get help with using the CP verification bot");

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle("📚 CP Bot - Help")
    .setDescription(
      "This bot helps you link and verify your competitive programming accounts with Discord.",
    )
    .setColor(0x3498db)
    .addFields(
      {
        name: "🔗 /link <username>",
        value: "Start linking your Codeforces account",
        inline: true,
      },
      {
        name: "✅ /verify",
        value: "Complete your account verification",
        inline: true,
      },
      {
        name: "👤 /profile [user]",
        value: "View linked accounts",
        inline: true,
      },
      {
        name: "⚙️ /setup (Admin)",
        value: "Configure bot settings",
        inline: true,
      },
      {
        name: "\u200B",
        value: "\u200B",
        inline: true,
      },
      {
        name: "❓ /help [command]",
        value: "Show this help message",
        inline: true,
      },
      {
        name: "📋 Quick Start Guide",
        value:
          "1️⃣ Use `/link <username>` with your Codeforces handle\n2️⃣ Submit a **Compilation Error** to the given problem\n3️⃣ Run `/verify` to complete verification\n4️⃣ Check your profile with `/profile`",
      },
    )
    .setFooter({
      text: "Use /help <command> for detailed information about a specific command",
    });

  await interaction.reply({ embeds: [embed] });
}

export default { data, execute };
