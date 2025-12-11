require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// API URL - met fallback
const API_URL = 'https://bredathenetherlands.netlify.app/.netlify/functions/training-manager';

// KANAAL ID VOOR TRAININGEN
const TRAINING_CHANNEL_ID = '1439631013964677222';

// Fallback data voor als API offline is
const FALLBACK_TRAININGEN = [];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Status mapping voor vertaling
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
    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function isValidDate(dateStr) {
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(dateStr)) return false;
  
  try {
    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
  } catch {
    return false;
  }
}

function isValidTime(timeStr) {
  const regex = /^\d{2}:\d{2}$/;
  if (!regex.test(timeStr)) return false;
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

// API Helper functies
async function apiRequest(method = 'GET', data = null) {
  const config = {
    method,
    url: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000
  };
  
  if (data) {
    if (method === 'DELETE') {
      config.data = data;
    } else {
      config.data = data;
    }
  }
  
  try {
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`❌ API ${method} Error:`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    return { 
      success: false, 
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    };
  }
}

// Bot is klaar
client.once(Events.ClientReady, async () => {
  console.log(`=========================================`);
  console.log(`✅ Breda Roleplay Bot v2.1 is online!`);
  console.log(`🤖 Bot: ${client.user.tag}`);
  console.log(`🔗 API: ${API_URL}`);
  console.log(`📢 Training Channel: ${TRAINING_CHANNEL_ID}`);
  console.log(`=========================================`);
  
  // Test API verbinding
  console.log('🔍 Testing API connection...');
  const apiTest = await apiRequest('GET');
  if (apiTest.success) {
    console.log(`✅ API Connected: ${apiTest.data.length} trainingen gevonden`);
  } else {
    console.log(`⚠️  API Warning: ${apiTest.error}`);
    console.log(`📋 Using fallback mode for /trainingen command`);
  }
  
  // Register slash commands
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    const commands = [
      new SlashCommandBuilder()
        .setName('training')
        .setDescription('Voeg een nieuwe training toe')
        .addStringOption(option =>
          option.setName('datum')
            .setDescription('Datum in formaat DD/MM/YYYY')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('tijd')
            .setDescription('Tijd in formaat HH:MM (24-uurs)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('trainer')
            .setDescription('Naam van de trainer')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('onderwerp')
            .setDescription('Onderwerp van de training')
            .setRequired(true)),
      
      new SlashCommandBuilder()
        .setName('verwijdertraining')
        .setDescription('Verwijder een training')
        .addIntegerOption(option =>
          option.setName('id')
            .setDescription('ID van de training om te verwijderen')
            .setRequired(true)),
      
      new SlashCommandBuilder()
        .setName('veranderstatustraining')
        .setDescription('Verander de status van een training')
        .addIntegerOption(option =>
          option.setName('id')
            .setDescription('ID van de training')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('status')
            .setDescription('Nieuwe status')
            .setRequired(true)
            .addChoices(
              { name: 'Nog niet gestart', value: 'not_started' },
              { name: 'Bezig', value: 'in_progress' },
              { name: 'Afgelopen', value: 'completed' },
              { name: 'Geannuleerd', value: 'cancelled' },
              { name: 'Uitgesteld', value: 'delayed' }
            )),
      
      new SlashCommandBuilder()
        .setName('trainingen')
        .setDescription('Toon alle geplande trainingen'),
      
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Toon alle beschikbare commands'),
      
      new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Toon bot informatie en status')
    ].map(command => command.toJSON());
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    
    console.log(`✅ Slash commands geregistreerd: ${commands.length} commands`);
  } catch (error) {
    console.error('❌ Fout bij registreren commands:', error);
  }
});

// Slash command handler
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options, user, guild } = interaction;

  // ==================== /training COMMAND ====================
  if (commandName === 'training') {
    await interaction.deferReply();

    const datum = options.getString('datum');
    const tijd = options.getString('tijd');
    const trainer = options.getString('trainer');
    const onderwerp = options.getString('onderwerp');

    // Validatie
    if (!isValidDate(datum)) {
      return interaction.editReply({
        content: '❌ **Ongeldige datum!** Gebruik formaat: DD/MM/YYYY\nBijvoorbeeld: 15/12/2025',
        ephemeral: true
      });
    }

    if (!isValidTime(tijd)) {
      return interaction.editReply({
        content: '❌ **Ongeldige tijd!** Gebruik formaat: HH:MM (24-uurs)\nBijvoorbeeld: 20:00',
        ephemeral: true
      });
    }

    const trainingData = {
      datum: datum,
      tijd: tijd,
      trainer: trainer,
      onderwerp: onderwerp,
      toegevoegd_door: user.username,
      van_discord: true
    };

    console.log(`📤 Training toevoegen:`, trainingData);

    const result = await apiRequest('POST', trainingData);

    if (!result.success) {
      // API Error - gebruik fallback
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('⚠️ Training Opgeslagen (Lokaal)')
        .setDescription('API is tijdelijk niet bereikbaar. Training wordt lokaal opgeslagen.')
        .addFields(
          { name: '📝 Onderwerp', value: onderwerp, inline: false },
          { name: '📅 Datum', value: formatDate(datum), inline: true },
          { name: '⏰ Tijd', value: tijd, inline: true },
          { name: '👨‍🏫 Trainer', value: trainer, inline: true },
          { name: '📊 Status', value: '⏳ Nog niet gestart', inline: true }
        )
        .setFooter({ 
          text: `Toegevoegd door ${user.username} (Lokaal)`, 
          iconURL: user.displayAvatarURL({ size: 64 }) 
        })
        .setTimestamp();
      
      // Voeg toe aan fallback array
      FALLBACK_TRAININGEN.push({
        ...trainingData,
        id: FALLBACK_TRAININGEN.length + 1,
        status: 'not_started'
      });
      
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    // Success - API werkte
    const training = result.data.training;
    const status = STATUS_MAP[training.status || 'not_started'];

    const successEmbed = new EmbedBuilder()
      .setColor(status.color)
      .setTitle(`${status.emoji} Training Toegevoegd!`)
      .setDescription('De training is succesvol toegevoegd aan het systeem.')
      .addFields(
        { name: '📝 Onderwerp', value: onderwerp, inline: false },
        { name: '📅 Datum', value: formatDate(datum), inline: true },
        { name: '⏰ Tijd', value: tijd, inline: true },
        { name: '👨‍🏫 Trainer', value: trainer, inline: true },
        { name: '📊 Status', value: status.name, inline: true },
        { name: '🆔 ID', value: `#${training.id}`, inline: true }
      )
      .setFooter({ 
        text: `Toegevoegd door ${user.username}`, 
        iconURL: user.displayAvatarURL({ size: 64 }) 
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

    // Stuur naar training channel (optioneel)
    try {
      const trainingChannel = await guild.channels.fetch(TRAINING_CHANNEL_ID);
      if (trainingChannel?.isTextBased()) {
        const announcementEmbed = new EmbedBuilder()
          .setColor(status.color)
          .setTitle(`${status.emoji} NIEUWE TRAINING GEPLAND!`)
          .setDescription(`Er is een nieuwe training toegevoegd door <@${user.id}>`)
          .addFields(
            { name: '🎓 Onderwerp', value: onderwerp, inline: false },
            { name: '📅 Datum', value: formatDate(datum), inline: true },
            { name: '⏰ Tijd', value: `${tijd} uur`, inline: true },
            { name: '👨‍🏫 Trainer', value: trainer, inline: true }
          )
          .setFooter({ 
            text: 'Breda The Netherlands Roleplay', 
            iconURL: guild.iconURL({ size: 64 }) || client.user.displayAvatarURL({ size: 64 })
          })
          .setTimestamp();
        
        await trainingChannel.send({ 
          content: `@here **NIEUWE TRAINING!** ${status.emoji}`,
          embeds: [announcementEmbed] 
        });
      }
    } catch (channelError) {
      console.error('❌ Channel error:', channelError.message);
    }
  }

  // ==================== /trainingen COMMAND ====================
  if (commandName === 'trainingen') {
    await interaction.deferReply();
    
    const result = await apiRequest('GET');
    let trainingen = [];
    let usingFallback = false;
    
    if (result.success) {
      trainingen = result.data;
    } else {
      trainingen = FALLBACK_TRAININGEN;
      usingFallback = true;
    }
    
    if (!trainingen || trainingen.length === 0) {
      const noTrainingsEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('📭 Geen Trainingen')
        .setDescription('Er zijn momenteel geen trainingen gepland.')
        .addFields({
          name: '📋 Tip',
          value: 'Plan een nieuwe training met `/training`'
        })
        .setTimestamp();
      
      if (usingFallback) {
        noTrainingsEmbed.setFooter({ text: '⚠️ API niet bereikbaar - lokaal geheugen' });
      }
      
      return interaction.editReply({ embeds: [noTrainingsEmbed] });
    }
    
    // Sorteer op datum
    const gesorteerd = trainingen.sort((a, b) => {
      try {
        const [dagA, maandA, jaarA] = a.datum.split('/').map(Number);
        const [dagB, maandB, jaarB] = b.datum.split('/').map(Number);
        const datumA = new Date(jaarA, maandA - 1, dagA);
        const datumB = new Date(jaarB, maandB - 1, dagB);
        return datumA - datumB;
      } catch {
        return 0;
      }
    });
    
    const mainEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📚 Geplande Trainingen')
      .setDescription(`Er staan **${gesorteerd.length}** training(en) gepland.`)
      .setFooter({ 
        text: usingFallback ? 
          '⚠️ Breda Roleplay Bot (Lokaal Geheugen)' : 
          'Breda The Netherlands Roleplay', 
        iconURL: client.user.displayAvatarURL({ size: 64 }) 
      })
      .setTimestamp();
    
    if (usingFallback) {
      mainEmbed.addFields({
        name: '⚠️ Let op',
        value: 'API is niet bereikbaar. Trainingen worden uit lokaal geheugen geladen.',
        inline: false
      });
    }
    
    // Toon eerst 5 trainingen
    const toShow = gesorteerd.slice(0, 5);
    
    toShow.forEach((training, index) => {
      const status = STATUS_MAP[training.status || 'not_started'];
      mainEmbed.addFields({
        name: `#${training.id || index + 1} - ${training.onderwerp} ${status.emoji}`,
        value: `📅 ${formatDate(training.datum)} | ⏰ ${training.tijd}\n👨‍🏫 ${training.trainer} | 📊 ${status.name}`,
        inline: false
      });
    });
    
    if (gesorteerd.length > 5) {
      mainEmbed.addFields({
        name: '🌐 Website',
        value: `Bekijk alle ${gesorteerd.length} trainingen op:\nhttps://bredathenetherlands.netlify.app/trainingen.html`,
        inline: false
      });
    }
    
    await interaction.editReply({ embeds: [mainEmbed] });
  }

  // ==================== /verwijdertraining COMMAND ====================
  if (commandName === 'verwijdertraining') {
    await interaction.deferReply({ ephemeral: true });
    
    const trainingId = options.getInteger('id');
    
    const result = await apiRequest('DELETE', { id: trainingId });
    
    if (!result.success) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Kon training niet verwijderen')
        .setDescription(`API Error: ${result.error}`)
        .addFields({
          name: '🆔 Training ID',
          value: `#${trainingId}`,
          inline: true
        })
        .setTimestamp();
      
      return interaction.editReply({ embeds: [errorEmbed] });
    }
    
    const deletedTraining = result.data.training;
    const status = STATUS_MAP[deletedTraining.status || 'not_started'];
    
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Training Verwijderd')
      .setDescription(`Training **#${trainingId}** is succesvol verwijderd.`)
      .addFields(
        { name: '📝 Onderwerp', value: deletedTraining.onderwerp, inline: false },
        { name: '📅 Datum', value: formatDate(deletedTraining.datum), inline: true },
        { name: '⏰ Tijd', value: deletedTraining.tijd, inline: true },
        { name: '👨‍🏫 Trainer', value: deletedTraining.trainer, inline: true },
        { name: '📊 Status', value: status.name, inline: true }
      )
      .setFooter({ 
        text: `Verwijderd door ${user.username}`, 
        iconURL: user.displayAvatarURL({ size: 64 }) 
      })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }

  // ==================== /veranderstatustraining COMMAND ====================
  if (commandName === 'veranderstatustraining') {
    await interaction.deferReply();
    
    const trainingId = options.getInteger('id');
    const newStatus = options.getString('status');
    const statusInfo = STATUS_MAP[newStatus];
    
    const result = await apiRequest('PUT', {
      id: trainingId,
      status: newStatus
    });
    
    if (!result.success) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Kon status niet bijwerken')
        .setDescription(`API Error: ${result.error}`)
        .setTimestamp();
      
      return interaction.editReply({ embeds: [errorEmbed] });
    }
    
    const updatedTraining = result.data.training;
    
    const embed = new EmbedBuilder()
      .setColor(statusInfo.color)
      .setTitle(`${statusInfo.emoji} Status Bijgewerkt`)
      .setDescription(`Training **#${trainingId}** is bijgewerkt naar **${statusInfo.name}**.`)
      .addFields(
        { name: '📝 Onderwerp', value: updatedTraining.onderwerp, inline: false },
        { name: '📅 Datum', value: formatDate(updatedTraining.datum), inline: true },
        { name: '⏰ Tijd', value: updatedTraining.tijd, inline: true },
        { name: '👨‍🏫 Trainer', value: updatedTraining.trainer, inline: true },
        { name: '🔄 Status', value: `${statusInfo.emoji} ${statusInfo.name}`, inline: true }
      )
      .setFooter({ 
        text: `Bijgewerkt door ${user.username}`, 
        iconURL: user.displayAvatarURL({ size: 64 }) 
      })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }

  // ==================== /help COMMAND ====================
  if (commandName === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle('🤖 Breda Roleplay Bot v2.1')
      .setDescription('Alle beschikbare commando\'s:')
      .addFields(
        {
          name: '🎓 `/training`',
          value: 'Plan een nieuwe training\n`datum:DD/MM/YYYY tijd:HH:MM trainer:Naam onderwerp:Onderwerp`'
        },
        {
          name: '🗑️ `/verwijdertraining`',
          value: 'Verwijder een training\n`id:TrainingID`'
        },
        {
          name: '🔄 `/veranderstatustraining`',
          value: 'Verander status van training\n`id:TrainingID status:NieuweStatus`'
        },
        {
          name: '📚 `/trainingen`',
          value: 'Toon alle geplande trainingen'
        },
        {
          name: 'ℹ️ `/botinfo`',
          value: 'Toon bot informatie en status'
        },
        {
          name: '🌐 Website',
          value: 'https://bredathenetherlands.netlify.app'
        }
      )
      .setFooter({ 
        text: 'Breda The Netherlands Roleplay', 
        iconURL: client.user.displayAvatarURL({ size: 64 }) 
      })
      .setTimestamp();
    
    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  }

  // ==================== /botinfo COMMAND ====================
  if (commandName === 'botinfo') {
    const apiStatus = await apiRequest('GET');
    const apiOnline = apiStatus.success;
    
    const infoEmbed = new EmbedBuilder()
      .setColor(apiOnline ? 0x2ecc71 : 0xe74c3c)
      .setTitle('🤖 Bot Informatie')
      .addFields(
        { name: '🔄 Bot Versie', value: 'v2.1', inline: true },
        { name: '📊 API Status', value: apiOnline ? '✅ Online' : '❌ Offline', inline: true },
        { name: '👤 Gebruikersnaam', value: client.user.tag, inline: true },
        { name: '📅 Laatste restart', value: new Date().toLocaleString('nl-NL'), inline: true },
        { name: '🌐 API URL', value: API_URL, inline: false },
        { name: '📢 Training Kanaal', value: `<#${TRAINING_CHANNEL_ID}>`, inline: true },
        { name: '📈 Lokaal geheugen', value: `${FALLBACK_TRAININGEN.length} training(en)`, inline: true }
      )
      .setFooter({ 
        text: 'Breda The Netherlands Roleplay', 
        iconURL: client.user.displayAvatarURL({ size: 64 }) 
      })
      .setTimestamp();
    
    if (!apiOnline) {
      infoEmbed.addFields({
        name: '⚠️ Let op',
        value: 'API is momenteel offline. Trainingen worden lokaal opgeslagen.',
        inline: false
      });
    }
    
    await interaction.reply({ embeds: [infoEmbed], ephemeral: true });
  }
});

// Error handling
client.on(Events.Error, error => {
  console.error(`❌ Discord.js error:`, error);
});

// Start bot
console.log(`🚀 Bot v2.1 opstarten...`);
client.login(process.env.DISCORD_TOKEN);
