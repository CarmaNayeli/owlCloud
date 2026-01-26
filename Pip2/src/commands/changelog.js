import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  data: new SlashCommandBuilder()
    .setName('changelog')
    .setDescription('View or post Dice Cat app changelogs')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View the latest changelog')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('post')
        .setDescription('Post changelog to announcements channel (Admin only)')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to post to (defaults to current channel)')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      return await handleView(interaction);
    } else if (subcommand === 'post') {
      return await handlePost(interaction);
    }
  }
};

async function handleView(interaction) {
  try {
    const changelogPath = join(__dirname, '../../../CHANGELOG.md');
    const changelogContent = readFileSync(changelogPath, 'utf-8');

    // Parse the changelog to get the most recent section
    const lines = changelogContent.split('\n');
    let recentChanges = [];
    let capturing = false;
    let sectionsFound = 0;

    for (const line of lines) {
      // Start capturing after the first H2 (##)
      if (line.startsWith('## ') && !capturing) {
        capturing = true;
        recentChanges.push(line);
        sectionsFound++;
        continue;
      }

      // Stop at the next H2 or after we have enough content
      if (line.startsWith('## ') && capturing && sectionsFound > 0) {
        break;
      }

      if (capturing) {
        recentChanges.push(line);
      }

      // Limit to ~2000 characters for Discord embed
      if (recentChanges.join('\n').length > 1800) {
        recentChanges.push('\n*...view full changelog at https://github.com/CarmaNayeli/dice-cat/blob/main/CHANGELOG.md*');
        break;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x1E88E5)
      .setTitle('📋 Dice Cat Changelog')
      .setDescription(recentChanges.join('\n').substring(0, 4000))
      .setFooter({ text: 'Dice Cat • Board Gaming Community' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 }); // ephemeral
  } catch (error) {
    console.error('Error reading changelog:', error);
    await interaction.reply({
      content: '❌ Failed to read changelog file.',
      flags: 64 // ephemeral
    });
  }
}

async function handlePost(interaction) {
  // Check if user has Administrator permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({
      content: '❌ You need Administrator permission to post changelogs.',
      flags: 64 // ephemeral
    });
  }

  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

  try {
    const changelogPath = join(__dirname, '../../../CHANGELOG.md');
    const changelogContent = readFileSync(changelogPath, 'utf-8');

    // Parse the changelog to get the most recent section
    const lines = changelogContent.split('\n');
    let recentChanges = [];
    let capturing = false;
    let sectionsFound = 0;
    let title = 'Recent Updates';

    for (const line of lines) {
      // Extract the section title
      if (line.startsWith('## ') && !capturing) {
        title = line.replace('## ', '');
        capturing = true;
        continue;
      }

      // Stop at the next H2
      if (line.startsWith('## ') && capturing && sectionsFound > 0) {
        break;
      }

      if (capturing) {
        recentChanges.push(line);
      }

      // Limit to ~2000 characters for Discord embed
      if (recentChanges.join('\n').length > 1800) {
        recentChanges.push('\n*...view full changelog at https://github.com/CarmaNayeli/dice-cat/blob/main/CHANGELOG.md*');
        break;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x1E88E5)
      .setTitle(`🎲 Dice Cat: ${title}`)
      .setDescription(recentChanges.join('\n').substring(0, 4000))
      .setFooter({ text: 'Check out the app: https://dicecat.app' })
      .setTimestamp();

    await targetChannel.send({
      content: '@everyone New Dice Cat update!',
      embeds: [embed]
    });

    await interaction.reply({
      content: `✅ Changelog posted to ${targetChannel}`,
      flags: 64 // ephemeral
    });
  } catch (error) {
    console.error('Error posting changelog:', error);
    await interaction.reply({
      content: '❌ Failed to post changelog.',
      flags: 64 // ephemeral
    });
  }
}
