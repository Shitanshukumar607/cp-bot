import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
	console.error("Missing DISCORD_TOKEN or CLIENT_ID in .env file");
	process.exit(1);
}

const args = process.argv.slice(2);
const guildIndex = args.indexOf("--guild");
const guildId = guildIndex !== -1 ? args[guildIndex + 1] : null;

async function loadCommandsData() {
	const commands = [];
	const commandsPath = path.join(__dirname, "commands");

	if (!fs.existsSync(commandsPath)) {
		console.error("Commands directory not found:", commandsPath);
		return commands;
	}

	const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);

		try {
			const command = await import(`file://${filePath}`);

			if ("data" in command) {
				commands.push(command.data.toJSON());
				console.log(`Loaded: ${command.data.name}`);
			} else {
				console.warn(`Skipping ${file} - missing "data" property`);
			}
		} catch (error) {
			console.error(`Error loading ${file}:`, error);
		}
	}

	return commands;
}

async function deployCommands() {
	console.log("Starting command deployment...\n");

	try {
		const commands = await loadCommandsData();

		if (commands.length === 0) {
			console.error("No commands found to deploy");
			return;
		}

		console.log(`\nFound ${commands.length} command(s) to deploy\n`);

		const rest = new REST().setToken(process.env.DISCORD_TOKEN);

		if (guildId) {
			console.log(`Deploying to guild: ${guildId}`);

			const data = await rest.put(
				Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
				{ body: commands },
			);

			console.log(
				`\nSuccessfully deployed ${data.length} command(s) to guild ${guildId}`,
			);
		} else {
			console.log("Deploying globally (may take up to 1 hour to propagate)");

			const data = await rest.put(
				Routes.applicationCommands(process.env.CLIENT_ID),
				{ body: commands },
			);

			console.log(`\nSuccessfully deployed ${data.length} command(s) globally`);
		}

		console.log("\nDeployed commands:");
		for (const cmd of commands) {
			console.log(`   • /${cmd.name} - ${cmd.description}`);
		}
	} catch (error) {
		console.error("Error deploying commands:", error);
		if (error.code === 50001) {
			console.error("\nBot is missing access. Make sure:");
			console.error("   1. The bot is invited to the server");
			console.error("   2. The bot has \"applications.commands\" scope");
		}
	}
}

deployCommands();
