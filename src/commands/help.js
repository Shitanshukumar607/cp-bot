import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Get help with using the CP verification bot")
  .addStringOption((option) =>
    option
      .setName("command")
      .setDescription("Get detailed help for a specific command")
      .setRequired(false)
      .addChoices(
        { name: "link", value: "link" },
        { name: "verify", value: "verify" },
        { name: "profile", value: "profile" },
        { name: "setup", value: "setup" }
      )
  );

const commandDetails = {
  link: {
    title: "🔗 /link Command",
    description: "Link your Codeforces account to your Discord profile.",
    usage: "`/link <username>`",
    fields: [
      {
        name: "📝 How it works",
        value:
          "1. Run `/link <your_codeforces_username>`\n2. You'll receive a random problem to submit to\n3. Submit a **Compilation Error** to that problem\n4. Run `/verify` to complete verification",
      },
      {
        name: "⚙️ Parameters",
        value: "• `username` - Your Codeforces handle (required)",
      },
      {
        name: "💡 Example",
        value: "`/link tourist`",
      },
    ],
    color: 0x1f8acb,
  },
  verify: {
    title: "✅ /verify Command",
    description: "Complete your pending Codeforces account verification.",
    usage: "`/verify`",
    fields: [
      {
        name: "📝 How it works",
        value:
          "After submitting a Compilation Error to the assigned problem, run this command to verify ownership of your Codeforces account.",
      },
      {
        name: "⏱️ Time Limit",
        value:
          "You have 15 minutes to complete verification after running `/link`.",
      },
      {
        name: "🎭 Roles",
        value:
          "Upon successful verification, you'll receive the verified role and a role matching your Codeforces rank (if configured by admins).",
      },
    ],
    color: 0x00ff00,
  },
  profile: {
    title: "👤 /profile Command",
    description: "View linked competitive programming accounts.",
    usage: "`/profile [user]`",
    fields: [
      {
        name: "📝 How it works",
        value:
          "Shows all linked competitive programming accounts for yourself or another user.",
      },
      {
        name: "⚙️ Parameters",
        value:
          "• `user` - Mention a user to view their profile (optional)\n  If not provided, shows your own profile.",
      },
      {
        name: "💡 Examples",
        value:
          "`/profile` - View your own profile\n`/profile @someone` - View someone else's profile",
      },
    ],
    color: 0x9b59b6,
  },
  setup: {
    title: "⚙️ /setup Command (Admin Only)",
    description: "Configure the bot for your server.",
    usage:
      "`/setup verified-role <role>`\n`/setup rank-role <rank> <role>`\n`/setup view`",
    fields: [
      {
        name: "🔐 Permissions",
        value: "Requires **Administrator** permission.",
      },
      {
        name: "📋 Subcommands",
        value:
          "• `verified-role` - Set the role given to verified users\n• `rank-role` - Map a Codeforces rank to a Discord role\n• `view` - View current configuration",
      },
      {
        name: "💡 Examples",
        value:
          "`/setup verified-role @Verified`\n`/setup rank-role Expert @Expert`",
      },
    ],
    color: 0xe74c3c,
  },
};

export async function execute(interaction) {
  const command = interaction.options.getString("command");

  if (command) {
    const details = commandDetails[command];
    const embed = new EmbedBuilder()
      .setTitle(details.title)
      .setDescription(details.description)
      .setColor(details.color)
      .addFields({ name: "📖 Usage", value: details.usage })
      .addFields(details.fields)
      .setFooter({ text: "CP Verification Bot • Help" });

    return await interaction.reply({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setTitle("📚 CP Bot - Help")
    .setDescription(
      "This bot helps you link and verify your competitive programming accounts with Discord."
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
      }
    )
    .setFooter({
      text: "Use /help <command> for detailed information about a specific command",
    });

  await interaction.reply({ embeds: [embed] });
}

export default { data, execute };
