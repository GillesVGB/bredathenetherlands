document.addEventListener('DOMContentLoaded', function() {
  // Toon huidige datum
  const now = new Date();
  const dateElement = document.getElementById('current-date');
  if (dateElement) {
    dateElement.textContent = now.toLocaleDateString('nl-BE');
  }

  // Laad echte trainingen
  loadRealTrainings();
});

async function loadRealTrainings() {
  // Check of we op home pagina zijn
  const homeTrainingList = document.getElementById('training-list');
  const trainingenPageList = document.getElementById('trainings-list');
  
  const container = homeTrainingList || trainingenPageList;
  if (!container) return;
  
  try {
    container.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Trainingen laden vanaf server...</p>';
    
    // Haal trainingen op van NETLIFY FUNCTION
    const response = await fetch('https://bredathenetherlands.netlify.app/.netlify/functions/add-training');
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const trainingen = await response.json();
    
    if (!trainingen || trainingen.length === 0) {
      container.innerHTML = '<p>🎯 Er zijn nog geen trainingen gepland via Discord.</p>';
      container.innerHTML += '<p><small>Gebruik <code>/training</code> in Discord om er een toe te voegen!</small></p>';
      return;
    }
    
    // Sorteer op datum (nieuwste eerst)
    const gesorteerd = trainingen.sort((a, b) => {
      try {
        const [dagA, maandA, jaarA] = a.datum.split('/').map(Number);
        const [dagB, maandB, jaarB] = b.datum.split('/').map(Number);
        const dateA = new Date(jaarA, maandA - 1, dagA);
        const dateB = new Date(jaarB, maandB - 1, dagB);
        return dateB - dateA; // Nieuwste eerst
      } catch {
        return 0;
      }
    });
    
    // Toon trainingen
    container.innerHTML = '';
    gesorteerd.forEach(training => {
      const card = document.createElement('div');
      card.className = 'training-card';
      
      const isHomePage = !!homeTrainingList;
      
      if (isHomePage) {
        // Compact voor home
        card.innerHTML = `
          <h4><i class="fas fa-graduation-cap"></i> ${training.onderwerp}</h4>
          <p><i class="far fa-calendar"></i> <strong>${training.datum}</strong> om <strong>${training.tijd}</strong></p>
          <p><i class="fas fa-user"></i> ${training.trainer}</p>
          ${training.van_discord ? '<span class="discord-badge"><i class="fab fa-discord"></i> Van Discord</span>' : ''}
        `;
      } else {
        // Gedetailleerd voor trainingen pagina
        card.innerHTML = `
          <h3><i class="fas fa-graduation-cap"></i> ${training.onderwerp}</h3>
          <div class="training-details">
            <p><i class="far fa-calendar"></i> <strong>Datum:</strong> ${training.datum}</p>
            <p><i class="far fa-clock"></i> <strong>Tijd:</strong> ${training.tijd}</p>
            <p><i class="fas fa-user"></i> <strong>Trainer:</strong> ${training.trainer}</p>
            ${training.toegevoegd_door ? `<p><i class="fas fa-user-plus"></i> <strong>Toegevoegd door:</strong> ${training.toegevoegd_door}</p>` : ''}
            ${training.discord_guild ? `<p><i class="fas fa-server"></i> <strong>Server:</strong> ${training.discord_guild}</p>` : ''}
            <p><i class="far fa-clock"></i> <strong>Aangemaakt:</strong> ${new Date(training.aangemaakt).toLocaleString('nl-BE')}</p>
          </div>
          ${training.van_discord ? '<div class="discord-source"><i class="fab fa-discord"></i> Toegevoegd via Discord bot</div>' : ''}
        `;
      }
      
      container.appendChild(card);
    });
    
    // Update teller
    const weeklyElement = document.getElementById('weekly-trainings');
    if (weeklyElement) {
      const nu = new Date();
      const volgendeWeek = new Date(nu.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const dezeWeek = trainingen.filter(t => {
        try {
          const [dag, maand, jaar] = t.datum.split('/').map(Number);
          const datum = new Date(jaar, maand - 1, dag);
          return datum >= nu && datum <= volgendeWeek;
        } catch {
          return false;
        }
      }).length;
      
      weeklyElement.textContent = dezeWeek;
    }
    
    console.log('✅ Trainingen geladen:', trainingen.length);
    
  } catch (error) {
    console.error('❌ Fout bij laden trainingen:', error);
    container.innerHTML = `
      <div class="error">
        <p><i class="fas fa-exclamation-triangle"></i> Kon trainingen niet laden.</p>
        <p><small>Fout: ${error.message}</small></p>
        <button onclick="location.reload()">🔄 Probeer opnieuw</button>
      </div>
    `;
  }
}

// Auto-refresh elke 30 seconden
setInterval(loadRealTrainings, 30000);
