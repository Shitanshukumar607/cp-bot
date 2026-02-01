import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  type Interaction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cleanupExpiredVerifications } from "./services/supabase.ts";
import { startRoleSyncJob } from "./utils/roleSync.ts";

dotenv.config();

interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

interface ExtendedClient extends Client {
  commands: Collection<string, Command>;
}

const requiredEnvVars = [
  "DISCORD_TOKEN",
  "CLIENT_ID",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
}) as ExtendedClient;

client.commands = new Collection<string, Command>();

async function loadCommands(): Promise<void> {
  const commandsPath = path.join(__dirname, "commands");

  if (!fs.existsSync(commandsPath)) {
    console.error("Commands directory not found:", commandsPath);
    return;
  }

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    try {
      const command = (await import(`file://${filePath}`)) as unknown;

      if (
        typeof command === "object" &&
        command !== null &&
        "data" in command &&
        "execute" in command
      ) {
        const cmd = command as Command;
        client.commands.set(cmd.data.name, cmd);
        console.log(`Loaded command: ${cmd.data.name}`);
      } else {
        console.warn(
          `Command at ${file} is missing required "data" or "execute" property`,
        );
      }
    } catch (error) {
      console.error(`Error loading command ${file}:`, error);
    }
  }
}

async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);

    const errorMessage = {
      content: "There was an error while executing this command!",
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

function startVerificationCleanupJob(): void {
  const CLEANUP_INTERVAL = 5 * 60 * 1000;

  setInterval(() => {
    cleanupExpiredVerifications()
      .then((deletedCount) => {
        if (deletedCount > 0) {
          console.log(`Cleaned up ${deletedCount} expired verification(s)`);
        }
      })
      .catch((error: unknown) => {
        console.error("Error during verification cleanup:", error);
      });
  }, CLEANUP_INTERVAL);

  console.log("Verification cleanup job started (every 5 minutes)");
}

client.once(Events.ClientReady, (readyClient) => {
  console.log("═".repeat(50));
  console.log("Bot is online!");
  console.log(`Logged in as: ${readyClient.user.tag}`);
  console.log(`Client ID: ${readyClient.user.id}`);
  console.log(`Serving ${readyClient.guilds.cache.size} guild(s)`);
  console.log("═".repeat(50));

  startVerificationCleanupJob();
  startRoleSyncJob(client);
});

client.on(Events.InteractionCreate, (interaction) => {
  handleInteraction(interaction).catch((error: unknown) => {
    console.error("Error handling interaction:", error);
  });
});

client.on(Events.Error, (error) => {
  console.error("Discord client error:", error);
});

// Handle unhandled rejections
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

async function main(): Promise<void> {
  console.log("Starting CP Verification Bot...\n");

  try {
    await loadCommands();
    console.log(`\nLoaded ${client.commands.size} command(s)\n`);

    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
