// Script de test pour les notifications proches
console.log('🧪 Test notifications proches chargé');

// Test immédiat
function testNotificationProche() {
    console.log('🧪 Test notification proche...');
    
    // Demander la permission si nécessaire
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                envoyerTestNotification();
            }
        });
    } else if ('Notification' in window && Notification.permission === 'granted') {
        envoyerTestNotification();
    } else {
        console.error('❌ Notifications non supportées ou permission refusée');
    }
}

function envoyerTestNotification() {
    const notification = new Notification('🧪 TEST - MedReminder', {
        body: 'Test de notification pour le proche',
        icon: '/static/images/logo.png',
        requireInteraction: true
    });
    
    notification.onclick = () => {
        console.log('✅ Notification cliquée');
        notification.close();
    };
    
    console.log('✅ Notification de test envoyée');
}

// Test toutes les 10 secondes
setInterval(() => {
    console.log('🧪 Test périodique...');
    testNotificationProche();
}, 10000);

// Lancer le premier test après 2 secondes
setTimeout(testNotificationProche, 2000);

// Rendre disponible globalement
window.testNotificationProche = testNotificationProche;
