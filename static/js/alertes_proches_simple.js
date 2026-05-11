// Système simple d'alertes proches
console.log('🔔 Système d\'alertes proches simple chargé');

class SimpleProcheAlerts {
    constructor() {
        this.alertesProgrammees = {};
        this.alertesRetard = {};
        
        // Demander la permission de notification
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        // Démarrer la vérification
        this.demarrerVerification();
        console.log('🔔 Système d\'alertes proches démarré');
    }
    
    async demarrerVerification() {
        // Vérifier immédiatement
        await this.verifierAlertes();
        
        // Ensuite vérifier toutes les 30 secondes
        setInterval(() => {
            this.verifierAlertes();
        }, 30000);
    }
    
    async verifierAlertes() {
        try {
            const response = await fetch('/proches/api/verifier-alertes/');
            if (!response.ok) return;
            
            const data = await response.json();
            const maintenant = new Date();
            
            // Traiter les prescriptions imminentes
            if (data.prescriptions_imminentes) {
                for (const presc of data.prescriptions_imminentes) {
                    const id = String(presc.prescription_id);
                    
                    // Calculer si l'heure est arrivée
                    const [heures, minutes] = presc.heure_prevue.split(':').map(Number);
                    const heureAlerte = new Date();
                    heureAlerte.setHours(heures, minutes, 0, 0);
                    
                    const diffMs = maintenant - heureAlerte;
                    const diffMinutes = Math.floor(diffMs / 60000);
                    
                    // Si l'heure est arrivée et pas encore notifié
                    if (diffMinutes >= 0 && !this.alertesProgrammees[id]) {
                        this.envoyerNotificationPrise(presc);
                        this.programmerAlerteRetard(presc);
                        this.alertesProgrammees[id] = true;
                    }
                }
            }
            
            // Traiter les alertes de retard
            if (data.alertes_retard) {
                for (const alerte of data.alertes_retard) {
                    const id = String(alerte.prescription_id);
                    
                    // Si pas encore en alerte de retard
                    if (!this.alertesRetard[id]) {
                        this.envoyerAlerteRetard(alerte);
                        this.alertesRetard[id] = true;
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Erreur vérification alertes proches:', error);
        }
    }
    
    envoyerNotificationPrise(presc) {
        console.log(`📢 NOTIFICATION PRISE: ${presc.patient} doit prendre ${presc.medicament}`);
        
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('⏰ MedReminder - Prise Médicament', {
                body: `${presc.patient} doit prendre ${presc.medicament} maintenant (${presc.heure_prevue})`,
                icon: '/static/images/logo.png',
                requireInteraction: true
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }
    }
    
    programmerAlerteRetard(presc) {
        const id = String(presc.prescription_id);
        
        // Programmer l'alerte de retard après 5 minutes
        setTimeout(() => {
            this.verifierEtEnvoyerRetard(presc);
            // Répéter chaque minute
            setInterval(() => {
                this.verifierEtEnvoyerRetard(presc);
            }, 60000);
        }, 5 * 60 * 1000); // 5 minutes
    }
    
    async verifierEtEnvoyerRetard(presc) {
        try {
            const response = await fetch('/proches/api/verifier-alertes/');
            if (!response.ok) return;
            
            const data = await response.json();
            const alerte = (data.alertes_retard || []).find(a => String(a.prescription_id) === String(presc.prescription_id));
            
            if (alerte) {
                this.envoyerAlerteRetard(alerte);
            }
        } catch (error) {
            // En cas d'erreur, envoyer quand même l'alerte
            const alerteTest = {
                prescription_id: presc.prescription_id,
                patient: presc.patient,
                medicament: presc.medicament,
                retard_minutes: 5,
                heure_prevue: presc.heure_prevue
            };
            this.envoyerAlerteRetard(alerteTest);
        }
    }
    
    envoyerAlerteRetard(alerte) {
        console.log(`🚨 ALERTE RETARD: ${alerte.patient} - ${alerte.medicament} - ${alerte.retard_minutes}min`);
        
        // Jouer le son
        const audio = new Audio('/static/sounds/retard.mp3');
        audio.volume = 1.0;
        audio.play().catch(e => console.warn('⚠️ Impossible de jouer le son:', e));
        
        // Envoyer la notification
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('🚨 MedReminder - RETARD', {
                body: `${alerte.patient} n\'a pas pris ${alerte.medicament} (retard: ${alerte.retard_minutes} min)`,
                icon: '/static/images/logo.png',
                requireInteraction: true
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }
    }
}

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    window.simpleProcheAlerts = new SimpleProcheAlerts();
});
