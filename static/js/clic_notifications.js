// Script pour détecter le clic sur le bouton de notifications
console.log('🔔 Script de détection du clic sur notifications chargé');

function detecterClicNotifications() {
    console.log('🔔 Démarrage de la détection du clic sur notifications...');
    
    // Détecter le clic sur le bouton de notifications
    document.addEventListener('click', function(event) {
        const boutonNotifications = event.target.closest('.notification-bell, .notification-icon, [title*="notification"], [aria-label*="notification"]');
        
        if (boutonNotifications) {
            console.log('🔔 Clic détecté sur le bouton de notifications!');
            
            // Afficher le panneau d'alertes proches
            if (window.procheAlertsWithPanel) {
                window.procheAlertsWithPanel.afficherPanneau();
                console.log('✅ Panneau d\'alertes affiché suite au clic sur notifications');
            } else {
                console.warn('⚠️ Système d\'alertes proches non disponible');
            }
        }
    }, true); // true pour capturer les clics pendant la phase de capture
    
    // Alternative : observer les changements dans le DOM
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Vérifier si des éléments de notification sont ajoutés
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        const notificationElements = node.querySelectorAll('.notification, .alert, [class*="notification"]');
                        if (notificationElements.length > 0) {
                            console.log('🔔 Éléments de notification détectés dans le DOM');
                            if (window.procheAlertsWithPanel) {
                                window.procheAlertsWithPanel.afficherPanneau();
                            }
                        }
                    }
                });
            }
        });
    });
    
    // Observer le body pour les changements
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('✅ Détection du clic sur notifications initialisée');
}

// Initialiser quand le DOM est chargé
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detecterClicNotifications);
} else {
    detecterClicNotifications();
}

// Rendre disponible globalement
window.detecterClicNotifications = detecterClicNotifications;
