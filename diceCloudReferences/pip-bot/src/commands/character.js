import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('Check character status and Discord integration')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Action to perform')
        .setRequired(false)
        .addChoices(
          { name: 'Status', value: 'status' },
          { name: 'List', value: 'list' }
        )
    ),

  async execute(interaction) {
    const action = interaction.options.getString('action') || 'status';

    await interaction.deferReply();

    try {
      if (action === 'status') {
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
              .setTitle('❌ Error')
              .setDescription('Failed to check OwlCloud connection.')
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
        
        // Get stored character options
        const optionsResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/owlcloud_character_options?pairing_id=eq.${pairing.id}&status=eq.active&select=*&order=updated_at.desc&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
          }
        );

        let activeCharacter = null;
        if (optionsResponse.ok) {
          const options = await optionsResponse.json();
          if (options.length > 0) {
            activeCharacter = options[0];
          }
        }

        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('📊 OwlCloud Character Status')
          .setDescription(`**Discord User:** ${interaction.user.displayName}\n**Server:** ${pairing.server_name || 'Unknown'}\n**Channel:** <#${pairing.channel_name || 'unknown'}>`)
          .addFields(
            { 
              name: 'Connection Status', 
              value: `✅ Connected`, 
              inline: true 
            },
            { 
              name: 'Paired At', 
              value: new Date(pairing.connected_at).toLocaleDateString(), 
              inline: true 
            },
            {
              name: 'Active Character',
              value: activeCharacter ? `**${activeCharacter.character_name}** (${activeCharacter.dicecloud_character_id})` : '❌ No active character',
              inline: false
            }
          )
          .setFooter({ text: 'OwlCloud Integration Status' })
          .setTimestamp();

        if (activeCharacter) {
          embed.addFields({
            name: 'Character Details',
            value: `**Level ${activeCharacter.level} ${activeCharacter.race} ${activeCharacter.class}**\nHP: ${activeCharacter.hit_points?.current || 'Unknown'}/${activeCharacter.hit_points?.max || 'Unknown'}`,
            inline: false
          });
        }

        await interaction.editReply({ embeds: [embed] });

      } else if (action === 'list') {
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
              .setTitle('❌ Error')
              .setDescription('Failed to check OwlCloud connection.')
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
        
        // Get all character options for this pairing
        const optionsResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/owlcloud_character_options?pairing_id=eq.${pairing.id}&select=*&order=updated_at.desc`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
          }
        );

        let characters = [];
        if (optionsResponse.ok) {
          characters = await optionsResponse.json();
        }

        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('📋 Your Characters')
          .setDescription(`**Discord User:** ${interaction.user.displayName}\n**Server:** ${pairing.server_name || 'Unknown'}\n**Total Characters:** ${characters.length}`)
          .setFooter({ text: 'OwlCloud Character List' })
          .setTimestamp();

        if (characters.length === 0) {
          embed.setDescription(`**Discord User:** ${interaction.user.displayName}\n**Server:** ${pairing.server_name || 'Unknown'}\n**Total Characters:** 0\n\nNo characters found. Use the character sheet to import characters from DiceCloud.`);
        } else {
          // Show up to 10 characters
          const displayCharacters = characters.slice(0, 10);
          const characterList = displayCharacters.map((char, index) => {
            const status = char.status === 'active' ? '✅' : '⚪';
            return `${status} **${char.character_name}** (${char.dicecloud_character_id}) - Level ${char.level} ${char.race} ${char.class}`;
          }).join('\n');

          embed.addFields({
            name: 'Available Characters',
            value: characterList,
            inline: false
          });
        }

        await interaction.editReply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Character command error:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('❌ Error')
          .setDescription('Something went wrong while checking character status.')
        ]
      });
    }
  }
};
