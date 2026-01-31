import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('testdiscordlink')
    .setDescription('Test Discord linking functionality and database update'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: 64 });

      // Check if Supabase credentials are available
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Supabase Not Configured')
            .setDescription(
              'The bot is missing Supabase credentials. Discord linking cannot work without them.\n\n' +
              '**Required Environment Variables:**\n' +
              '• SUPABASE_URL\n' +
              '• SUPABASE_SERVICE_KEY\n\n' +
              'Please add these to the bot\'s .env file and restart the bot.'
            )
          ]
        });
        return;
      }

      // Test database connection
      const testResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/auth_tokens?select=count&id=eq.16`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          }
        }
      );

      if (!testResponse.ok) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Database Connection Failed')
            .setDescription(`Failed to connect to Supabase: ${testResponse.status}`)
          ]
        });
        return;
      }

      const data = await testResponse.json();
      const recordCount = data.length > 0 ? data[0].count : 0;

      // Check current Discord fields
      const currentResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/auth_tokens?id=eq.16&select=discord_user_id,discord_username,discord_global_name`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          }
        }
      );

      let discordFields = { discord_user_id: null, discord_username: null, discord_global_name: null };
      if (currentResponse.ok) {
        const currentData = await currentResponse.json();
        if (currentData.length > 0) {
          discordFields = currentData[0];
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x4ECDC4)
        .setTitle('🔗 Discord Link Test Results')
        .addFields(
          { 
            name: '🔑 Supabase Connection', 
            value: '✅ Connected successfully', 
            inline: false 
          },
          { 
            name: '📊 Database Records', 
            value: `Found ${recordCount} records`, 
            inline: true 
          },
          { 
            name: '👤 Discord User ID', 
            value: discordFields.discord_user_id || '❌ Not linked', 
            inline: true 
          },
          { 
            name: '🏷️ Discord Username', 
            value: discordFields.discord_username || '❌ Not linked', 
            inline: true 
          },
          { 
            name: '📝 Display Name', 
            value: discordFields.discord_global_name || '❌ Not linked', 
            inline: true 
          }
        )
        .setFooter({ text: 'Discord linking functionality test' })
        .setTimestamp();

      if (discordFields.discord_user_id) {
        embed.addFields({
          name: '✅ Status',
          value: 'Discord linking is working and your account is linked!',
          inline: false
        });
      } else {
        embed.addFields({
          name: '⚠️ Status',
          value: 'Discord linking is configured but your account is not linked yet.\nUse `/owlcloud <code>` to link your account.',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Test Discord link error:', error);
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
