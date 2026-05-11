// Test simple de notification navigateur
console.log('🧪 Test de notification navigateur chargé');

function testerNotificationNavigateur() {
    console.log('🧪 Début du test de notification navigateur...');
    
    // Vérifier le support des notifications
    if (!('Notification' in window)) {
        console.error('❌ Notifications non supportées par ce navigateur');
        alert('Votre navigateur ne supporte pas les notifications');
        return;
    }
    
    console.log('✅ Navigateur supporte les notifications');
    console.log('🔍 Permission actuelle:', Notification.permission);
    
    // Demander la permission si nécessaire
    if (Notification.permission === 'default') {
        console.log('📤 Demande de permission...');
        Notification.requestPermission().then(permission => {
            console.log('✅ Permission obtenue:', permission);
            if (permission === 'granted') {
                envoyerNotificationTest();
            } else {
                console.error('❌ Permission refusée:', permission);
                alert('Permission de notification refusée. Veuillez l\'autoriser dans les paramètres du navigateur.');
            }
        });
    } else if (Notification.permission === 'granted') {
        envoyerNotificationTest();
    } else {
        console.error('❌ Permission déjà refusée:', Notification.permission);
        alert('Notifications bloquées. Veuillez les autoriser dans les paramètres du navigateur.');
    }
}

function envoyerNotificationTest() {
    console.log('📤 Envoi de la notification de test...');
    
    try {
        const notification = new Notification('🧪 TEST - MedReminder Proche', {
            body: 'Test de notification pour le proche - Si vous voyez ceci, les notifications fonctionnent!',
            icon: '/static/images/logo.png',
            requireInteraction: true,
            tag: 'test-proche'
        });
        
        console.log('✅ Notification créée avec succès!');
        
        notification.onclick = () => {
            console.log('🖱️ Notification cliquée');
            notification.close();
        };
        
        notification.onshow = () => {
            console.log('👁️ Notification affichée avec succès!');
        };
        
        notification.onerror = (error) => {
            console.error('❌ Erreur affichage notification:', error);
        };
        
        // Fermer automatiquement après 10 secondes
        setTimeout(() => {
            if (notification.close) {
                notification.close();
                console.log('🔒 Notification fermée automatiquement');
            }
        }, 10000);
        
    } catch (error) {
        console.error('❌ Erreur création notification:', error);
        alert('Erreur lors de la création de la notification: ' + error.message);
    }
}

// Lancer le test après 2 secondes
setTimeout(() => {
    console.log('🚀 Lancement du test de notification...');
    testerNotificationNavigateur();
}, 2000);

// Rendre disponible globalement
window.testerNotificationNavigateur = testerNotificationNavigateur;
