require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// Netlify Function URLs
const ADD_TRAINING_URL = 'https://bredathenetherlands.netlify.app/.netlify/functions/add-training';

// SPECIFIEK KANAAL ID VOOR TRAININGEN - VERVANG DIT MET JOUW KANAAL ID!
const TRAINING_CHANNEL_ID = '1439631013964677222';

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
  console.log(`🔗 Netlify Function: ${ADD_TRAINING_URL}`);
  console.log(`📢 Training Channel ID: ${TRAINING_CHANNEL_ID}`);
  console.log(`=========================================`);
  
  // Toon server info
  console.log(`🏠 Connected to ${client.guilds.cache.size} server(s):`);
  client.guilds.cache.forEach(guild => {
    console.log(`   • ${guild.name} (${guild.memberCount} members)`);
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

      // 1. Stuur naar Netlify Function
      const response = await axios.post(ADD_TRAINING_URL, trainingData, {
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'BredaRoleplayBot/1.0'
        },
        timeout: 15000
      });

      console.log(`✅ [${new Date().toLocaleTimeString()}] Netlify response:`, response.data);

      // 2. Stuur embed naar gebruiker
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
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });

      // 3. STUUR NAAR SPECIFIEK KANAAL (1439631013964677222)
      try {
        const trainingChannel = await guild.channels.fetch(TRAINING_CHANNEL_ID);
        
        if (trainingChannel && trainingChannel.isTextBased()) {
          console.log(`📢 Channel gevonden: #${trainingChannel.name} (${trainingChannel.id})`);
          
          const announcementEmbed = new EmbedBuilder()
            .setColor(0x0099FF) // Blauw
            .setTitle('📚 NIEUWE TRAINING GEPLAND!')
            .setDescription('Er is een nieuwe training toegevoegd aan het rooster.')
            .addFields(
              { name: '🎓 Onderwerp', value: onderwerp, inline: false },
              { name: '📅 Datum', value: datum, inline: true },
              { name: '⏰ Tijd', value: `${tijd} uur`, inline: true },
              { name: '👨‍🏫 Trainer', value: trainer, inline: true },
              { name: '👤 Toegevoegd door', value: `<@${user.id}>`, inline: true }
            )
            .setFooter({ 
              text: 'Breda The Netherlands Roleplay', 
              iconURL: guild.iconURL({ size: 64 }) || client.user.displayAvatarURL({ size: 64 })
            })
            .setTimestamp()
            .setThumbnail(user.displayAvatarURL({ size: 64 }));
          
          // Voeg @everyone of @here toe voor notificatie (optioneel)
          const mention = guild.roles.cache.find(r => r.name === 'Training') ? 
            `<@&${guild.roles.cache.find(r => r.name === 'Training').id}>` : 
            '@here';
          
          await trainingChannel.send({ 
            content: `${mention} **NIEUWE TRAINING!** 🎓`,
            embeds: [announcementEmbed] 
          });
          
          console.log(`✅ Announcement sent to #${trainingChannel.name}`);
        } else {
          console.warn(`⚠️ Channel ${TRAINING_CHANNEL_ID} niet gevonden of geen tekstkanaal`);
          // Stuur naar huidig kanaal als fallback
          await interaction.channel.send({
            embeds: [successEmbed],
            content: `📢 **Nieuwe training toegevoegd door ${user.username}!**`
          });
        }
      } catch (channelError) {
        console.error('❌ Fout bij verzenden naar channel:', channelError.message);
        // Fallback: stuur naar huidig kanaal
        await interaction.channel.send({
          embeds: [successEmbed.setTitle('✅ Training Toegevoegd (geen kanaal gevonden)')],
          content: `⚠️ Kon niet naar trainingen kanaal sturen, maar training is wel opgeslagen.`
        });
      }

    } catch (error) {
      console.error(`❌ [${new Date().toLocaleTimeString()}] Training error:`, error.message);
      
      let errorMessage = '❌ **Er ging iets mis bij het toevoegen van de training.**\n\n';
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage += '🔌 **Netlify is niet bereikbaar.**\n';
      } else if (error.response?.status === 404) {
        errorMessage += '🔍 **Netlify Function niet gevonden (404).**\n';
      } else if (error.response?.status === 500) {
        errorMessage += '⚙️ **Server error in Netlify Function.**\n';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += '⏱️ **Timeout - Netlify reageert niet.**\n';
      } else {
        errorMessage += `💻 **Technische fout:** ${error.message}\n`;
      }
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000) // Rood
        .setTitle('❌ Fout opgetreden')
        .setDescription(errorMessage)
        .setTimestamp();

      await interaction.editReply({ 
        embeds: [errorEmbed],
        flags: 64
      });
    }
  }

  // ==================== /trainingen COMMAND ====================
  if (commandName === 'trainingen') {
    await interaction.deferReply();

    try {
      console.log(`📥 [${new Date().toLocaleTimeString()}] Trainingen ophalen van Netlify...`);
      
      const response = await axios.get(ADD_TRAINING_URL, { 
        timeout: 10000,
        headers: { 'User-Agent': 'BredaRoleplayBot/1.0' }
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
        .setTimestamp();
      
      // Voeg trainingen toe (max 5 voor leesbaarheid)
      const trainingenToShow = gesorteerdeTrainingen.slice(0, 5);
      
      trainingenToShow.forEach((training, index) => {
        mainEmbed.addFields({
          name: `#${index + 1} - ${training.onderwerp}`,
          value: `📅 ${training.datum} | ⏰ ${training.tijd}\n👨‍🏫 ${training.trainer}`,
          inline: false
        });
      });
      
      // Voeg link naar website toe
      if (gesorteerdeTrainingen.length > 5) {
        mainEmbed.addFields({
          name: '🌐 Website',
          value: `Bekijk alle ${gesorteerdeTrainingen.length} trainingen op:\nhttps://bredathenetherlands.netlify.app/trainingen.html`,
          inline: false
        });
      }
      
      await interaction.editReply({ embeds: [mainEmbed] });

    } catch (error) {
      console.error(`❌ [${new Date().toLocaleTimeString()}] Fout bij ophalen trainingen:`, error.message);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000) // Rood
        .setTitle('❌ Kon trainingen niet laden')
        .setDescription('Probeer het later opnieuw of bekijk de trainingen op de website.')
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
      .setDescription('Alle beschikbare commando\'s:')
      .addFields(
        {
          name: '🎓 `/training`',
          value: 'Plan een nieuwe training\n' +
                 '```/training datum:dd/mm/yyyy tijd:uu:mm trainer:Naam onderwerp:Onderwerp```'
        },
        {
          name: '📚 `/trainingen`',
          value: 'Toon alle geplande trainingen'
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

    await interaction.reply({ embeds: [helpEmbed] });
  }
});

// Error handling
client.on(Events.Error, error => {
  console.error(`❌ [${new Date().toLocaleTimeString()}] Discord.js error:`, error.message);
});

// Start bot
console.log(`🚀 [${new Date().toLocaleTimeString()}] Bot opstarten...`);
client.login(process.env.DISCORD_TOKEN);