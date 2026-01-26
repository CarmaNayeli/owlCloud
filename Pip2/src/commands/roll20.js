import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('roll20')
    .setDescription('Check Roll20 connection status for your character')
    .addStringOption(option =>
      option
        .setName('character')
        .setDescription('Character name (optional - uses your active character if not provided)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const characterName = interaction.options.getString('character');

      // Check if Supabase is available
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Configuration Error')
            .setDescription('Roll20 status check is not available. Supabase configuration is missing.')
            .addFields({
              name: 'Required Setup',
              value: '1. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables\n2. Restart the bot\n3. Try /roll20 again',
              inline: false
            })
          ]
        });
        return;
      }

      // Get the user's RollCloud pairing
      const pairingResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_user_id=eq.${interaction.user.id}&status=eq.connected&select=*`,
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
            .setDescription('Failed to check RollCloud connection status.')
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
            .setDescription('You don\'t have any RollCloud connections. Use `/rollcloud <code>` to connect your extension.')
          ]
        });
        return;
      }

      const pairing = pairings[0];
      
      // Get active character using the same logic as /character command
      let targetCharacter = null;
      
      if (characterName) {
        // Search for the requested character (same logic as /character command)
        const encodedName = encodeURIComponent(characterName);
        const characterResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${interaction.user.id}&character_name=ilike.*${encodedName}*&select=*&order=updated_at.desc&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
          }
        );

        if (characterResponse.ok) {
          const characters = await characterResponse.json();
          
          console.log(`🔍 /roll20 Character search for "${characterName}" (discord_user_id=${interaction.user.id}):`, {
            matchCount: characters.length,
            matches: characters.map(m => ({ id: m.id, name: m.character_name, discord_user_id: m.discord_user_id }))
          });
          
          if (characters.length > 0) {
            targetCharacter = {
              character_name: characters[0].character_name,
              dicecloud_character_id: characters[0].id,
              level: characters[0].level,
              race: characters[0].race,
              class: characters[0].class,
              status: characters[0].is_active ? 'active' : 'inactive'
            };
          }
        } else {
          console.error(`❌ /roll20 Character search failed: ${characterResponse.status}`);
        }
      } else {
        // Get active character (same logic as /character command)
        const activeCharacterResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${interaction.user.id}&is_active=eq.true&select=*&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
          }
        );

        if (activeCharacterResponse.ok) {
          const activeCharacters = await activeCharacterResponse.json();
          
          console.log(`🔍 /roll20 Active character search (discord_user_id=${interaction.user.id}):`, {
            matchCount: activeCharacters.length,
            matches: activeCharacters.map(m => ({ id: m.id, name: m.character_name, discord_user_id: m.discord_user_id }))
          });
          
          if (activeCharacters.length > 0) {
            targetCharacter = {
              character_name: activeCharacters[0].character_name,
              dicecloud_character_id: activeCharacters[0].id,
              level: activeCharacters[0].level,
              race: activeCharacters[0].race,
              class: activeCharacters[0].class,
              status: 'active'
            };
          }
        } else {
          console.error(`❌ /roll20 Active character search failed: ${activeCharacterResponse.status}`);
        }

        // If no active character, get most recently updated
        if (!targetCharacter) {
          const recentCharacterResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${interaction.user.id}&select=*&order=updated_at.desc&limit=1`,
            {
              headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
              }
            }
          );

          if (recentCharacterResponse.ok) {
            const recentCharacters = await recentCharacterResponse.json();
            
            console.log(`🔍 /roll20 Recent character search (discord_user_id=${interaction.user.id}):`, {
              matchCount: recentCharacters.length,
              matches: recentCharacters.map(m => ({ id: m.id, name: m.character_name, discord_user_id: m.discord_user_id }))
            });
            
            if (recentCharacters.length > 0) {
              targetCharacter = {
                character_name: recentCharacters[0].character_name,
                dicecloud_character_id: recentCharacters[0].id,
                level: recentCharacters[0].level,
                race: recentCharacters[0].race,
                class: recentCharacters[0].class,
                status: recentCharacters[0].is_active ? 'active' : 'inactive'
              };
            }
          } else {
            console.error(`❌ /roll20 Recent character search failed: ${recentCharacterResponse.status}`);
          }
        }
      }

      if (!targetCharacter) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Character Not Found')
            .setDescription(
              `Could not find character "${characterName || 'active character'}".\n\n` +
              '**To check Roll20 status:**\n' +
              '1. Make sure you have an active character in Roll20\n' +
              '2. Use the RollCloud extension to select the character\n' +
              '3. Try `/roll20` again or specify a character name'
            )
          ]
        });
        return;
      }

      // Check Roll20 connection status
      const roll20Status = targetCharacter.status === 'active';
      
      // Create status embed
      const embed = new EmbedBuilder()
        .setColor(roll20Status ? 0x00FF00 : 0xFFA500) // Green for active, orange for inactive
        .setTitle(roll20Status ? '✅ Roll20 Connected' : '⚠️ Roll20 Not Connected')
        .setDescription(`**Character:** ${targetCharacter.character_name}\n**Status:** ${roll20Status ? 'Active in Roll20' : 'Not active in Roll20'}`)
        .addFields(
          { 
            name: 'Character Details', 
            value: `**Level ${targetCharacter.level || '?'} ${targetCharacter.race || '?'} ${targetCharacter.class || '?'}**\nID: ${targetCharacter.dicecloud_character_id}`, 
            inline: false 
          },
          { 
            name: 'Discord Server', 
            value: `${pairing.server_name || 'Unknown'}\nChannel: <#${pairing.channel_name || 'unknown'}>`, 
            inline: true 
          },
          { 
            name: 'Connection Status', 
            value: roll20Status ? '✅ Connected' : '⚠️ Disconnected', 
            inline: true 
          }
        )
        .setFooter({ text: 'Roll20 Integration Status' })
        .setTimestamp();

      if (roll20Status) {
        embed.addFields({
          name: '🎲 Roll Features Available',
          value: '• `/roll` commands will send to Roll20\n• Character sheets available via `/sheet`\n• Turn notifications enabled\n• Action economy tracking',
          inline: false
        });
      } else {
        embed.addFields({
          name: '🔧 To Connect Roll20:',
          value: '1. Open Roll20 in your browser\n2. Load your campaign\n3. Select the character: ' + targetCharacter.character_name + '\n4. Use the RollCloud extension to sync\n5. Try `/roll20` again to verify connection',
          inline: false
        });
      }

      // Add troubleshooting section if not connected
      if (!roll20Status) {
        embed.addFields({
          name: '🔍 Troubleshooting',
          value: '• Make sure Roll20 tab is open\n• Check that character is selected\n• Verify RollCloud extension is installed\n• Ensure Discord integration is set up\n• Try refreshing the Roll20 page',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Roll20 command error:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('❌ Error')
          .setDescription('Something went wrong while checking Roll20 connection status.')
        ]
      });
    }
  }
};
