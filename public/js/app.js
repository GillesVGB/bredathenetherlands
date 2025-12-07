// Toon huidige datum
document.addEventListener('DOMContentLoaded', function() {
    // Huidige datum
    const now = new Date();
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    document.getElementById('current-date').textContent = now.toLocaleDateString('nl-BE', options);
    
    // Simuleer trainingen laden
    setTimeout(() => {
        document.getElementById('training-list').innerHTML = `
            <div class="training-item">
                <h3><i class="fas fa-user-tie"></i> Politie Basis Training</h3>
                <p><i class="far fa-calendar"></i> 10/12/2025 | <i class="far fa-clock"></i> 20:00</p>
                <p><i class="fas fa-user"></i> Trainer: John_Doe</p>
            </div>
            <div class="training-item">
                <h3><i class="fas fa-ambulance"></i> EHBO Gevorderd</h3>
                <p><i class="far fa-calendar"></i> 12/12/2025 | <i class="far fa-clock"></i> 19:30</p>
                <p><i class="fas fa-user"></i> Trainer: Medic_Sarah</p>
            </div>
            <div class="training-item">
                <h3><i class="fas fa-balance-scale"></i> Rechter & Advocatuur</h3>
                <p><i class="far fa-calendar"></i> 15/12/2025 | <i class="far fa-clock"></i> 21:00</p>
                <p><i class="fas fa-user"></i> Trainer: Mr_Justice</p>
            </div>
        `;
    }, 1000);
});