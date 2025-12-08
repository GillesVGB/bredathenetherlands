require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// SUPABASE NETLIFY FUNCTIES
const API_BASE = 'https://bredathenetherlands.netlify.app/.netlify/functions';
const ADD_TRAINING_URL = `${API_BASE}/add-training`;
const GET_TRAININGEN_URL = `${API_BASE}/get-trainingen`;

// Fallback als die niet werken
const TRAINING_MANAGER_URL = `${API_BASE}/training-manager`;

// KANAAL ID
const TRAINING_CHANNEL_ID = '1439631013964677222';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Status mapping
const STATUS_MAP = {
  'not_started': { name: 'Nog niet gestart', color: 0x3498db, emoji: '⏳' },
  'in_progress': { name: 'Bezig', color: 0xf39c12, emoji: '🔄' },
  'completed': { name: 'Afgelopen', color: 0x2ecc71, emoji: '✅' },
  'cancelled': { name: 'Geannuleerd', color: 0xe74c3c, emoji: '❌' },
  'delayed': { name: 'Uitgesteld', color: 0x9b59b6, emoji: '📅' }
};

// Helper functies
function formatDate(dateStr) {
  try {
    const [d, m, y] = dateStr.split('/').map(Number);
    return new Date(y, m-1, d).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

function isValidDate(dateStr) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr);
}

function isValidTime(timeStr) {
  return /^\d{2}:\d{2}$/.test(timeStr);
}

// Test welke API werkt
async function testAPIs() {
  console.log('🔍 Testing APIs...');
  
  const apis = [
    { name: 'add-training', url: ADD_TRAINING_URL },
    { name: 'get-trainingen', url: GET_TRAININGEN_URL },
    { name: 'training-manager', url: TRAINING_MANAGER_URL }
  ];
  
  for (const api of apis) {
    try {
      const response = await axios.get(api.url, { timeout: 3000 });
      console.log(`✅ ${api.name}: ${response.status} (werkt)`);
      return api;
    } catch (error) {
      console.log(`❌ ${api.name}: ${error.response?.status || error.code}`);
    }
  }
  
  return null;
}

