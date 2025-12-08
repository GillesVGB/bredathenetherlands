const fs = require('fs');
const path = require('path');

// Data opslag pad
const DATA_PATH = path.join(process.cwd(), 'training-data.json');

// Initialiseer data als het niet bestaat
function initData() {
    if (!fs.existsSync(DATA_PATH)) {
        const initialData = {
            trainingen: [],
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(DATA_PATH, JSON.stringify(initialData, null, 2));
    }
}

// Laad data
function loadData() {
    initData();
    const rawData = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(rawData);
}

// Sla data op
function saveData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// Valideer datum formaat
function isValidDate(dateStr) {
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(dateStr)) return false;
    
    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
}

// Valideer tijd formaat
function isValidTime(timeStr) {
    const regex = /^\d{2}:\d{2}$/;
    if (!regex.test(timeStr)) return false;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

// Status opties
const STATUS_OPTIONS = {
    'not_started': 'Nog niet gestart',
    'in_progress': 'Bezig',
    'completed': 'Afgelopen',
    'cancelled': 'Geannuleerd',
    'delayed': 'Uitgesteld'
};

exports.handler = async function(event, context) {
    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };

    // Handle OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const data = loadData();
        
        // GET: Haal alle trainingen op
        if (event.httpMethod === 'GET') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(data.trainingen)
            };
        }
        
        // POST: Voeg nieuwe training toe (van Discord bot)
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            
            // Valideer vereiste velden
            if (!body.datum || !body.tijd || !body.trainer || !body.onderwerp) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing required fields' })
                };
            }
            
            if (!isValidDate(body.datum)) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid date format. Use DD/MM/YYYY' })
                };
            }
            
            if (!isValidTime(body.tijd)) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid time format. Use HH:MM' })
                };
            }
            
            // Maak nieuwe training
            const newTraining = {
                id: Date.now(), // Eenvoudige ID
                datum: body.datum,
                tijd: body.tijd,
                trainer: body.trainer,
                onderwerp: body.onderwerp,
                toegevoegd_door: body.toegevoegd_door || 'Discord Bot',
                van_discord: true,
                status: 'not_started',
                status_text: STATUS_OPTIONS.not_started,
                aangemaakt_op: new Date().toISOString(),
                bijgewerkt_op: new Date().toISOString()
            };
            
            data.trainingen.push(newTraining);
            data.lastUpdated = new Date().toISOString();
            saveData(data);
            
            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Training toegevoegd',
                    training: newTraining 
                })
            };
        }
        
        // PUT: Update training status
        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body || '{}');
            
            if (!body.id || !body.status) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing id or status' })
                };
            }
            
            const trainingIndex = data.trainingen.findIndex(t => t.id === body.id);
            
            if (trainingIndex === -1) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Training not found' })
                };
            }
            
            if (!STATUS_OPTIONS[body.status]) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid status' })
                };
            }
            
            // Update training
            data.trainingen[trainingIndex].status = body.status;
            data.trainingen[trainingIndex].status_text = STATUS_OPTIONS[body.status];
            data.trainingen[trainingIndex].bijgewerkt_op = new Date().toISOString();
            
            data.lastUpdated = new Date().toISOString();
            saveData(data);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Training status bijgewerkt',
                    training: data.trainingen[trainingIndex] 
                })
            };
        }
        
        // DELETE: Verwijder training
        if (event.httpMethod === 'DELETE') {
            const body = JSON.parse(event.body || '{}');
            
            if (!body.id) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing training id' })
                };
            }
            
            const trainingIndex = data.trainingen.findIndex(t => t.id === body.id);
            
            if (trainingIndex === -1) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Training not found' })
                };
            }
            
            // Verwijder training
            const deletedTraining = data.trainingen.splice(trainingIndex, 1)[0];
            data.lastUpdated = new Date().toISOString();
            saveData(data);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Training verwijderd',
                    training: deletedTraining 
                })
            };
        }
        
        // Method not allowed
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    }
};
