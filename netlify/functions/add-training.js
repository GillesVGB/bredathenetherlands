// GLOBALE VARIABELE om trainingen op te slaan (reset bij deploy)
let allTrainings = [];

exports.handler = async function(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // GET: Toon ALLE opgeslagen trainingen
  if (event.httpMethod === 'GET') {
    console.log('📤 GET request - Sending', allTrainings.length, 'trainings');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(allTrainings)
    };
  }

  // POST: Voeg NIEUWE training toe
  if (event.httpMethod === 'POST') {
    try {
      const trainingData = JSON.parse(event.body);
      console.log('📥 POST request - New training:', trainingData);
      
      // Voeg unieke ID toe
      const newTraining = {
        id: Date.now(), // Unieke timestamp als ID
        ...trainingData,
        aangemaakt: new Date().toISOString(),
        van_discord: true
      };
      
      // Voeg toe aan array
      allTrainings.push(newTraining);
      
      // Hou alleen laatste 100 trainingen
      if (allTrainings.length > 100) {
        allTrainings = allTrainings.slice(-100);
      }
      
      console.log('✅ Training saved. Total:', allTrainings.length);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Training opgeslagen en beschikbaar op website',
          training: newTraining,
          totalTrainings: allTrainings.length
        })
      };
    } catch (error) {
      console.error('❌ Error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method Not Allowed' })
  };
};
