import { Events, ActivityType } from 'discord.js';
import { startTurnPoller } from '../rollcloud/turnPoller.js';

export default {
  name: Events.ClientReady,
  once: true,

  execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} guild(s)`);
    console.log(`👥 Monitoring ${client.users.cache.size} user(s)`);

    // Set bot status
    client.user.setPresence({
      activities: [{ name: 'RollCloud | /help', type: ActivityType.Playing }],
      status: 'online',
    });

    // Start RollCloud turn poller (if Supabase is configured)
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      startTurnPoller(client);
    } else {
      console.log('ℹ️ RollCloud turn poller disabled (Supabase not configured)');
    }

    console.log('🤖 Pip 2 is ready!\n');
  }
};
