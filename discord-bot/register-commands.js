// discord-bot/register-commands.js
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, Events } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('training')
    .setDescription('Plan een nieuwe training')
    .addStringOption(option =>
      option.setName('datum')
        .setDescription('Datum (dd/mm/yyyy)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('tijd')
        .setDescription('Tijd (uu:mm)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('trainer')
        .setDescription('Naam van de trainer')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('onderwerp')
        .setDescription('Onderwerp van de training')
        .setRequired(true)
    ),
  // Voeg andere commands toe...
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Registreer ${commands.length} slash commands...`);

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands.map(command => command.toJSON()) }
    );

    console.log(`✅ Succesvol ${data.length} slash commands geregistreerd!`);
    
    // Toon commando details
    data.forEach(cmd => {
      console.log(`   • /${cmd.name} - ${cmd.description}`);
      if (cmd.options) {
        cmd.options.forEach(opt => {
          console.log(`     ↳ ${opt.name}: ${opt.description}`);
        });
      }
    });
  } catch (error) {
    console.error('❌ Fout bij registreren commands:', error);
  }
})();