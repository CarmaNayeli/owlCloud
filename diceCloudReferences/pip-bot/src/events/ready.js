import { Events, ActivityType } from 'discord.js';

export default {
  name: Events.ClientReady,
  once: true,

  execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} guild(s)`);
    console.log(`👥 Monitoring ${client.users.cache.size} user(s)`);

    // Set bot status
    client.user.setPresence({
      activities: [{ name: 'Dice Cat | /help', type: ActivityType.Playing }],
      status: 'online',
    });

    console.log('🤖 Pip Bot is ready!\n');
  }
};
