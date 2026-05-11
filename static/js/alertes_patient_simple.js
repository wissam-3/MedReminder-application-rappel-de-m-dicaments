// Version simplifiée et corrigée pour tester l'alarme
console.log('🔔 Chargement du système d\'alerte patient (version simple)');

// Fonction de test d'alarme complète
function testerAlarmeComplete() {
    console.log('🚨 Test d\'alarme complet démarré...');
    
    // Demander la permission de notification si nécessaire
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('✅ Permission notification accordée');
            }
        });
    }
    
    // Jouer le son une seule fois
    const audio = new Audio('/static/sounds/rappel.mp3');
    audio.volume = 1.0;
    audio.currentTime = 0;
    
    audio.play().then(() => {
        console.log('🔊 Son d\'alarme joué avec succès');
    }).catch(error => {
        console.error('❌ Erreur son:', error);
        alert('⚠️ Veuillez cliquer sur la page puis réessayer - l\'audio doit être débloqué par une interaction utilisateur');
    });
    
    // Afficher une notification navigateur
    if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification("C'est l'heure de prendre le médicament", {
            body: "TEST ALARME - Médicament de test (Doliprane)",
            icon: '/static/images/logo.png',
            tag: 'test-alarme',
            requireInteraction: true
        });
        
        notif.onclick = () => { 
            window.focus(); 
            notif.close();
        };
        
        // Fermer automatiquement après 10 secondes
        setTimeout(() => notif.close(), 10000);
    }
    
    // Afficher un bandeau d'alerte
    let bandeau = document.getElementById('bandeau-alerte');
    if (!bandeau) {
        bandeau = document.createElement('div');
        bandeau.id = 'bandeau-alerte';
        bandeau.className = 'alert alert-warning text-center';
        bandeau.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 1000; min-width: 300px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);';
        document.body.appendChild(bandeau);
    }
    
    bandeau.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>⏰ <strong>TEST ALARME</strong> — Doliprane (10:00)</div>
            <div class="d-flex gap-2">
                <button type="button" class="btn btn-success btn-sm" onclick="this.closest('.alert').style.display='none'">
                    <i class="fas fa-check"></i> Valider
                </button>
                <button type="button" class="btn-close" onclick="this.closest('.alert').style.display='none'"></button>
            </div>
        </div>
    `;
    bandeau.style.display = 'block';
    
    // Masquer après 15 secondes
    setTimeout(() => {
        if (bandeau) bandeau.style.display = 'none';
    }, 15000);
    
    console.log('✅ Test d\'alarme terminé - vous devriez entendre 1 son et voir une notification');
}

// Rendre la fonction accessible globalement
window.testerAlarmeComplete = testerAlarmeComplete;

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔔 Système d\'alerte patient initialisé (version simple)');
});
