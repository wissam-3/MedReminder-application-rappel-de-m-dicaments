// Script de test pour l'alarme - à exécuter dans la console du navigateur
console.log('🔔 Test de l\'alarme médicament');

// Test 1: Vérifier si l'audio peut être joué
function testerAudio() {
    console.log('🎵 Test audio...');
    
    // Créer un objet audio pour le test
    const audio = new Audio('/static/sounds/rappel.mp3');
    audio.volume = 1.0;
    
    // Essayer de jouer le son
    audio.play().then(() => {
        console.log('✅ Audio joué avec succès!');
    }).catch(error => {
        console.error('❌ Erreur audio:', error);
        console.log('💡 Solution: Cliquez n\'importe où sur la page pour débloquer l\'audio');
    });
}

// Test 2: Forcer une alarme immédiate
function forcerAlarme() {
    console.log('🚨 Forçage d\'une alarme immédiate...');
    
    // Jouer le son 3 fois
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const audio = new Audio('/static/sounds/rappel.mp3');
            audio.volume = 1.0;
            audio.play().catch(e => console.warn('Erreur lecture audio:', e));
            console.log(`🔊 Son joué (${i+1}/3)`);
        }, i * 1000);
    }
    
    // Afficher une notification
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification("C'est l'heure de prendre le médicament", {
            body: "Test d'alarme - Médicament de test",
            icon: '/static/images/logo.png',
            requireInteraction: true
        });
    } else if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification("C'est l'heure de prendre le médicament", {
                    body: "Test d'alarme - Médicament de test",
                    icon: '/static/images/logo.png',
                    requireInteraction: true
                });
            }
        });
    }
    
    // Afficher un bandeau d'alerte
    let bandeau = document.getElementById('bandeau-alerte-test');
    if (!bandeau) {
        bandeau = document.createElement('div');
        bandeau.id = 'bandeau-alerte-test';
        bandeau.style.cssText = [
            'position:fixed', 'top:20px', 'left:50%', 'transform:translateX(-50%)',
            'z-index:9999', 'min-width:340px', 'max-width:90vw',
            'border-radius:12px', 'padding:14px 20px', 'font-size:1rem',
            'box-shadow:0 6px 24px rgba(0,0,0,0.30)', 'background:#ffc107', 'color:#000'
        ].join(';');
        document.body.appendChild(bandeau);
    }
    
    bandeau.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>⏰ <strong>TEST ALARME</strong> — Médicament de test</div>
            <button type="button" class="btn btn-danger btn-sm" onclick="document.getElementById('bandeau-alerte-test').style.display='none'">
                Arrêter
            </button>
        </div>
    `;
    bandeau.style.display = 'block';
    
    // Auto-masquer après 10 secondes
    setTimeout(() => {
        if (bandeau) bandeau.style.display = 'none';
    }, 10000);
}

// Lancer les tests
console.log('🧪 Démarrage des tests...');
setTimeout(testerAudio, 1000);
setTimeout(forcerAlarme, 2000);

console.log('📝 Instructions:');
console.log('1. Si vous n\'entendez rien, cliquez sur la page puis relancez testerAudio()');
console.log('2. Pour tester l\'alarme complète, exécutez: forcerAlarme()');
console.log('3. Vérifiez la console pour les messages d\'erreur');
