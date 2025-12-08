require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// API URL - GEBRUIK DE JUISTE!
const TRAINING_API = 'https://bredathenetherlands.netlify.app/.netlify/functions/training-manager';

// KANAAL ID - PAS DIT AAN!
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
  'delayed': { name: 'Uitgesteld', color: 0x9b59b6, emoji: '📅' },
  'upcoming': { name: 'Gepland', color: 0x1abc9c, emoji: '📝' }
};

// Helper functies
function isValidDate(dateStr) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr);
}

function isValidTime(timeStr) {
  return /^\d{2}:\d{2}$/.test(timeStr);
}

// Bot startup
client.once(Events.ClientReady, async () => {
  console.log(`=========================================`);
  console.log(`✅ Breda Roleplay Bot - WEBSITE INTEGRATIE`);
  console.log(`🤖 ${client.user.tag}`);
  console.log(`🔗 API: ${TRAINING_API}`);
  console.log(`📢 Channel: ${TRAINING_CHANNEL_ID}`);
  console.log(`=========================================`);
  
  const commands = [
    new SlashCommandBuilder()
      .setName('training')
      .setDescription('Voeg training toe (komt op website)')
      .addStringOption(o => o.setName('datum').setDescription('DD/MM/YYYY').setRequired(true))
      .addStringOption(o => o.setName('tijd').setDescription('HH:MM').setRequired(true))
      .addStringOption(o => o.setName('trainer').setDescription('Trainer naam').setRequired(true))
      .addStringOption(o => o.setName('onderwerp').setDescription('Onderwerp').setRequired(true)),
    
    new SlashCommandBuilder()
      .setName('status')
      .setDescription('Verander status van training')
      .addIntegerOption(o => o.setName('id').setDescription('Training ID').setRequired(true))
      .addStringOption(o => o.setName('nieuw')
        .setDescription('Nieuwe status')
        .setRequired(true)
        .addChoices(
          { name: '⏳ Niet gestart', value: 'not_started' },
          { name: '🔄 Bezig', value: 'in_progress' },
          { name: '✅ Afgelopen', value: 'completed' },
          { name: '❌ Geannuleerd', value: 'cancelled' },
          { name: '📅 Uitgesteld', value: 'delayed' },
          { name: '📝 Gepland', value: 'upcoming' }
        )),
    
    new SlashCommandBuilder()
      .setName('trainingen')
      .setDescription('Bekijk trainingen op website'),
    
    new SlashCommandBuilder()
      .setName('verwijder')
      .setDescription('Verwijder training')
      .addIntegerOption(o => o.setName('id').setDescription('Training ID').setRequired(true)),
    
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Toon help menu'),
    
    new SlashCommandBuilder()
      .setName('botinfo')
      .setDescription('Bot informatie')
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
        content: '❌ **Ongeldige datum/tijd!**\nDatum: DD/MM/YYYY\nTijd: HH:MM\nVoorbeeld: `/training datum:20/12/2024 tijd:19:00 trainer:John onderwerp:Politie Training`',
        ephemeral: true 
      });
    }
    
    const trainingData = {
      datum: datum,
      tijd: tijd,
      trainer: trainer,
      onderwerp: onderwerp,
      status: 'not_started',
      toegevoegd_door: user.username,
      van_discord: true
    };
    
    console.log(`📤 Training naar website:`, trainingData);
    
    try {
      const response = await axios.post(TRAINING_API, trainingData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      console.log(`✅ Website response:`, response.data);
      
      const statusInfo = STATUS_MAP.not_started;
      const training = response.data.training || trainingData;
      
      const embed = new EmbedBuilder()
        .setColor(statusInfo.color)
        .setTitle(`${statusInfo.emoji} Training Toegevoegd!`)
        .setDescription(`**Training staat op website!**\nID: #${training.id}`)
        .addFields(
          { name: '📝 Onderwerp', value: onderwerp, inline: false },
          { name: '📅 Datum', value: datum, inline: true },
          { name: '⏰ Tijd', value: `${tijd} uur`, inline: true },
          { name: '👨‍🏫 Trainer', value: trainer, inline: true },
          { name: '📊 Status', value: `${statusInfo.emoji} ${statusInfo.name}`, inline: true },
          { name: '🌐 Website', value: 'https://bredathenetherlands.netlify.app/trainingen/', inline: true }
        )
        .setFooter({ 
          text: `Toegevoegd door ${user.username}`, 
          iconURL: user.displayAvatarURL({ size: 64 }) 
        })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      
      // Stuur naar training kanaal
      try {
        const channel = await guild.channels.fetch(TRAINING_CHANNEL_ID);
        if (channel?.isTextBased()) {
          const announceEmbed = new EmbedBuilder()
            .setColor(statusInfo.color)
            .setTitle(`${statusInfo.emoji} NIEUWE TRAINING!`)
            .setDescription(`Toegevoegd door <@${user.id}>`)
            .addFields(
              { name: '🎓 Onderwerp', value: onderwerp, inline: false },
              { name: '📅 Datum', value: datum, inline: true },
              { name: '⏰ Tijd', value: `${tijd} uur`, inline: true },
              { name: '👨‍🏫 Trainer', value: trainer, inline: true }
            )
            .setFooter({ text: 'Breda The Netherlands Roleplay' })
            .setTimestamp();
          
          await channel.send({ 
            content: `@here **NIEUWE TRAINING!** ${statusInfo.emoji}`,
            embeds: [announceEmbed] 
          });
        }
      } catch (e) {
        console.log('⚠️ Kanaal error:', e.message);
      }
      
    } catch (error) {
      console.error('❌ API error:', error.message);
      
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Kon training niet toevoegen')
        .setDescription(`**API Error:** ${error.response?.status || error.code}`)
        .addFields(
          { name: '🔄 Probeer dit:', value: '1. Check de website\n2. Voeg handmatig toe\n3. Probeer het later opnieuw', inline: false },
          { name: '🌐 Website', value: 'https://bredathenetherlands.netlify.app/trainingen/', inline: false }
        )
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    }
  }
  
  // ========== /status ==========
  else if (commandName === 'status') {
    await interaction.deferReply();
    
    const trainingId = options.getInteger('id');
    const newStatus = options.getString('nieuw');
    const statusInfo = STATUS_MAP[newStatus];
    
    const updateData = {
      id: trainingId,
      status: newStatus,
      status_text: statusInfo.name
    };
    
    console.log(`🔄 Status update:`, updateData);
    
    try {
      const response = await axios.put(TRAINING_API, updateData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      const embed = new EmbedBuilder()
        .setColor(statusInfo.color)
        .setTitle(`${statusInfo.emoji} Status Bijgewerkt!`)
        .setDescription(`Training **#${trainingId}** is bijgewerkt.`)
        .addFields(
          { name: '🆔 Training ID', value: `#${trainingId}`, inline: true },
          { name: '🔄 Nieuwe Status', value: `${statusInfo.emoji} ${statusInfo.name}`, inline: true },
          { name: '👤 Door', value: user.username, inline: true },
          { name: '🌐 Website', value: 'Status staat nu op de website!', inline: false }
        )
        .setFooter({ 
          text: `Bijgewerkt door ${user.username}`, 
          iconURL: user.displayAvatarURL({ size: 64 }) 
        })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.log('❌ Status update error:', error.message);
      
      const embed = new EmbedBuilder()
        .setColor(statusInfo.color)
        .setTitle(`${statusInfo.emoji} Status Update`)
        .setDescription(`Kon status niet wijzigen via API.`)
        .addFields(
          { name: '🆔 Training ID', value: `#${trainingId}`, inline: true },
          { name: '🔄 Gewenste Status', value: `${statusInfo.emoji} ${statusInfo.name}`, inline: true },
          { name: '⚠️ Fout', value: error.message, inline: false }
        )
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    }
  }
  
  // ========== /verwijder ==========
  else if (commandName === 'verwijder') {
    await interaction.deferReply({ ephemeral: true });
    
    const trainingId = options.getInteger('id');
    
    try {
      const response = await axios.delete(TRAINING_API, {
        data: { id: trainingId },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Training Verwijderd')
        .setDescription(`Training **#${trainingId}** is verwijderd.`)
        .addFields(
          { name: '🆔 Training ID', value: `#${trainingId}`, inline: true },
          { name: '👤 Door', value: user.username, inline: true },
          { name: '🌐 Website', value: 'Training is van de website verwijderd', inline: false }
        )
        .setFooter({ text: `Verwijderd door ${user.username}` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.log('❌ Delete error:', error.message);
      
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Kon training niet verwijderen')
        .setDescription(`**API Error:** ${error.response?.data?.error || error.message}`)
        .addFields(
          { name: '🆔 Training ID', value: `#${trainingId}`, inline: true },
          { name: '⚠️ Fout', value: error.message, inline: false }
        )
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    }
  }
  
  // ========== /trainingen ==========
  else if (commandName === 'trainingen') {
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('📚 Trainingen Bekijken')
      .setDescription('**Bekijk alle trainingen op de website:**')
      .addFields(
        { name: '🌐 Website Link', value: 'https://bredathenetherlands.netlify.app/trainingen/', inline: false },
        { name: '📊 Status Legenda', value: '⏳ Niet gestart | 🔄 Bezig | ✅ Afgelopen | ❌ Geannuleerd | 📅 Uitgesteld | 📝 Gepland', inline: false },
        { name: '💡 Tip', value: 'Gebruik `/training` om een training toe te voegen', inline: false }
      )
      .setFooter({ text: 'Breda The Netherlands Roleplay' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  // ========== /help ==========
  else if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle('🤖 Breda Roleplay Bot - Help')
      .setDescription('**Training Management met Website Integratie**')
      .addFields(
        { 
          name: '🎓 `/training`', 
          value: 'Voeg training toe (komt direct op website)\n`datum:DD/MM/YYYY tijd:HH:MM trainer:Naam onderwerp:Onderwerp`',
          inline: false 
        },
        { 
          name: '🔄 `/status`', 
          value: 'Verander status van training\n`id:TrainingID nieuw:NieuweStatus`\n**Status opties:**\n⏳ Niet gestart | 🔄 Bezig | ✅ Afgelopen\n❌ Geannuleerd | 📅 Uitgesteld | 📝 Gepland',
          inline: false 
        },
        { 
          name: '🗑️ `/verwijder`', 
          value: 'Verwijder training\n`id:TrainingID`',
          inline: false 
        },
        { 
          name: '📚 `/trainingen`', 
          value: 'Bekijk trainingen op website',
          inline: false 
        },
        { 
          name: '🤖 `/botinfo`', 
          value: 'Bot informatie',
          inline: false 
        },
        { 
          name: '🌐 Website', 
          value: 'https://bredathenetherlands.netlify.app/trainingen/',
          inline: false 
        }
      )
      .setFooter({ text: 'Breda The Netherlands Roleplay' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  // ========== /botinfo ==========
  else if (commandName === 'botinfo') {
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🤖 Bot Informatie')
      .setDescription('Breda Roleplay Training Bot')
      .addFields(
        { name: '📊 Versie', value: 'Website Integratie', inline: true },
        { name: '🤖 Botnaam', value: client.user.tag, inline: true },
        { name: '💾 Database', value: 'Netlify Functions', inline: true },
        { name: '🔗 Add Training', value: 'Werkt ✅', inline: true },
        { name: '🔄 Status Update', value: 'Werkt ✅', inline: true },
        { name: '🗑️ Delete', value: 'Werkt ✅', inline: true },
        { name: '📢 Kanaal', value: `<#${TRAINING_CHANNEL_ID}>`, inline: false },
        { name: '⚙️ Status Opties', value: '⏳ 🔄 ✅ ❌ 📅 📝', inline: false }
      )
      .setFooter({ text: 'Breda The Netherlands Roleplay' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

console.log('🚀 Starting bot met Website Integratie...');
client.login(process.env.DISCORD_TOKEN);
