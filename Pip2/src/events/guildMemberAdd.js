import { Events, EmbedBuilder } from 'discord.js';

export default {
  name: Events.GuildMemberAdd,
  once: false,

  async execute(member) {
    // Find a welcome channel (customize channel name as needed)
    const welcomeChannel = member.guild.channels.cache.find(
      channel => channel.name === 'welcome' || channel.name === 'general'
    );

    if (!welcomeChannel) {
      console.log('No welcome channel found');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x1E88E5)
      .setTitle('🎲 Welcome to OwlCloud!')
      .setDescription(
        `Hey <@${member.id}>! Welcome to the community!\n\n` +
        `� OwlCloud syncs your DiceCloud characters to Roll20 with Discord integration.\n` +
        `📱 Use the OwlCloud Chrome extension to sync your D&D characters seamlessly!\n\n` +
        `Use \`/help\` to see what I can do!`
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setFooter({ text: `Member #${member.guild.memberCount}` })
      .setTimestamp();

    try {
      await welcomeChannel.send({ embeds: [embed] });
      console.log(`✅ Welcomed ${member.user.tag}`);
    } catch (error) {
      console.error('Failed to send welcome message:', error);
    }
  }
};
