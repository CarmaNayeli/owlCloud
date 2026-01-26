import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Supabase config - set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('testpairing')
    .setDescription('Test Supabase pairing database operations')
    .addStringOption(option =>
      option
        .setName('code')
        .setDescription('6-character pairing code to test')
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(6)
    )
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'create', value: 'create' },
          { name: 'lookup', value: 'lookup' },
          { name: 'delete', value: 'delete' }
        )
    ),

  async execute(interaction) {
    const code = interaction.options.getString('code').toUpperCase();
    const action = interaction.options.getString('action');

    await interaction.deferReply({ flags: 64 }); // ephemeral

    try {
      console.log(`Testing ${action} for code: ${code}`);

      if (action === 'create') {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/rollcloud_pairings`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              pairing_code: code,
              status: 'pending',
              created_at: new Date().toISOString()
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create: ${errorText}`);
        }

        const data = await response.json();
        
        await interaction.editReply({
          embeds: [new EmbedBuilder()
          .setColor(0x4ECDC4)
          .setTitle('✅ Pairing Record Created')
          .setDescription(`Code **${code}** has been stored in the database.`)
          .addFields(
            { name: 'Status', value: 'pending', inline: true },
            { name: 'Created', value: new Date().toISOString(), inline: true }
          )
        ]});

      } else if (action === 'lookup') {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/rollcloud_pairings?pairing_code=eq.${code}&select=*`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to lookup: ${errorText}`);
        }

        const data = await response.json();
        
        if (data.length === 0) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Code Not Found')
            .setDescription(`Code **${code}** was not found in the database.`)
          ]});
        } else {
          const record = data[0];
          await interaction.editReply({
            embeds: [new EmbedBuilder()
            .setColor(0x4ECDC4)
            .setTitle('✅ Code Found')
            .setDescription(`Code **${code}** found in the database.`)
            .addFields(
              { name: 'Status', value: record.status || 'unknown', inline: true },
              { name: 'Created', value: record.created_at || 'unknown', inline: true },
              { name: 'Connected', value: record.connected_at || 'not yet', inline: true }
            )
          ]});
        }

      } else if (action === 'delete') {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/rollcloud_pairings?pairing_code=eq.${code}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to delete: ${errorText}`);
        }

        await interaction.editReply({
          embeds: [new EmbedBuilder()
          .setColor(0x4ECDC4)
          .setTitle('✅ Pairing Record Deleted')
          .setDescription(`Code **${code}** has been removed from the database.`)
        ]});
      }

    } catch (error) {
      console.error('Test pairing error:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('❌ Test Failed')
        .setDescription(`Error: ${error.message}`)
      ]});
    }
  }
};
