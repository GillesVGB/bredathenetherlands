// netlify/functions/training-manager.js
let trainings = [
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
  },
  {
    id: 2,
    onderwerp: "EHBO Gevorderd",
    datum: "03/12/2024",
    tijd: "19:30",
    trainer: "Jane Smith",
    status: "upcoming",
    status_text: "Gepland",
    toegevoegd_door: "Bot",
    van_discord: true
  }
];

exports.handler = async (event) => {
  console.log(`[API] ${event.httpMethod} ${event.path}`);
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // GET - Toon alle trainingen
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(trainings)
    };
  }

  // POST - Nieuwe training toevoegen
  if (event.httpMethod === 'POST') {
    try {
      const trainingData = JSON.parse(event.body);
      
      const newTraining = {
        id: Date.now(),
        ...trainingData,
        aangemaakt: new Date().toISOString(),
        van_discord: true
      };

      // Standaard status
      if (!newTraining.status) {
        newTraining.status = 'not_started';
        newTraining.status_text = 'Nog niet gestart';
      }

      trainings.push(newTraining);

      // Hou max 100 trainingen
      if (trainings.length > 100) {
        trainings = trainings.slice(-100);
      }

      console.log(`✅ Training toegevoegd: ${newTraining.onderwerp} (ID: ${newTraining.id})`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Training toegevoegd',
          training: newTraining 
        })
      };
    } catch (error) {
      console.error('❌ POST error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  // PUT - Training status updaten
  if (event.httpMethod === 'PUT') {
    try {
      const updateData = JSON.parse(event.body);
      const { id, status, status_text } = updateData;

      if (!id || !status) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'ID en status zijn verplicht' })
        };
      }

      const trainingIndex = trainings.findIndex(t => t.id === id);
      
      if (trainingIndex === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Training niet gevonden' })
        };
      }

      // Helper functie
      const getStatusText = (status) => {
        const statusMap = {
          'not_started': 'Nog niet gestart',
          'in_progress': 'Bezig',
          'completed': 'Voltooid',
          'cancelled': 'Geannuleerd',
          'delayed': 'Uitgesteld',
          'upcoming': 'Gepland'
        };
        return statusMap[status] || status;
      };

      // Update status
      trainings[trainingIndex].status = status;
      trainings[trainingIndex].status_text = status_text || getStatusText(status);
      trainings[trainingIndex].gewijzigd = new Date().toISOString();

      console.log(`🔄 Status gewijzigd: ID ${id} -> ${status}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Status bijgewerkt',
          training: trainings[trainingIndex]
        })
      };
    } catch (error) {
      console.error('❌ PUT error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  // DELETE - Training verwijderen
  if (event.httpMethod === 'DELETE') {
    try {
      const deleteData = JSON.parse(event.body);
      const { id } = deleteData;

      if (!id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'ID is verplicht' })
        };
      }

      const initialLength = trainings.length;
      trainings = trainings.filter(t => t.id !== id);
      
      if (trainings.length === initialLength) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Training niet gevonden' })
        };
      }

      console.log(`🗑️ Training verwijderd: ID ${id}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Training verwijderd',
          deletedId: id,
          remaining: trainings.length
        })
      };
    } catch (error) {
      console.error('❌ DELETE error:', error);
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
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};
