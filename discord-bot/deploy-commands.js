const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
  {
    name: 'help',
    description: 'Toon alle beschikbare commando\'s',
  },
  {
    name: 'serverinfo',
    description: 'Toon informatie over de roleplay server',
  },
  {
    name: 'training',
    description: 'Plan een nieuwe training voor de roleplay server',
    options: [
      {
        name: 'datum',
        type: 3, // STRING
        description: 'Datum van de training (bijv. 2024-12-25)',
        required: true,
      },
      {
        name: 'tijd',
        type: 3, // STRING
        description: 'Tijd van de training (bijv. 20:00)',
        required: true,
      },
      {
        name: 'onderwerp',
        type: 3, // STRING
        description: 'Onderwerp van de training',
        required: true,
      },
    ],
  },
  {
    name: 'trainingen',
    description: 'Toon alle geplande trainingen',
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Beginnen met registreren van slash-commands...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log('Slash-commands succesvol geregistreerd!');
  } catch (error) {
    console.error(error);
  }
})();