// Bot startup
client.once(Events.ClientReady, async () => {
  console.log(`=========================================`);
  console.log(`✅ Breda Roleplay Bot - Supabase Edition`);
  console.log(`🤖 ${client.user.tag}`);
  
  const workingAPI = await testAPIs();
  if (workingAPI) {
    console.log(`🔗 Working API: ${workingAPI.name}`);
  } else {
    console.log(`⚠️  Geen API gevonden die werkt!`);
  }
  
  console.log(`📢 Channel: ${TRAINING_CHANNEL_ID}`);
  console.log(`=========================================`);
  
  const commands = [
    new SlashCommandBuilder()
      .setName('training')
      .setDescription('Voeg training toe (Supabase)')
      .addStringOption(o => o.setName('datum').setDescription('DD/MM/YYYY').setRequired(true))
      .addStringOption(o => o.setName('tijd').setDescription('HH:MM').setRequired(true))
      .addStringOption(o => o.setName('trainer').setDescription('Trainer naam').setRequired(true))
      .addStringOption(o => o.setName('onderwerp').setDescription('Onderwerp').setRequired(true)),
    
    new SlashCommandBuilder()
      .setName('trainingen')
      .setDescription('Toon alle trainingen (Supabase)'),
    
    new SlashCommandBuilder()
      .setName('testapi')
      .setDescription('Test API verbinding'),
    
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Help menu')
  ].map(c => c.toJSON());
  
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ ${commands.length} commands geregistreerd`);
  } catch (e) {
    console.error('❌ Commands error:', e);
  }
});

// Command handler
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isCommand()) return;
  
  const { commandName, options, user, guild } = interaction;
  
  // ========== /training ==========
  if (commandName === 'training') {
    await interaction.deferReply();
    
    const datum = options.getString('datum');
    const tijd = options.getString('tijd');
    const trainer = options.getString('trainer');
    const onderwerp = options.getString('onderwerp');
    
    if (!isValidDate(datum) || !isValidTime(tijd)) {
      return interaction.editReply({ 
        content: '❌ Ongeldige datum of tijd! Gebruik: DD/MM/YYYY en HH:MM',
        ephemeral: true 
      });
    }
    
    const trainingData = {
      datum: datum,
      tijd: tijd,
      trainer: trainer,
      onderwerp: onderwerp,
      toegevoegd_door: user.username,
      discord_user_id: user.id,
      discord_guild: guild.name,
      discord_guild_id: guild.id,
      timestamp: new Date().toISOString()
    };
    
    console.log(`📤 Supabase training:`, trainingData);
    
    // Probeer eerst add-training (Supabase), dan training-manager
    let apiSuccess = false;
    let usedAPI = '';
    
    try {
      // Probeer add-training (Supabase)
      const response = await axios.post(ADD_TRAINING_URL, trainingData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      apiSuccess = true;
      usedAPI = 'add-training (Supabase)';
      console.log(`✅ Supabase response:`, response.data);
      
    } catch (error) {
      console.log(`❌ add-training failed:`, error.message);
      
      // Probeer training-manager als fallback
      try {
        const response = await axios.post(TRAINING_MANAGER_URL, trainingData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });
        
        apiSuccess = true;
        usedAPI = 'training-manager (fallback)';
        console.log(`✅ training-manager response:`, response.data);
        
      } catch (error2) {
        console.log(`❌ All APIs failed:`, error2.message);
        apiSuccess = false;
        usedAPI = 'geen';
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(apiSuccess ? 0x2ecc71 : 0xe74c3c)
      .setTitle(apiSuccess ? `${STATUS_MAP.not_started.emoji} Training Toegevoegd!` : '❌ Training MISLUKT')
      .setDescription(apiSuccess ? 
        'De training is toegevoegd aan de database.' : 
        'Kon training niet toevoegen aan database.')
      .addFields(
        { name: '📝 Onderwerp', value: onderwerp, inline: false },
        { name: '📅 Datum', value: formatDate(datum), inline: true },
        { name: '⏰ Tijd', value: tijd, inline: true },
        { name: '👨‍🏫 Trainer', value: trainer, inline: true },
        { name: '💾 API', value: usedAPI, inline: true }
      )
      .setFooter({ 
        text: `Toegevoegd door ${user.username}`, 
        iconURL: user.displayAvatarURL({ size: 64 }) 
      })
      .setTimestamp();
    
    if (!apiSuccess) {
      embed.addFields({
        name: '⚠️ Probleem',
        value: 'Database heeft mogelijk problemen. Training komt mogelijk niet op website.',
        inline: false
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
    
    // Stuur naar training kanaal
    if (apiSuccess) {
      try {
        const channel = await guild.channels.fetch(TRAINING_CHANNEL_ID);
        if (channel?.isTextBased()) {
          const announceEmbed = new EmbedBuilder()
            .setColor(STATUS_MAP.not_started.color)
            .setTitle(`${STATUS_MAP.not_started.emoji} NIEUWE TRAINING!`)
            .setDescription(`Toegevoegd door <@${user.id}>`)
            .addFields(
              { name: '🎓 Onderwerp', value: onderwerp, inline: false },
              { name: '📅 Datum', value: formatDate(datum), inline: true },
              { name: '⏰ Tijd', value: `${tijd} uur`, inline: true },
              { name: '👨‍🏫 Trainer', value: trainer, inline: true }
            )
            .setFooter({ text: 'Breda The Netherlands Roleplay' })
            .setTimestamp();
          
          await channel.send({ 
            content: `@here **NIEUWE TRAINING!** ${STATUS_MAP.not_started.emoji}`,
            embeds: [announceEmbed] 
          });
        }
      } catch (e) {
        console.log('❌ Kanaal error:', e.message);
      }
    }
  }
  
  // ========== /trainingen ==========
  else if (commandName === 'trainingen') {
    await interaction.deferReply();
    
    try {
      // Probeer get-trainingen (Supabase)
      const response = await axios.get(GET_TRAININGEN_URL, { timeout: 10000 });
      const trainingen = response.data;
      
      if (!trainingen || trainingen.length === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('📭 Geen Trainingen')
            .setDescription('Geen trainingen gevonden in database.')
            .setTimestamp()
          ]
        });
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`📚 Trainingen (${trainingen.length} in Supabase)`)
        .setDescription('Trainingen uit Supabase database:')
        .setFooter({ text: 'Breda The Netherlands Roleplay' })
        .setTimestamp();
      
      trainingen.slice(0, 5).forEach((t, i) => {
        embed.addFields({
          name: `#${i+1} - ${t.onderwerp}`,
          value: `📅 ${t.datum} | ⏰ ${t.tijd}\n👨‍🏫 ${t.trainer}`,
          inline: false
        });
      });
      
      if (trainingen.length > 5) {
        embed.addFields({
          name: '🌐 Website',
          value: `Bekijk alle ${trainingen.length} trainingen op:\nhttps://bredathenetherlands.netlify.app/trainingen.html`,
          inline: false
        });
      }
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.log('❌ Get trainingen error:', error.message);
      
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('❌ Kon trainingen niet laden')
          .setDescription('Database niet bereikbaar. Probeer later opnieuw.')
          .setURL('https://bredathenetherlands.netlify.app/trainingen.html')
          .setTimestamp()
        ]
      });
    }
  }
  
  // ========== /testapi ==========
  else if (commandName === 'testapi') {
    await interaction.deferReply({ ephemeral: true });
    
    const apis = [
      { name: 'add-training (Supabase)', url: ADD_TRAINING_URL },
      { name: 'get-trainingen (Supabase)', url: GET_TRAININGEN_URL },
      { name: 'training-manager', url: TRAINING_MANAGER_URL }
    ];
    
    let results = '';
    
    for (const api of apis) {
      try {
        await axios.get(api.url, { timeout: 3000 });
        results += `✅ **${api.name}**: Werkt!\n`;
      } catch (error) {
        results += `❌ **${api.name}**: ${error.response?.status || error.code}\n`;
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🔍 API Test Resultaten')
      .setDescription(results)
      .addFields({
        name: '🌐 Website',
        value: 'https://bredathenetherlands.netlify.app/trainingen.html',
        inline: false
      })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }
  
  // ========== /help ==========
  else if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle('🤖 Breda Bot - Supabase Edition')
      .setDescription('Trainingen worden opgeslagen in Supabase database')
      .addFields(
        { name: '🎓 `/training`', value: 'Voeg training toe aan Supabase', inline: false },
        { name: '📚 `/trainingen`', value: 'Toon trainingen uit Supabase', inline: false },
        { name: '🔍 `/testapi`', value: 'Test API verbindingen', inline: false },
        { name: '🌐 Website', value: 'https://bredathenetherlands.netlify.app/trainingen.html', inline: false },
        { name: '💾 Database', value: 'Supabase (cloud PostgreSQL)', inline: false }
      )
      .setFooter({ text: 'Breda The Netherlands Roleplay' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

console.log('🚀 Starting Supabase bot...');
client.login(process.env.DISCORD_TOKEN);
