import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('webhook')
    .setDescription('Show Discord webhook URL and integration status')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Action to perform')
        .setRequired(false)
        .addChoices(
          { name: 'Status', value: 'status' },
          { name: 'URL', value: 'url' },
          { name: 'Test', value: 'test' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const action = interaction.options.getString('action') || 'status';

      // Get the user's OwlCloud pairing
      const pairingResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/owlcloud_pairings?discord_user_id=eq.${interaction.user.id}&status=eq.connected&select=*`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          }
        }
      );

      if (!pairingResponse.ok) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Connection Error')
            .setDescription('Failed to check OwlCloud connection status.')
          ]
        });
        return;
      }

      const pairings = await pairingResponse.json();
      
      if (pairings.length === 0) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Not Connected')
            .setDescription('You don\'t have any OwlCloud connections. Use `/owlcloud <code>` to connect your extension.')
          ]
        });
        return;
      }

      const pairing = pairings[0];

      if (action === 'status') {
        // Show comprehensive webhook status
        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('🔗 Discord Webhook Status')
          .setDescription(`**Discord User:** ${interaction.user.displayName}\n**Server:** ${pairing.server_name || 'Unknown'}\n**Channel:** <#${pairing.channel_name || 'unknown'}>`)
          .addFields(
            { 
              name: 'Connection Status', 
              value: `✅ Connected to OwlCloud`, 
              inline: true 
            },
            { 
              name: 'Paired At', 
              value: new Date(pairing.connected_at).toLocaleDateString(), 
              inline: true 
            },
            {
              name: 'Webhook URL',
              value: pairing.webhook_url ? `||${pairing.webhook_url}||` : '❌ Not configured',
              inline: false
            },
            {
              name: 'Integration Type',
              value: pairing.webhook_url ? 'Webhook-based' : 'Pairing-based',
              inline: true
            },
            {
              name: 'Pairing ID',
              value: `\`${pairing.id}\``,
              inline: true
            }
          )
          .setFooter({ text: 'OwlCloud Discord Integration' })
          .setTimestamp();

        if (pairing.webhook_url) {
          embed.addFields({
            name: '🔧 Webhook Information',
            value: `**URL Format:** ${pairing.webhook_url.includes('discord.com/api/webhooks') ? '✅ Valid Discord webhook' : '⚠️ Invalid format'}\n**Server ID:** ${extractServerIdFromWebhook(pairing.webhook_url) || 'Unknown'}\n**Channel ID:** ${extractChannelIdFromWebhook(pairing.webhook_url) || 'Unknown'}`,
            inline: false
          });
        } else {
          embed.addFields({
            name: '⚠️ Setup Required',
            value: 'No webhook URL configured. Use the OwlCloud extension to set up Discord integration, or configure manually in the extension settings.',
            inline: false
          });
        }

        await interaction.editReply({ embeds: [embed] });

      } else if (action === 'url') {
        // Show just the webhook URL
        if (!pairing.webhook_url) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle('❌ No Webhook URL')
              .setDescription('No webhook URL is configured for this connection.\n\nUse the OwlCloud extension to set up Discord integration.')
            ]
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🔗 Discord Webhook URL')
          .setDescription(`**Server:** ${pairing.server_name || 'Unknown'}\n**Channel:** <#${pairing.channel_name || 'unknown'}>`)
          .addFields(
            {
              name: 'Webhook URL',
              value: `||${pairing.webhook_url}||`,
              inline: false
            },
            {
              name: '📋 Copy Instructions',
              value: '1. Click the URL above (it\'s hidden to prevent accidental clicks)\n2. Copy the URL from your clipboard\n3. Use it for Discord bot integrations or testing',
              inline: false
            }
          )
          .setFooter({ text: 'OwlCloud Discord Integration' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

      } else if (action === 'test') {
        // Test the webhook
        if (!pairing.webhook_url) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle('❌ Cannot Test')
              .setDescription('No webhook URL is configured to test.\n\nUse the OwlCloud extension to set up Discord integration.')
            ]
          });
          return;
        }

        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('🧪 Testing Webhook...')
            .setDescription('Sending a test message to your Discord webhook...')
          ]
        });

        try {
          const testMessage = {
            embeds: [{
              title: '🧪 OwlCloud Webhook Test',
              description: 'This is a test message from OwlCloud to verify your Discord webhook is working correctly.',
              color: 0x00FF00,
              fields: [
                {
                  name: 'Test Details',
                  value: `**User:** ${interaction.user.displayName}\n**Server:** ${pairing.server_name || 'Unknown'}\n**Channel:** <#${pairing.channel_name || 'unknown'}>\n**Time:** ${new Date().toLocaleString()}`,
                  inline: false
                },
                {
                  name: 'Status',
                  value: '✅ Webhook is working correctly!',
                  inline: false
                }
              ],
              footer: {
                text: 'OwlCloud Webhook Test'
              },
              timestamp: new Date().toISOString()
            }]
          };

          const response = await fetch(pairing.webhook_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(testMessage)
          });

          if (response.ok) {
            await interaction.editReply({
              embeds: [new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Webhook Test Successful')
                .setDescription('The test message was sent successfully to your Discord channel!')
                .addFields(
                  {
                    name: 'Test Results',
                    value: `**Status:** ✅ Success\n**Response:** HTTP ${response.status}\n**Channel:** <#${pairing.channel_name || 'unknown'}>`,
                    inline: false
                  }
                )
                .setFooter({ text: 'OwlCloud Discord Integration' })
                .setTimestamp()
              ]
            });
          } else {
            await interaction.editReply({
              embeds: [new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('❌ Webhook Test Failed')
                .setDescription('Failed to send test message to Discord.')
                .addFields(
                  {
                    name: 'Error Details',
                    value: `**Status:** HTTP ${response.status}\n**Response:** ${response.statusText}\n**URL:** ||${pairing.webhook_url}||`,
                    inline: false
                  }
                )
                .setFooter({ text: 'OwlCloud Discord Integration' })
                .setTimestamp()
              ]
            });
          }
        } catch (error) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle('❌ Webhook Test Error')
              .setDescription('An error occurred while testing the webhook.')
              .addFields(
                {
                  name: 'Error Details',
                  value: `**Error:** ${error.message}\n**URL:** ||${pairing.webhook_url}||`,
                  inline: false
                }
              )
              .setFooter({ text: 'OwlCloud Discord Integration' })
              .setTimestamp()
            ]
          });
        }
      }

    } catch (error) {
      console.error('Webhook command error:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('❌ Error')
          .setDescription('Something went wrong while checking webhook status.')
        ]
      });
    }
  }
};

// Helper functions to extract information from webhook URL
function extractServerIdFromWebhook(webhookUrl) {
  try {
    const url = new URL(webhookUrl);
    const pathParts = url.pathname.split('/');
    return pathParts[2] || null; // Extract server ID from path
  } catch (error) {
    return null;
  }
}

function extractChannelIdFromWebhook(webhookUrl) {
  try {
    const url = new URL(webhookUrl);
    const pathParts = url.pathname.split('/');
    return pathParts[3] || null; // Extract channel ID from path
  } catch (error) {
    return null;
  }
}
