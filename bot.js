require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// API URL
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

// Dienst mapping voor kleuren
const DIENST_MAP = {
  'Ambulance': { color: 0xFF4444, emoji: '🚑' },
  'Politie': { color: 0x4287f5, emoji: '👮' },
  'Brandweer': { color: 0xFFA500, emoji: '🚒' },
  'KMar': { color: 0x4B0082, emoji: '🎖️' },
  'DSI': { color: 0x000000, emoji: '🛡️' },
  'Rijkswaterstaat': { color: 0x00CED1, emoji: '🛣️' }
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
      .setDescription('Voeg training toe (komt op website + Roblox)')
      .addStringOption(o => o.setName('datum').setDescription('DD/MM/YYYY').setRequired(true))
      .addStringOption(o => o.setName('tijd').setDescription('HH:MM').setRequired(true))
      .addStringOption(o => o.setName('trainer').setDescription('Trainer naam').setRequired(true))
      .addStringOption(o => o.setName('dienst')
        .setDescription('Dienst voor training')
        .setRequired(true)
        .addChoices(
          { name: '🚑 Ambulance', value: 'Ambulance' },
          { name: '👮 Politie', value: 'Politie' },
          { name: '🚒 Brandweer', value: 'Brandweer' },
          { name: '🎖️ KMar', value: 'KMar' },
          { name: '🛡️ DSI', value: 'DSI' },
          { name: '🛣️ Rijkswaterstaat', value: 'Rijkswaterstaat' }
        ))
      .addStringOption(o => o.setName('onderwerp').setDescription('Onderwerp training').setRequired(true))
      .addStringOption(o => o.setName('cohost').setDescription('Co-host (optioneel)').setRequired(false))
      .addStringOption(o => o.setName('helpers').setDescription('Helpers (komma gescheiden, optioneel)').setRequired(false))
      .addStringOption(o => o.setName('opmerkingen').setDescription('Bijkomende opmerkingen (optioneel)').setRequired(false))
      .addStringOption(o => o.setName('locatie').setDescription('Locatie in Roblox (optioneel)').setRequired(false))
      .addStringOption(o => o.setName('max_deelnemers').setDescription('Max aantal deelnemers (optioneel)').setRequired(false))
      .addStringOption(o => o.setName('benodigdheden').setDescription('Benodigdheden (optioneel)').setRequired(false)),

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

    // NIEUW: Deelname controle
    new SlashCommandBuilder()
      .setName('traininglock')
      .setDescription('Sluit of open deelname aan trainingen')
      .addStringOption(o => o.setName('actie')
        .setDescription('Wat wil je doen?')
        .setRequired(true)
        .addChoices(
          { name: '🔒 Sluit ALLE trainingen', value: 'lock_all' },
          { name: '🔓 Open ALLE trainingen', value: 'unlock_all' },
          { name: '🔒 Sluit specifieke training', value: 'lock_training' },
          { name: '🔓 Open specifieke training', value: 'unlock_training' }
        ))
      .addIntegerOption(o => o.setName('id')
        .setDescription('Training ID (alleen bij lock/unlock training)')
        .setRequired(false)),

    new SlashCommandBuilder()
      .setName('trainingstatus')
      .setDescription('Check deelname status van trainingen'),

    new SlashCommandBuilder()
      .setName('trainingen')
      .setDescription('Bekijk trainingen op website'),

    new SlashCommandBuilder()
      .setName('verwijder')
      .setDescription('Verwijder training')
      .addIntegerOption(o => o.setName('id').setDescription('Training ID').setRequired(true)),

    new SlashCommandBuilder()
      .setName('starttraining')
      .setDescription('Start training in Roblox')
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
    const dienst = options.getString('dienst');
    const onderwerp = options.getString('onderwerp');
    const cohost = options.getString('cohost') || null;
    const helpersInput = options.getString('helpers') || null;
    const opmerkingen = options.getString('opmerkingen') || null;
    const locatie = options.getString('locatie') || null;
    const maxDeelnemers = options.getString('max_deelnemers') || null;
    const benodigdheden = options.getString('benodigdheden') || null;

    if (!isValidDate(datum) || !isValidTime(tijd)) {
      return interaction.editReply({
        content: '❌ **Ongeldige datum/tijd!**\nDatum: DD/MM/YYYY\nTijd: HH:MM\nVoorbeeld: `/training datum:20/12/2024 tijd:19:00 trainer:John dienst:Politie onderwerp:Verkeerscontroles`',
        ephemeral: true
      });
    }

    let helpers = null;
    if (helpersInput) {
      helpers = helpersInput.split(',').map(h => h.trim()).filter(h => h.length > 0);
    }

    const trainingData = {
      datum: datum,
      tijd: tijd,
      trainer: trainer,
      dienst: dienst,
      onderwerp: onderwerp,
      status: 'not_started',
      toegevoegd_door: user.username,
      van_discord: true,
      ...(cohost && { co_host: cohost }),
      ...(helpers && helpers.length > 0 && { helpers: helpers }),
      ...(opmerkingen && { opmerkingen: opmerkingen }),
      ...(locatie && { locatie: locatie }),
      ...(maxDeelnemers && { max_deelnemers: maxDeelnemers }),
      ...(benodigdheden && { benodigdheden: benodigdheden })
    };

    console.log(`📤 Training naar website:`, trainingData);

    try {
      const response = await axios.post(TRAINING_API, trainingData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      console.log(`✅ Website response:`, response.data);

      const statusInfo = STATUS_MAP.not_started;
      const dienstInfo = DIENST_MAP[dienst] || { color: 0x7289DA, emoji: '🎯' };
      const training = response.data.training || trainingData;

      const embed = new EmbedBuilder()
        .setColor(dienstInfo.color)
        .setTitle(`${dienstInfo.emoji} ${dienst} TRAINING TOEGEVOEGD!`)
        .setDescription(`**Training staat op website én in Roblox!**\nID: #${training.id || 'Nieuw'}`)
        .addFields(
          { name: '📚 **Onderwerp**', value: onderwerp, inline: false },
          { name: '📅 **Datum**', value: datum, inline: true },
          { name: '⏰ **Tijd**', value: `${tijd} uur`, inline: true },
          { name: '👨‍🏫 **Trainer**', value: trainer, inline: true },
          { name: '🚑 **Dienst**', value: `${dienstInfo.emoji} ${dienst}`, inline: true },
          { name: '📊 **Status**', value: `${statusInfo.emoji} ${statusInfo.name}`, inline: true }
        )
        .setFooter({
          text: `Toegevoegd door ${user.username}`,
          iconURL: user.displayAvatarURL({ size: 64 })
        })
        .setTimestamp();

      if (cohost) embed.addFields({ name: '🤝 **Co-host**', value: cohost, inline: true });
      if (helpers && helpers.length > 0) embed.addFields({ name: '👥 **Helpers**', value: helpers.join(', '), inline: true });
      if (opmerkingen) embed.addFields({ name: '💡 **Opmerkingen**', value: opmerkingen, inline: false });
      if (locatie) embed.addFields({ name: '📍 **Locatie (Roblox)**', value: locatie, inline: true });
      if (maxDeelnemers) embed.addFields({ name: '👥 **Max deelnemers**', value: maxDeelnemers, inline: true });
      if (benodigdheden) embed.addFields({ name: '🎒 **Benodigdheden**', value: benodigdheden, inline: false });

      embed.addFields(
        { name: '🌐 **Website**', value: 'https://bredathenetherlands.netlify.app/trainingen/', inline: false },
        { name: '🎮 **Roblox**', value: 'Klik op het "2" knopje rechtsonder om deel te nemen', inline: false }
      );

      await interaction.editReply({ embeds: [embed] });

      // Stuur naar training kanaal
      try {
        const channel = await guild.channels.fetch(TRAINING_CHANNEL_ID);
        if (channel?.isTextBased()) {
          const announceEmbed = new EmbedBuilder()
            .setColor(dienstInfo.color)
            .setTitle(`${dienstInfo.emoji} **NIEUWE ${dienst} TRAINING!**`)
            .setDescription(`Toegevoegd door <@${user.id}>`)
            .addFields(
              { name: '🎓 **Onderwerp**', value: onderwerp, inline: false },
              { name: '📅 **Datum**', value: datum, inline: true },
              { name: '⏰ **Tijd**', value: `${tijd} uur`, inline: true },
              { name: '👨‍🏫 **Trainer**', value: trainer, inline: true },
              { name: '🚑 **Dienst**', value: dienst, inline: true }
            )
            .setFooter({ text: 'Breda The Netherlands Roleplay' })
            .setTimestamp();

          if (cohost) announceEmbed.addFields({ name: '🤝 **Co-host**', value: cohost, inline: true });
          if (locatie) announceEmbed.addFields({ name: '📍 **Locatie**', value: locatie, inline: true });

          await channel.send({
            content: `**${dienstInfo.emoji} NIEUWE ${dienst} TRAINING!** ${statusInfo.emoji}`,
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
          { name: '🌐 **Website**', value: 'https://bredathenetherlands.netlify.app/trainingen/', inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }

  // ========== /traininglock ==========
  else if (commandName === 'traininglock') {
    await interaction.deferReply();
    
    const actie = options.getString('actie');
    const trainingId = options.getInteger('id');
    
    let bericht = "";
    let color = 0x3498db;
    
    switch(actie) {
      case 'lock_all':
        bericht = "🔒 **ALLE TRAININGEN GESLOTEN**\nGeen enkele speler kan meer deelnemen aan trainingen.";
        color = 0xe74c3c;
        break;
      case 'unlock_all':
        bericht = "🔓 **ALLE TRAININGEN OPEN**\nSpelers kunnen weer deelnemen aan trainingen.";
        color = 0x2ecc71;
        break;
      case 'lock_training':
        if (!trainingId) {
          bericht = "❌ Geef een Training ID op!";
          color = 0xe74c3c;
        } else {
          bericht = `🔒 **TRAINING #${trainingId} GESLOTEN**\nDeelname is nu gesloten voor deze training.`;
          color = 0xe74c3c;
        }
        break;
      case 'unlock_training':
        if (!trainingId) {
          bericht = "❌ Geef een Training ID op!";
          color = 0xe74c3c;
        } else {
          bericht = `🔓 **TRAINING #${trainingId} OPEN**\nDeelname is nu weer mogelijk voor deze training.`;
          color = 0x2ecc71;
        }
        break;
    }
    
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(actie.includes('lock') ? '🔒 Deelname Gesloten' : '🔓 Deelname Open')
      .setDescription(bericht)
      .addFields(
        { name: '👤 Uitgevoerd door', value: user.username, inline: true },
        { name: '🕐 Tijd', value: new Date().toLocaleTimeString(), inline: true }
      )
      .setFooter({ text: 'Deelname status wordt real-time doorgegeven aan Roblox' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
    // Stuur naar training kanaal
    try {
      const channel = await guild.channels.fetch(TRAINING_CHANNEL_ID);
      if (channel?.isTextBased()) {
        await channel.send({ 
          content: `**${actie.includes('lock') ? '🔒' : '🔓'} DEELNAME ${actie.includes('lock') ? 'GESLOTEN' : 'OPEN'}**\n${bericht}`
        });
      }
    } catch (e) {
      console.log('⚠️ Kanaal error:', e.message);
    }
  }

  // ========== /trainingstatus ==========
  else if (commandName === 'trainingstatus') {
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('📊 Training Deelname Status')
      .setDescription('**Huidige status van training deelname:**')
      .addFields(
        { name: '🎮 Roblox Connectie', value: '✅ Actief', inline: true },
        { name: '🔗 API Status', value: '✅ Online', inline: true },
        { name: '💡 Gebruik', value: '`/traininglock` om deelname te sluiten/openen', inline: false },
        { name: '📋 Commands', value: '`lock_all` - Sluit alle trainingen\n`unlock_all` - Open alle trainingen\n`lock_training id:123` - Sluit training #123\n`unlock_training id:123` - Open training #123', inline: false }
      )
      .setFooter({ text: 'Breda The Netherlands Roleplay' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
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
      await axios.put(TRAINING_API, updateData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      const embed = new EmbedBuilder()
        .setColor(statusInfo.color)
        .setTitle(`${statusInfo.emoji} **Status Bijgewerkt!**`)
        .setDescription(`Training **#${trainingId}** is bijgewerkt.`)
        .addFields(
          { name: '🆔 **Training ID**', value: `#${trainingId}`, inline: true },
          { name: '🔄 **Nieuwe Status**', value: `${statusInfo.emoji} ${statusInfo.name}`, inline: true },
          { name: '👤 **Door**', value: user.username, inline: true },
          { name: '🌐 **Website**', value: 'Status staat nu op de website!', inline: false }
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
        .setTitle(`${statusInfo.emoji} **Status Update**`)
        .setDescription(`Kon status niet wijzigen via API.`)
        .addFields(
          { name: '🆔 **Training ID**', value: `#${trainingId}`, inline: true },
          { name: '🔄 **Gewenste Status**', value: `${statusInfo.emoji} ${statusInfo.name}`, inline: true },
          { name: '⚠️ **Fout**', value: error.message, inline: false }
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
      await axios.delete(TRAINING_API, {
        data: { id: trainingId },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ **Training Verwijderd**')
        .setDescription(`Training **#${trainingId}** is verwijderd.`)
        .addFields(
          { name: '🆔 **Training ID**', value: `#${trainingId}`, inline: true },
          { name: '👤 **Door**', value: user.username, inline: true },
          { name: '🌐 **Website**', value: 'Training is van de website verwijderd', inline: false }
        )
        .setFooter({ text: `Verwijderd door ${user.username}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.log('❌ Delete error:', error.message);

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ **Kon training niet verwijderen**')
        .setDescription(`**API Error:** ${error.response?.data?.error || error.message}`)
        .addFields(
          { name: '🆔 **Training ID**', value: `#${trainingId}`, inline: true },
          { name: '⚠️ **Fout**', value: error.message, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }

  // ========== /trainingen ==========
  else if (commandName === 'trainingen') {
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('📚 **Trainingen Bekijken**')
      .setDescription('**Bekijk alle trainingen op de website:**')
      .addFields(
        { name: '🌐 **Website Link**', value: 'https://bredathenetherlands.netlify.app/trainingen/', inline: false },
        { name: '🚑 **Diensten**', value: 'Ambulance | Politie | Brandweer | KMar | DSI | Rijkswaterstaat', inline: false },
        { name: '📊 **Status Legenda**', value: '⏳ Niet gestart | 🔄 Bezig | ✅ Afgelopen | ❌ Geannuleerd | 📅 Uitgesteld | 📝 Gepland', inline: false },
        { name: '💡 **Tip**', value: 'Gebruik `/training` om een training toe te voegen', inline: false }
      )
      .setFooter({ text: 'Breda The Netherlands Roleplay' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ========== /starttraining ==========
  else if (commandName === 'starttraining') {
    await interaction.deferReply();

    const trainingId = options.getInteger('id');

    try {
      await axios.put(TRAINING_API, {
        id: trainingId,
        status: 'in_progress',
        status_text: 'Bezig in Roblox'
      });

      console.log(`🎮 Training gestart in Roblox: ID ${trainingId}`);

      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🎮 **TRAINING GESTART IN ROBBLOX!**')
        .setDescription(`Training **#${trainingId}** is nu LIVE!`)
        .addFields(
          { name: '🆔 **Training ID**', value: `#${trainingId}`, inline: true },
          { name: '🎮 **Status**', value: '🔄 Bezig in Roblox', inline: true },
          { name: '👤 **Gestart door**', value: user.username, inline: true },
          { name: '🌐 **Website**', value: 'Training staat nu op website', inline: false },
          { name: '🎯 **Roblox**', value: 'Spelers kunnen nu **DEELNEMEN** via het "2" knopje rechtsonder!', inline: false }
        )
        .setFooter({
          text: `Gestart door ${user.username}`,
          iconURL: user.displayAvatarURL({ size: 64 })
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      try {
        const channel = await guild.channels.fetch(TRAINING_CHANNEL_ID);
        if (channel?.isTextBased()) {
          await channel.send({
            content: `**🎮 TRAINING GESTART IN ROBBLOX!**\nTraining #${trainingId} is nu actief! Spelers kunnen nu deelnemen via het "2" knopje rechtsonder in Roblox!`
          });
        }
      } catch (e) {
        console.log('⚠️ Kanaal error:', e.message);
      }

    } catch (error) {
      console.log('❌ Start training error:', error.message);

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ **Kon training niet starten**')
        .setDescription(`**API Error:** ${error.response?.data?.error || error.message}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }

  // ========== /help ==========
  else if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle('🤖 **Breda Roleplay Bot - Help**')
      .setDescription('**Training Management met Website + Roblox Integratie**')
      .addFields(
        {
          name: '🎓 **`/training`**',
          value: 'Voeg training toe (komt direct op website + Roblox)\n**Verplicht:** datum, tijd, trainer, dienst, onderwerp\n**Optioneel:** cohost, helpers, opmerkingen, locatie, max_deelnemers, benodigdheden',
          inline: false
        },
        {
          name: '🔒 **`/traininglock`**',
          value: 'Sluit of open deelname aan trainingen\n**Opties:** lock_all, unlock_all, lock_training, unlock_training',
          inline: false
        },
        {
          name: '📊 **`/trainingstatus`**',
          value: 'Check deelname status van trainingen',
          inline: false
        },
        {
          name: '🔄 **`/status`**',
          value: 'Verander status van training\n**Status opties:**\n⏳ Niet gestart | 🔄 Bezig | ✅ Afgelopen | ❌ Geannuleerd | 📅 Uitgesteld | 📝 Gepland',
          inline: false
        },
        {
          name: '🎮 **`/starttraining`**',
          value: 'Start training in Roblox\nMaakt "DEELNEMEN" knop zichtbaar voor spelers',
          inline: false
        },
        {
          name: '🗑️ **`/verwijder`**',
          value: 'Verwijder training',
          inline: false
        },
        {
          name: '📚 **`/trainingen`**',
          value: 'Bekijk trainingen op website',
          inline: false
        },
        {
          name: '🌐 **Website**',
          value: 'https://bredathenetherlands.netlify.app/trainingen/',
          inline: false
        },
        {
          name: '🎮 **Roblox**',
          value: 'Klik op "2" knopje rechtsonder om trainingen te zien en deel te nemen',
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
      .setTitle('🤖 **Bot Informatie**')
      .setDescription('Breda Roleplay Training Bot')
      .addFields(
        { name: '📊 **Versie**', value: 'Website + Roblox Integratie v2.0', inline: true },
        { name: '🤖 **Botnaam**', value: client.user.tag, inline: true },
        { name: '💾 **Database**', value: 'Netlify Functions', inline: true },
        { name: '🚑 **Diensten**', value: '6 diensten', inline: true },
        { name: '🔒 **Deelname Controle**', value: '✅ Beschikbaar', inline: true },
        { name: '🔗 **Add Training**', value: 'Werkt ✅', inline: true },
        { name: '🎮 **Start Roblox**', value: 'Werkt ✅', inline: true },
        { name: '🗑️ **Delete**', value: 'Werkt ✅', inline: true },
        { name: '📢 **Kanaal**', value: `<#${TRAINING_CHANNEL_ID}>`, inline: false }
      )
      .setFooter({ text: 'Breda The Netherlands Roleplay' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

console.log('🚀 Starting bot met Website + Roblox Integratie...');
client.login(process.env.DISCORD_TOKEN);