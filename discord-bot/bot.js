require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// Netlify Function URLs
const ADD_TRAINING_URL = 'https://bredathenetherlands.netlify.app/.netlify/functions/add-training';
const GET_TRAININGS_URL = 'https://bredathenetherlands.netlify.app/.netlify/functions/add-training'; // Zelfde URL voor GET & POST

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Bot is klaar
client.once(Events.ClientReady, () => {
  console.log(`=========================================`);
  console.log(`✅ Breda Roleplay Bot is online!`);
  console.log(`🤖 Bot: ${client.user.tag}`);
  console.log(`🆔 ID: ${client.user.id}`);
  console.log(`🔗 Netlify Function: ${ADD_TRAINING_URL}`);
  console.log(`=========================================`);
  
  // Toon server info
  console.log(`🏠 Connected to ${client.guilds.cache.size} server(s):`);
  client.guilds.cache.forEach(guild => {
    console.log(`   • ${guild.name} (${guild.memberCount} members)`);
    console.log(`     Owner: ${guild.ownerId}`);
    console.log(`     Channels: ${guild.channels.cache.size}`);
  });
  console.log(`=========================================`);
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

    // Valideer datum formaat (dd/mm/yyyy)
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(datum)) {
      return interaction.editReply({
        content: '❌ **Ongeldige datum!** Gebruik formaat: dd/mm/yyyy\nBijvoorbeeld: 15/12/2025',
        flags: 64
      });
    }

    // Valideer tijd formaat (uu:mm)
    if (!/^\d{2}:\d{2}$/.test(tijd)) {
      return interaction.editReply({
        content: '❌ **Ongeldige tijd!** Gebruik formaat: uu:mm (24-uurs)\nBijvoorbeeld: 20:00',
        flags: 64
      });
    }

    const trainingData = {
      datum: datum,
      tijd: tijd,
      trainer: trainer,
      onderwerp: onderwerp,
      toegevoegd_door: user.username,
      discord_user_id: user.id,
      discord_guild: guild ? guild.name : 'Direct Message',
      discord_guild_id: guild ? guild.id : 'N/A',
      timestamp: new Date().toISOString()
    };

    try {
      console.log(`📤 [${new Date().toLocaleTimeString()}] Training verzenden naar Netlify...`);
      console.log(`   Data:`, trainingData);

      const response = await axios.post(ADD_TRAINING_URL, trainingData, {
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'BredaRoleplayBot/1.0'
        },
        timeout: 15000
      });

      console.log(`✅ [${new Date().toLocaleTimeString()}] Netlify response:`, response.data);

      // Maak success embed
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Groen
        .setTitle('✅ Training Toegevoegd!')
        .setDescription('De training is succesvol toegevoegd aan het rooster en de website.')
        .addFields(
          { name: '📅 Datum', value: datum, inline: true },
          { name: '⏰ Tijd', value: tijd, inline: true },
          { name: '👨‍🏫 Trainer', value: trainer, inline: true },
          { name: '📖 Onderwerp', value: onderwerp }
        )
        .setFooter({ 
          text: `Toegevoegd door ${user.username}`, 
          iconURL: user.displayAvatarURL({ size: 64 }) 
        })
        .setTimestamp()
        .setThumbnail('https://cdn.discordapp.com/attachments/1063421315962839111/1063422909899542578/training_icon.png');

      await interaction.editReply({ embeds: [successEmbed] });

      // Stuur naar trainingen kanaal (optioneel)
      if (guild) {
        const trainingChannel = guild.channels.cache.find(channel => 
          channel.isTextBased() &&
          (channel.name.toLowerCase().includes('training') || 
           channel.name.toLowerCase().includes('agenda') ||
           channel.name.toLowerCase().includes('rooster') ||
           channel.name.toLowerCase().includes('announcements'))
        );
        
        if (trainingChannel) {
          try {
            const announcementEmbed = new EmbedBuilder()
              .setColor(0x0099FF) // Blauw
              .setTitle('📚 Nieuwe Training Gepland!')
              .setDescription('Er is een nieuwe training toegevoegd aan het rooster.')
              .addFields(
                { name: 'Onderwerp', value: onderwerp },
                { name: 'Datum & Tijd', value: `${datum} om ${tijd} uur`, inline: true },
                { name: 'Trainer', value: trainer, inline: true },
                { name: 'Toegevoegd door', value: `<@${user.id}>`, inline: true }
              )
              .setFooter({ 
                text: 'Breda The Netherlands Roleplay', 
                iconURL: guild.iconURL({ size: 64 }) 
              })
              .setTimestamp()
              .setThumbnail(user.displayAvatarURL({ size: 64 }));

            await trainingChannel.send({ 
              content: `📢 **Nieuwe training!** <@&${guild.roles.cache.find(r => r.name.includes('Training') || r.name.includes('Member'))?.id || ''}>`,
              embeds: [announcementEmbed] 
            });
            
            console.log(`📢 Announcement sent to #${trainingChannel.name}`);
          } catch (announcementError) {
            console.warn('⚠️ Could not send announcement:', announcementError.message);
          }
        }
      }

    } catch (error) {
      console.error(`❌ [${new Date().toLocaleTimeString()}] Training error:`, error.message);
      
      let errorMessage = '❌ **Er ging iets mis bij het toevoegen van de training.**\n\n';
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage += '🔌 **Netlify is niet bereikbaar.**\n';
        errorMessage += 'Controleer je internetverbinding.\n';
      } else if (error.response?.status === 404) {
        errorMessage += '🔍 **Netlify Function niet gevonden (404).**\n';
        errorMessage += 'De function is nog niet geïmplementeerd op Netlify.\n';
        errorMessage += 'Ga naar: https://app.netlify.com/sites/bredathenetherlands/functions';
      } else if (error.response?.status === 500) {
        errorMessage += '⚙️ **Server error in Netlify Function.**\n';
        errorMessage += 'Controleer de Netlify function logs.\n';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += '⏱️ **Timeout - Netlify reageert niet.**\n';
        errorMessage += 'Probeer het later opnieuw.\n';
      } else {
        errorMessage += `💻 **Technische fout:** ${error.message}\n`;
      }
      
      errorMessage += '\n⚠️ **Probeer het opnieuw of neem contact op met de server admin.**';
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000) // Rood
        .setTitle('❌ Fout opgetreden')
        .setDescription(errorMessage)
        .setTimestamp();

      await interaction.editReply({ 
        embeds: [errorEmbed],
        flags: 64 // Ephemeral
      });
    }
  }

  // ==================== /trainingen COMMAND ====================
  if (commandName === 'trainingen') {
    await interaction.deferReply();

    try {
      console.log(`📥 [${new Date().toLocaleTimeString()}] Trainingen ophalen van Netlify...`);
      
      const response = await axios.get(GET_TRAININGS_URL, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'BredaRoleplayBot/1.0'
        }
      });
      
      const trainingen = response.data;
      
      if (!trainingen || !Array.isArray(trainingen) || trainingen.length === 0) {
        const noTrainingsEmbed = new EmbedBuilder()
          .setColor(0xFFA500) // Oranje
          .setTitle('📭 Geen Trainingen')
          .setDescription('Er zijn momenteel geen trainingen gepland.')
          .addFields({
            name: '📋 Tip',
            value: 'Plan een nieuwe training met `/training`'
          })
          .setTimestamp();

        return interaction.editReply({ embeds: [noTrainingsEmbed] });
      }
      
      console.log(`✅ [${new Date().toLocaleTimeString()}] ${trainingen.length} training(en) gevonden`);
      
      // Sorteer op datum (oudste eerst)
      const gesorteerdeTrainingen = trainingen.sort((a, b) => {
        try {
          const [dagA, maandA, jaarA] = a.datum.split('/').map(Number);
          const [dagB, maandB, jaarB] = b.datum.split('/').map(Number);
          const dateA = new Date(jaarA, maandA - 1, dagA);
          const dateB = new Date(jaarB, maandB - 1, dagB);
          return dateA - dateB;
        } catch {
          return 0;
        }
      });
      
      // Maak hoofd embed
      const mainEmbed = new EmbedBuilder()
        .setColor(0x0099FF) // Blauw
        .setTitle('📚 Geplande Trainingen')
        .setDescription(`Er staan **${gesorteerdeTrainingen.length}** training(en) gepland.`)
        .setFooter({ 
          text: 'Breda The Netherlands Roleplay', 
          iconURL: client.user.displayAvatarURL({ size: 64 }) 
        })
        .setTimestamp()
        .setThumbnail('https://cdn.discordapp.com/attachments/1063421315962839111/1063422909899542578/calendar_icon.png');
      
      // Voeg trainingen toe (max 10 voor leesbaarheid)
      const trainingenToShow = gesorteerdeTrainingen.slice(0, 10);
      
      trainingenToShow.forEach((training, index) => {
        mainEmbed.addFields({
          name: `#${index + 1} - ${training.onderwerp}`,
          value: `📅 **Datum:** ${training.datum}\n` +
                 `⏰ **Tijd:** ${training.tijd}\n` +
                 `👨‍🏫 **Trainer:** ${training.trainer}\n` +
                 `👤 **Toegevoegd door:** ${training.toegevoegd_door || 'Onbekend'}`,
          inline: false
        });
      });
      
      // Voeg extra info toe als er meer trainingen zijn
      if (gesorteerdeTrainingen.length > 10) {
        mainEmbed.addFields({
          name: '📊 Meer trainingen',
          value: `En nog ${gesorteerdeTrainingen.length - 10} training(en)...\n` +
                 `Bekijk alle trainingen op de website:`,
          inline: false
        });
        
        mainEmbed.setURL('https://bredathenetherlands.netlify.app/trainingen.html');
      }
      
      await interaction.editReply({ embeds: [mainEmbed] });

    } catch (error) {
      console.error(`❌ [${new Date().toLocaleTimeString()}] Fout bij ophalen trainingen:`, error.message);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000) // Rood
        .setTitle('❌ Kon trainingen niet laden')
        .setDescription('Er is een probleem met de verbinding naar de website.')
        .addFields(
          { name: '🔧 Oplossing 1', value: 'Probeer het later opnieuw', inline: true },
          { name: '🔧 Oplossing 2', value: 'Bekijk trainingen op de website', inline: true }
        )
        .setURL('https://bredathenetherlands.netlify.app/trainingen.html')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  // ==================== /help COMMAND ====================
  if (commandName === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x7289DA) // Discord blauw
      .setTitle('🤖 Breda Roleplay Bot Help')
      .setDescription('Alle beschikbare commando\'s voor trainingen beheer:')
      .addFields(
        {
          name: '🎓 `/training`',
          value: 'Plan een nieuwe training\n' +
                 '```/training datum:15/12/2025 tijd:20:00 trainer:John_Doe onderwerp:Politie_Basis```\n' +
                 '**Parameters:**\n' +
                 '• `datum`: dd/mm/yyyy (verplicht)\n' +
                 '• `tijd`: uu:mm (verplicht)\n' +
                 '• `trainer`: Naam van trainer (verplicht)\n' +
                 '• `onderwerp`: Beschrijving (verplicht)'
        },
        {
          name: '📚 `/trainingen`',
          value: 'Toon alle geplande trainingen\n' +
                 'Laat alle trainingen zien die zijn toegevoegd via de bot.'
        },
        {
          name: '❓ `/help`',
          value: 'Toon dit help menu'
        }
      )
      .setFooter({ 
        text: 'Breda The Netherlands Roleplay | Bot v1.0', 
        iconURL: client.user.displayAvatarURL({ size: 64 }) 
      })
      .setTimestamp()
      .setThumbnail('https://cdn.discordapp.com/attachments/1063421315962839111/1063422909899542578/help_icon.png');

    await interaction.reply({ embeds: [helpEmbed] });
  }

  // ==================== /serverinfo COMMAND ====================
  if (commandName === 'serverinfo') {
    if (!guild) {
      return interaction.reply({
        content: '❌ Dit commando werkt alleen in een server.',
        flags: 64
      });
    }

    const serverEmbed = new EmbedBuilder()
      .setColor(guild.roles.highest.color || 0x7289DA)
      .setTitle(`🏰 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256, dynamic: true }))
      .setDescription(guild.description || 'Geen beschrijving beschikbaar')
      .addFields(
        { name: '👑 Eigenaar', value: `<@${guild.ownerId}>`, inline: true },
        { name: '🆔 Server ID', value: guild.id, inline: true },
        { name: '📅 Aangemaakt', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '👥 Leden', value: `${guild.memberCount}`, inline: true },
        { name: '📁 Channels', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🎭 Rollen', value: `${guild.roles.cache.size}`, inline: true },
        { name: '🚀 Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
        { name: '✨ Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
        { name: '🌐 Regio', value: guild.preferredLocale || 'Onbekend', inline: true }
      )
      .setFooter({ 
        text: 'Breda The Netherlands Roleplay', 
        iconURL: guild.iconURL({ size: 64, dynamic: true }) 
      })
      .setTimestamp();

    if (guild.bannerURL()) {
      serverEmbed.setImage(guild.bannerURL({ size: 512, dynamic: true }));
    }

    await interaction.reply({ embeds: [serverEmbed] });
  }
});

// Error handling
client.on(Events.Error, error => {
  console.error(`❌ [${new Date().toLocaleTimeString()}] Discord.js error:`, error.message);
});

client.on(Events.Warn, info => {
  console.warn(`⚠️ [${new Date().toLocaleTimeString()}] Discord.js warning:`, info);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n🛑 [${new Date().toLocaleTimeString()}] Bot afsluiten...`);
  client.destroy();
  console.log(`✅ [${new Date().toLocaleTimeString()}] Bot succesvol afgesloten.`);
  process.exit(0);
});

// Start bot
console.log(`🚀 [${new Date().toLocaleTimeString()}] Bot opstarten...`);
client.login(process.env.DISCORD_TOKEN);