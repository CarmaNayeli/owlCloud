import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('testdbconnection')
    .setDescription('Test Supabase database connection and Discord linking setup'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: 64 });

      // Check Supabase credentials
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

      const embed = new EmbedBuilder()
        .setTitle('🔍 Database Connection Test')
        .setColor(0x4ECDC4);

      if (!SUPABASE_URL) {
        embed.addFields({
          name: '❌ SUPABASE_URL Missing',
          value: 'The SUPABASE_URL environment variable is not set',
          inline: false
        });
      } else {
        embed.addFields({
          name: '✅ SUPABASE_URL Found',
          value: SUPABASE_URL.substring(0, 30) + '...',
          inline: false
        });
      }

      if (!SUPABASE_SERVICE_KEY) {
        embed.addFields({
          name: '❌ SUPABASE_SERVICE_KEY Missing',
          value: 'The SUPABASE_SERVICE_KEY environment variable is not set',
          inline: false
        });
      } else {
        embed.addFields({
          name: '✅ SUPABASE_SERVICE_KEY Found',
          value: 'Service key is configured (' + SUPABASE_SERVICE_KEY.substring(0, 20) + '...)',
          inline: false
        });
      }

      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        embed.setColor(0xE74C3C);
        embed.addFields({
          name: '🚨 Action Required',
          value: 'Discord linking will NOT work without these credentials. Please add them to your bot environment.',
          inline: false
        });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Test database connection
      embed.addFields({
        name: '🔄 Testing Database Connection...',
        value: 'Attempting to connect to Supabase...',
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });

      try {
        const testResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/auth_tokens?select=count&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
          }
        );

        if (testResponse.ok) {
          const data = await testResponse.json();
          const count = data.length > 0 ? data[0].count : 0;

          embed.setColor(0x2ECC71);
          embed.spliceFields(3, 1, { // Replace the "Testing..." field
            name: '✅ Database Connection Successful',
            value: `Connected! Found ${count} auth_tokens records`,
            inline: false
          });

          // Check if your specific record exists and has Discord fields
          const userResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/auth_tokens?id=eq.16&select=discord_user_id,discord_username,discord_global_name,updated_at`,
            {
              headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
              }
            }
          );

          if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData.length > 0) {
              const user = userData[0];
              embed.addFields({
                name: '👤 Your Discord Link Status',
                value: `User ID: ${user.discord_user_id || '❌ Not linked'}\nUsername: ${user.discord_username || '❌ Not linked'}\nDisplay Name: ${user.discord_global_name || '❌ Not linked'}`,
                inline: false
              });

              if (user.discord_user_id) {
                embed.addFields({
                  name: '✅ Discord Linking Working!',
                  value: 'Your Discord account is already linked. New Discord linkings will also work properly.',
                  inline: false
                });
              } else {
                embed.addFields({
                  name: '⚠️ Discord Not Linked Yet',
                  value: 'Use `/owlcloud <code>` to link your Discord account. The database connection is ready!',
                  inline: false
                });
              }
            }
          }

        } else {
          embed.setColor(0xE74C3C);
          embed.spliceFields(3, 1, {
            name: '❌ Database Connection Failed',
            value: `Error ${testResponse.status}: ${testResponse.statusText}`,
            inline: false
          });
        }
      } catch (dbError) {
        embed.setColor(0xE74C3C);
        embed.spliceFields(3, 1, {
          name: '❌ Database Test Error',
          value: dbError.message,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Test DB connection error:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('❌ Test Failed')
          .setDescription(`Error: ${error.message}`)
        ]
      });
    }
  }
};
