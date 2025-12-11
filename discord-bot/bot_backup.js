require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// NIEUWE API URL
const API_URL = 'https://bredathenetherlands.netlify.app/.netlify/functions/training-manager';

// KANAAL ID VOOR TRAININGEN
const TRAINING_CHANNEL_ID = '1439631013964677222';

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
  const [day, month, year] = dateStr.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function isValidDate(dateStr) {
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(dateStr)) return false;
  
  const [day, month, year] = dateStr.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
}

function isValidTime(timeStr) {
  const regex = /^\d{2}:\d{2}$/;
  if (!regex.test(timeStr)) return false;
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

// Bot is klaar
client.once(Events.ClientReady, async () => {
  console.log(`=========================================`);
  console.log(`✅ Breda Roleplay Bot v2.0 is online!`);
  console.log(`🤖 Bot: ${client.user.tag}`);
  console.log(`🔗 API: ${API_URL}`);
  console.log(`📢 Training Channel: ${TRAINING_CHANNEL_ID}`);
  console.log(`=========================================`);
  
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
        .setDescription('Toon alle beschikbare commands')
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

    try {
      console.log(`📤 Training toevoegen:`, trainingData);

      const response = await axios.post(API_URL, trainingData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      console.log(`✅ Response:`, response.data);

      const training = response.data.training;
      const status = STATUS_MAP[training.status || 'not_started'];

      // Success embed
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

      // Stuur naar training channel
      try {
        const trainingChannel = await guild.channels.fetch(TRAINING_CHANNEL_ID);
        
        if (trainingChannel && trainingChannel.isTextBased()) {
          const announcementEmbed = new EmbedBuilder()
            .setColor(status.color)
            .setTitle(`${status.emoji} NIEUWE TRAINING GEPLAND!`)
            .setDescription(`Er is een nieuwe training toegevoegd door <@${user.id}>`)
            .addFields(
              { name: '🎓 Onderwerp', value: onderwerp, inline: false },
              { name: '📅 Datum', value: formatDate(datum), inline: true },
              { name: '⏰ Tijd', value: `${tijd} uur`, inline: true },
              { name: '👨‍🏫 Trainer', value: trainer, inline: true },
              { name: '📊 Status', value: status.name, inline: true }
            )
            .setFooter({ 
              text: 'Breda The Netherlands Roleplay', 
              iconURL: guild.iconURL({ size: 64 }) || client.user.displayAvatarURL({ size: 64 })
            })
            .setTimestamp()
            .setThumbnail(user.displayAvatarURL({ size: 64 }));
          
          const mention = guild.roles.cache.find(r => r.name === 'Training') ? 
            `<@&${guild.roles.cache.find(r => r.name === 'Training').id}>` : 
            '@here';
          
          await trainingChannel.send({ 
            content: `${mention} **NIEUWE TRAINING!** ${status.emoji}`,
            embeds: [announcementEmbed] 
          });
        }
      } catch (channelError) {
        console.error('❌ Channel error:', channelError.message);
      }

    } catch (error) {
      console.error('❌ Training error:', error.message);
      
      let errorMessage = '❌ **Er ging iets mis bij het toevoegen van de training.**\n\n';
      
      if (error.response?.data?.error) {
        errorMessage += `**Fout:** ${error.response.data.error}\n`;
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage += '🔌 **API is niet bereikbaar.**\n';
      } else if (error.response?.status === 404) {
        errorMessage += '🔍 **API endpoint niet gevonden.**\n';
      } else {
        errorMessage += `💻 **Technische fout:** ${error.message}\n`;
      }
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Fout opgetreden')
        .setDescription(errorMessage)
        .setTimestamp();

      await interaction.editReply({ 
        embeds: [errorEmbed],
        ephemeral: true
      });
    }
  }

  // ==================== /verwijdertraining COMMAND ====================
  if (commandName === 'verwijdertraining') {
    await interaction.deferReply({ ephemeral: true });
    
    const trainingId = options.getInteger('id');
    
    try {
      const response = await axios.delete(API_URL, {
        data: { id: trainingId },
        headers: { 'Content-Type': 'application/json' }
      });
      
      const deletedTraining = response.data.training;
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
      
    } catch (error) {
      console.error('❌ Verwijder error:', error.message);
      
      let errorMessage = '❌ **Kon training niet verwijderen.**\n\n';
      
      if (error.response?.data?.error) {
        errorMessage += `**Fout:** ${error.response.data.error}\n`;
      } else if (error.response?.status === 404) {
        errorMessage += `**Training #${trainingId} niet gevonden.**\n`;
      } else {
        errorMessage += `**Technische fout:** ${error.message}\n`;
      }
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Verwijderen mislukt')
        .setDescription(errorMessage)
        .setTimestamp();
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  // ==================== /veranderstatustraining COMMAND ====================
  if (commandName === 'veranderstatustraining') {
    await interaction.deferReply();
    
    const trainingId = options.getInteger('id');
    const newStatus = options.getString('status');
    const statusInfo = STATUS_MAP[newStatus];
    
    try {
      const response = await axios.put(API_URL, {
        id: trainingId,
        status: newStatus
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const updatedTraining = response.data.training;
      
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
      
    } catch (error) {
      console.error('❌ Status update error:', error.message);
      
      let errorMessage = '❌ **Kon status niet bijwerken.**\n\n';
      
      if (error.response?.data?.error) {
        errorMessage += `**Fout:** ${error.response.data.error}\n`;
      } else if (error.response?.status === 404) {
        errorMessage += `**Training #${trainingId} niet gevonden.**\n`;
      } else {
        errorMessage += `**Technische fout:** ${error.message}\n`;
      }
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Update mislukt')
        .setDescription(errorMessage)
        .setTimestamp();
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  // ==================== /trainingen COMMAND ====================
  if (commandName === 'trainingen') {
    await interaction.deferReply();
    
    try {
      const response = await axios.get(API_URL, { timeout: 10000 });
      const trainingen = response.data;
      
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
          text: 'Breda The Netherlands Roleplay', 
          iconURL: client.user.displayAvatarURL({ size: 64 }) 
        })
        .setTimestamp();
      
      // Toon eerst 5 trainingen
      const toShow = gesorteerd.slice(0, 5);
      
      toShow.forEach((training, index) => {
        const status = STATUS_MAP[training.status || 'not_started'];
        mainEmbed.addFields({
          name: `#${index + 1} - ${training.onderwerp} ${status.emoji}`,
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
      
    } catch (error) {
      console.error('❌ Trainingen ophalen error:', error.message);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Kon trainingen niet laden')
        .setDescription('Probeer het later opnieuw of bekijk de website.')
        .setURL('https://bredathenetherlands.netlify.app/trainingen.html')
        .setTimestamp();
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  // ==================== /help COMMAND ====================
  if (commandName === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle('🤖 Breda Roleplay Bot v2.0')
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
          name: '🌐 Website',
          value: 'https://bredathenetherlands.netlify.app'
        },
        {
          name: '📊 Status Opties',
          value: '⏳ Nog niet gestart\n🔄 Bezig\n✅ Afgelopen\n❌ Geannuleerd\n📅 Uitgesteld'
        }
      )
      .setFooter({ 
        text: 'Breda The Netherlands Roleplay', 
        iconURL: client.user.displayAvatarURL({ size: 64 }) 
      })
      .setTimestamp();
    
    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  }
});

// Error handling
client.on(Events.Error, error => {
  console.error(`❌ Discord.js error:`, error.message);
});

// Start bot
console.log(`🚀 Bot v2.0 opstarten...`);
client.login(process.env.DISCORD_TOKEN);
