// netlify/functions/training-manager.js

// Simpele test data
const trainings = [
  {
    id: 1,
    onderwerp: "Politie Basis Training",
    datum: "01/12/2024",
    tijd: "20:00",
    trainer: "John Doe",
    status: "not_started",
    status_text: "Nog niet gestart",
    toegevoegd_door: "Gilles",
    van_discord: true
  }
];

exports.handler = async (event) => {
  console.log('Function called:', event.httpMethod);
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  // GET request
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(trainings)
    };
  }

  // Andere methodes niet toegestaan voor nu
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};