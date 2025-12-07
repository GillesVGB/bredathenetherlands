require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Netlify Function URLs
const NETLIFY_BASE_URL = 'https://bredathenetherlands.netlify.app';
const ADD_TRAINING_URL = `${NETLIFY_BASE_URL}/.netlify/functions/add-training`;
const GET_TRAININGS_URL = `${NETLIFY_BASE_URL}/.netlify/functions/get-trainings`;

// Bot is klaar
client.once(Events.ClientReady, () => {
  console.log(`✅ Bot is online als ${client.user.tag}!`);
  console.log(`🔗 Netlify Functions:`);
  console.log(`   • Add Training: ${ADD_TRAINING_URL}`);
  console.log(`   • Get Trainings: ${GET_TRAININGS_URL}`);
  
  // Toon server info
  console.log(`🏠 Servers: ${client.guilds.cache.size}`);
  client.guilds.cache.forEach(guild => {
    console.log(`   • ${guild.name} (${guild.memberCount} leden)`);
  });
});

// Slash command handler
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options, user, guild } = interaction;

  // /training commando
  if (commandName === 'training') {
    await interaction.deferReply();

    const datum = options.getString('datum');
    const tijd = options.getString('tijd');
    const trainer = options.getString('trainer');
    const onderwerp = options.getString('onderwerp');

    const trainingData = {
      datum: datum,
      tijd: tijd,
      trainer: trainer,
      onderwerp: onderwerp,
      toegevoegd_door: user.username,
      discord_user_id: user.id,
      discord_guild: guild ? guild.name : 'DM',
      timestamp: new Date().toISOString()
    };

    try {
      console.log(`📤 Stuur training naar: ${ADD_TRAINING_URL}`);
      
      const response = await axios.post(ADD_TRAINING_URL, trainingData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      console.log('✅ Response:', response.data);
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Training Toegevoegd!')
        .addFields(
          { name: '📅 Datum', value: datum, inline: true },
          { name: '⏰ Tijd', value: tijd, inline: true },
          { name: '👨‍🏫 Trainer', value: trainer, inline: true },
          { name: '📖 Onderwerp', value: onderwerp }
        )
        .setFooter({ text: `Toegevoegd door ${user.username}`, iconURL: user.displayAvatarURL() })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Stuur naar trainingen kanaal
      if (guild) {
        const trainingChannel = guild.channels.cache.find(
          channel => 
            channel.isTextBased() &&
            (channel.name.includes('training') || 
             channel.name.includes('agenda') ||
             channel.name.includes('rooster'))
        );
        
        if (trainingChannel) {
          const announcement = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📚 Nieuwe Training Gepland!')
            .setDescription(`Een nieuwe training is toegevoegd aan het rooster.`)
            .addFields(
              { name: 'Onderwerp', value: onderwerp },
              { name: 'Datum & Tijd', value: `${datum} om ${tijd}` },
              { name: 'Trainer', value: trainer },
              { name: 'Toegevoegd door', value: `<@${user.id}>` }
            )
            .setTimestamp();

          await trainingChannel.send({ embeds: [announcement] });
        }
      }

    } catch (error) {
      console.error('❌ Fout bij toevoegen training:', error.message);
      
      let errorMessage = '❌ Er ging iets mis bij het toevoegen van de training.\n';
      
      if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
        errorMessage += '\n⚠️ **Netlify Function bestaat nog niet!**\n';
        errorMessage += 'Ga naar je project en voeg de functie toe:\n';
        errorMessage += '```bash\ncd ~/desktop/bredathenetherlands\n';
        errorMessage += 'mkdir -p netlify/functions\n';
        errorMessage += '# Maak add-training.js en get-trainings.js\n```';
      } else if (error.response?.status === 500) {
        errorMessage += '\n⚠️ **Server error in Netlify Function.**';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += '\n⚠️ **Timeout - Netlify Function reageert niet.**';
      }
      
      await interaction.editReply({
        content: errorMessage,
        flags: 64 // EPHEMERAL
      });
    }
  }

  // /trainingen commando
  if (commandName === 'trainingen') {
    await interaction.deferReply();

    try {
      const response = await axios.get(GET_TRAININGS_URL, { timeout: 5000 });
      const trainingen = response.data;
      
      if (!trainingen || trainingen.length === 0) {
        return interaction.editReply({
          content: '📭 Er zijn nog geen trainingen gepland.',
          flags: 64
        });
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('📚 Geplande Trainingen')
        .setDescription(`Er zijn ${trainingen.length} training(en) gepland.`)
        .setTimestamp();

      trainingen.slice(0, 10).forEach((training, index) => {
        embed.addFields({
          name: `${index + 1}. ${training.onderwerp}`,
          value: `📅 ${training.datum} | ⏰ ${training.tijd} | 👨‍🏫 ${training.trainer}`,
          inline: false
        });
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ Fout bij ophalen trainingen:', error.message);
      
      let errorMessage = '❌ Kon trainingen niet ophalen van de website.\n';
      
      if (error.response?.status === 404) {
        errorMessage += '\n⚠️ **Netlify Function bestaat niet.**\n';
        errorMessage += 'Maak eerst: `netlify/functions/get-trainings.js`';
      }
      
      await interaction.editReply({
        content: errorMessage,
        flags: 64
      });
    }
  }

  // /help commando
  if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🤖 Breda Roleplay Bot Help')
      .setDescription('Alle beschikbare commando\'s voor trainingen beheer:')
      .addFields(
        {
          name: '/training',
          value: 'Plan een nieuwe training\n```/training datum:15/12/2025 tijd:20:00 trainer:John_Doe onderwerp:Politie_Basis```'
        },
        {
          name: '/trainingen',
          value: 'Toon alle geplande trainingen'
        },
        {
          name: '/help',
          value: 'Toon dit help menu'
        }
      )
      .setFooter({ text: 'Breda The Netherlands Roleplay' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // /serverinfo commando
  if (commandName === 'serverinfo') {
    if (!guild) {
      return interaction.reply({
        content: '❌ Dit commando werkt alleen in een server.',
        flags: 64
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle(`🏰 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: '👑 Eigenaar', value: `<@${guild.ownerId}>`, inline: true },
        { name: '👥 Leden', value: `${guild.memberCount}`, inline: true },
        { name: '📅 Aangemaakt', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '📁 Channels', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🎭 Rollen', value: `${guild.roles.cache.size}`, inline: true },
        { name: '🚀 Boost Level', value: `Level ${guild.premiumTier}`, inline: true }
      )
      .setFooter({ 
        text: 'Server Informatie', 
        iconURL: client.user.displayAvatarURL() 
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

// Start bot
client.login(process.env.DISCORD_TOKEN);