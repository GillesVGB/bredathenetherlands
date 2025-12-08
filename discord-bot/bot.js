require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// SUPABASE FUNCTIES (moeten bestaan op Netlify)
const API_BASE = 'https://bredathenetherlands.netlify.app/.netlify/functions';
const ADD_TRAINING_URL = `${API_BASE}/add-training`;
const UPDATE_STATUS_URL = `${API_BASE}/update-training`;  // Moet gemaakt worden
const DELETE_TRAINING_URL = `${API_BASE}/delete-training`; // Moet gemaakt worden

// KANAAL ID
const TRAINING_CHANNEL_ID = '1439631013964677222';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Status mapping - ZELFDE ALS WEBSITE
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

// Bot startup
client.once(Events.ClientReady, async () => {
  console.log(`=========================================`);
  console.log(`✅ Breda Roleplay Bot - SUPABASE + STATUS`);
  console.log(`🤖 ${client.user.tag}`);
  console.log(`🔗 Add Training: ${ADD_TRAINING_URL}`);
  console.log(`⚙️ Status Opties: ⏳ 🔄 ✅ ❌ 📅`);
  console.log(`📢 Channel: ${TRAINING_CHANNEL_ID}`);
  console.log(`=========================================`);
  
  const commands = [
    // TRAINING TOEVOEGEN
    new SlashCommandBuilder()
      .setName('training')
      .setDescription('Voeg training toe (Supabase)')
      .addStringOption(o => o.setName('datum').setDescription('DD/MM/YYYY').setRequired(true))
      .addStringOption(o => o.setName('tijd').setDescription('HH:MM').setRequired(true))
      .addStringOption(o => o.setName('trainer').setDescription('Trainer naam').setRequired(true))
      .addStringOption(o => o.setName('onderwerp').setDescription('Onderwerp').setRequired(true)),
    
    // STATUS WIJZIGEN
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
          { name: '📅 Uitgesteld', value: 'delayed' }
        )),
    
    // TRAININGEN BEKIJKEN
    new SlashCommandBuilder()
      .setName('trainingen')
      .setDescription('Bekijk trainingen op website'),
    
    // TRAINING VERWIJDEREN
    new SlashCommandBuilder()
      .setName('verwijder')
      .setDescription('Verwijder training')
      .addIntegerOption(o => o.setName('id').setDescription('Training ID').setRequired(true)),
    
    // HELP
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Toon help menu'),
    
    // BOT INFO
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
        content: '❌ **Ongeldige datum/tijd!**\nDatum: DD/MM/YYYY\nTijd: HH:MM\nVoorbeeld: `/training datum:20/12/2025 tijd:19:00 trainer:John onderwerp:Politie Training`',
        ephemeral: true 
      });
    }
    
    const trainingData = {
      datum: datum,
      tijd: tijd,
      trainer: trainer,
      onderwerp: onderwerp,
      status: 'not_started', // STANDARD STATUS
      toegevoegd_door: user.username,
      discord_user_id: user.id,
      van_discord: true,
      timestamp: new Date().toISOString()
    };
    
    console.log(`📤 Training naar Supabase:`, trainingData);
    
    try {
      // STUUR NAAR SUPABASE
      const response = await axios.post(ADD_TRAINING_URL, trainingData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      console.log(`✅ Supabase response:`, response.data);
      
      const statusInfo = STATUS_MAP.not_started;
      
      const embed = new EmbedBuilder()
        .setColor(statusInfo.color)
        .setTitle(`${statusInfo.emoji} Training Toegevoegd!`)
        .setDescription('**Training staat op website met status: ' + statusInfo.name + '**')
        .addFields(
          { name: '📝 Onderwerp', value: onderwerp, inline: false },
          { name: '📅 Datum', value: formatDate(datum), inline: true },
          { name: '⏰ Tijd', value: `${tijd} uur`, inline: true },
          { name: '👨‍🏫 Trainer', value: trainer, inline: true },
          { name: '📊 Status', value: `${statusInfo.emoji} ${statusInfo.name}`, inline: true },
          { name: '💾 Database', value: 'Supabase ✅', inline: true }
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
              { name: '📅 Datum', value: formatDate(datum), inline: true },
              { name: '⏰ Tijd', value: `${tijd} uur`, inline: true },
              { name: '👨‍🏫 Trainer', value: trainer, inline: true },
              { name: '📊 Status', value: statusInfo.name, inline: true }
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
      console.error('❌ Supabase error:', error.message);
      
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Kon training niet toevoegen')
        .setDescription(`**API Error:** ${error.response?.status || error.code}`)
        .addFields(
          { name: '🔄 Probeer dit:', value: '1. Ga naar de website\n2. Voeg handmatig toe\n3. Check of API online is', inline: false },
          { name: '🌐 Website', value: 'https://bredathenetherlands.netlify.app/trainingen.html', inline: false }
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
      updated_by: user.username,
      updated_at: new Date().toISOString()
    };
    
    console.log(`🔄 Status update:`, updateData);
    
    // PROBEER UPDATE FUNCTIE
    try {
      const response = await axios.put(UPDATE_STATUS_URL, updateData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      const embed = new EmbedBuilder()
        .setColor(statusInfo.color)
        .setTitle(`${statusInfo.emoji} Status Bijgewerkt!`)
        .setDescription(`Training **#${trainingId}** is bijgewerkt naar **${statusInfo.name}**.`)
        .addFields(
          { name: '🆔 Training ID', value: `#${trainingId}`, inline: true },
          { name: '🔄 Nieuwe Status', value: `${statusInfo.emoji} ${statusInfo.name}`, inline: true },
          { name: '👤 Bijgewerkt door', value: user.username, inline: true },
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
      
      // FALLBACK: Laat zien wat er gebeurd zou zijn
      const embed = new EmbedBuilder()
        .setColor(statusInfo.color)
        .setTitle(`${statusInfo.emoji} Status Update (Handmatig nodig)`)
        .setDescription(`**UPDATE FUNCTIE BESTAAT NOG NIET**\n\nJe moet handmatig de status aanpassen op de website.`)
        .addFields(
          { name: '🆔 Training ID', value: `#${trainingId}`, inline: true },
          { name: '🔄 Gewenste Status', value: `${statusInfo.emoji} ${statusInfo.name}`, inline: true },
          { name: '👤 Aangepast door', value: user.username, inline: true },
          { name: '🌐 Handmatig aanpassen', value: 'Ga naar de website en verander de status daar.', inline: false }
        )
        .setFooter({ text: 'Update functie moet nog gemaakt worden op Netlify' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    }
  }
  
  // ========== /trainingen ==========
  else if (commandName === 'trainingen') {
    await interaction.deferReply();
    
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('📚 Trainingen Bekijken')
      .setDescription('**Bekijk alle trainingen op de website:**')
      .addFields(
        { name: '🌐 Website Link', value: 'https://bredathenetherlands.netlify.app/trainingen.html', inline: false },
        { name: '📊 Status Legenda', value: '⏳ Niet gestart | 🔄 Bezig | ✅ Afgelopen | ❌ Geannuleerd | 📅 Uitgesteld', inline: false },
        { name: '💡 Tip', value: 'Gebruik `/training` om een training toe te voegen', inline: false }
      )
      .setFooter({ text: 'Breda The Netherlands Roleplay' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  }
  
  // ========== /verwijder ==========
  else if (commandName === 'verwijder') {
    await interaction.deferReply({ ephemeral: true });
    
    const trainingId = options.getInteger('id');
    
    try {
      const response = await axios.delete(DELETE_TRAINING_URL, {
        data: { id: trainingId },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Training Verwijderd')
        .setDescription(`Training **#${trainingId}** is verwijderd uit de database.`)
        .addFields(
          { name: '🆔 Training ID', value: `#${trainingId}`, inline: true },
          { name: '👤 Verwijderd door', value: user.username, inline: true },
          { name: '🌐 Website', value: 'Training is nu van de website verwijderd', inline: false }
        )
        .setFooter({ text: `Verwijderd door ${user.username}` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.log('❌ Delete error:', error.message);
      
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Kon training niet verwijderen')
        .setDescription(`**DELETE FUNCTIE BESTAAT NOG NIET**\n\nJe moet handmatig verwijderen op de website.`)
        .addFields(
          { name: '🆔 Training ID', value: `#${trainingId}`, inline: true },
          { name: '👤 Wil verwijderen', value: user.username, inline: true },
          { name: '🌐 Handmatig verwijderen', value: 'Ga naar de website en verwijder de training daar.', inline: false }
        )
        .setFooter({ text: 'Delete functie moet nog gemaakt worden op Netlify' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    }
  }
  
  // ========== /help ==========
  else if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle('🤖 Breda Roleplay Bot - Help')
      .setDescription('**Training Management met Supabase Database**')
      .addFields(
        { 
          name: '🎓 `/training`', 
          value: 'Voeg training toe\n`datum:DD/MM/YYYY tijd:HH:MM trainer:Naam onderwerp:Onderwerp`\n*Komt direct op website!*',
          inline: false 
        },
        { 
          name: '🔄 `/status`', 
          value: 'Verander status van training\n`id:TrainingID nieuw:NieuweStatus`\n**Status opties:**\n⏳ Niet gestart\n🔄 Bezig\n✅ Afgelopen\n❌ Geannuleerd\n📅 Uitgesteld',
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
          value: 'https://bredathenetherlands.netlify.app/trainingen.html',
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
        { name: '📊 Versie', value: 'Supabase + Status', inline: true },
        { name: '🤖 Botnaam', value: client.user.tag, inline: true },
        { name: '💾 Database', value: 'Supabase', inline: true },
        { name: '🔗 Add Training', value: 'Werkt ✅', inline: true },
        { name: '🔄 Status Update', value: 'Functie nodig ⚠️', inline: true },
        { name: '🗑️ Delete', value: 'Functie nodig ⚠️', inline: true },
        { name: '📢 Kanaal', value: `<#${TRAINING_CHANNEL_ID}>`, inline: false },
        { name: '⚙️ Status Opties', value: '⏳ 🔄 ✅ ❌ 📅', inline: false }
      )
      .setFooter({ text: 'Breda The Netherlands Roleplay' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

console.log('🚀 Starting bot met Supabase + Status support...');
client.login(process.env.DISCORD_TOKEN);
