// Système d'alertes automatiques pour les patients
console.log('🔔 Chargement du système d\'alertes automatiques patient');

class MedReminderAutoAlerts {
    constructor() {
        this.alertesActives = {};
        this.intervalCheck = null;
        
        // Initialiser l'audio
        this.initAudio();
        
        // Démarrer la vérification automatique
        this.demarrerVerificationAutomatique();
        
        console.log('🔔 Système d\'alertes automatiques initialisé');
    }
    
    initAudio() {
        // Précharger l'audio pour éviter les blocages
        this.audioRappel = new Audio('/static/sounds/rappel.mp3');
        this.audioRappel.volume = 1.0;
        this.audioRappel.load();
        
        // Débloquer l'audio au premier clic
        const debloquerAudio = () => {
            this.audioRappel.play().catch(() => {}).then(() => {
                this.audioRappel.pause();
                this.audioRappel.currentTime = 0;
            });
            document.removeEventListener('click', debloquerAudio);
            document.removeEventListener('touchstart', debloquerAudio);
        };
        
        document.addEventListener('click', debloquerAudio);
        document.addEventListener('touchstart', debloquerAudio);
    }
    
    async demarrerVerificationAutomatique() {
        // Vérifier immédiatement au chargement
        await this.verifierAlertes();
        
        // Ensuite vérifier toutes les 30 secondes
        this.intervalCheck = setInterval(() => {
            this.verifierAlertes();
        }, 30000);
        
        console.log('🔔 Vérification automatique démarrée (toutes les 30 secondes)');
    }
    
    async verifierAlertes() {
        try {
            const response = await fetch('/api/patients/mes-alertes/', {
                headers: { 'X-CSRFToken': this.getCSRFToken() }
            });
            
            if (!response.ok) return;
            
            const data = await response.json();
            const maintenant = new Date();
            
            // Parcourir toutes les alertes
            for (const alerte of data.alertes) {
                const id = String(alerte.prescription_id);
                
                // Calculer si l'heure est arrivée
                const [heures, minutes] = alerte.heure_prevue.split(':').map(Number);
                const heureAlerte = new Date();
                heureAlerte.setHours(heures, minutes, 0, 0);
                
                const diffMs = maintenant - heureAlerte;
                const diffMinutes = Math.floor(diffMs / 60000);
                
                // Si l'heure est passée (ou dans la minute) et non encore alertée
                if (diffMinutes >= 0 && !this.alertesActives[id]) {
                    this.declencherAlerte(alerte);
                }
            }
            
        } catch (error) {
            console.error('❌ Erreur vérification alertes:', error);
        }
    }
    
    declencherAlerte(alerte) {
        const id = String(alerte.prescription_id);
        const retard = alerte.retard_minutes || 0;
        
        console.log(`🚨 ALERTE AUTOMATIQUE: ${alerte.medicament_nom} à ${alerte.heure_prevue}`);
        
        // Marquer comme alertée
        this.alertesActives[id] = true;
        
        // Jouer le son
        this.jouerSonAlarme();
        
        // Afficher la notification
        this.afficherNotification(alerte.medicament_nom, alerte.heure_prevue, retard, alerte.prescription_id);
        
        // Afficher le bandeau
        this.afficherBandeau(alerte.medicament_nom, alerte.heure_prevue, retard, alerte.prescription_id);
        
        // Programmer la répétition toutes les 2 minutes
        this.intervalTimers[id] = setInterval(() => {
            this.verifierEtRepeter(id, alerte);
        }, 120000);
        
        console.log(`✅ Alerte automatique déclenchée pour: ${alerte.medicament_nom}`);
    }
    
    jouerSonAlarme() {
        this.audioRappel.currentTime = 0;
        this.audioRappel.play().catch(error => {
            console.warn('⚠️ Impossible de jouer le son:', error);
        });
    }
    
    afficherNotification(medicament, heure, retard_minutes = 0, prescription_id = null) {
        const titre = "C'est l'heure de prendre le médicament";
        const message = `${medicament} - Prévu à ${heure}${retard_minutes > 0 ? ` (Retard: ${retard_minutes} min)` : ''}`;
        
        if ('Notification' in window && Notification.permission === 'granted') {
            const notif = new Notification(titre, {
                body: message,
                icon: '/static/images/logo.png',
                tag: `med-${medicament}`,
                requireInteraction: true,
                actions: prescription_id ? [
                    {
                        action: 'validate',
                        title: '✅ Valider la prise'
                    }
                ] : []
            });
            
            notif.onclick = () => { 
                window.focus(); 
                notif.close();
            };
        }
    }
    
    afficherBandeau(medicament, heure, retard_minutes = 0, prescription_id = null) {
        let bandeau = document.getElementById('bandeau-alerte');
        if (!bandeau) {
            bandeau = document.createElement('div');
            bandeau.id = 'bandeau-alerte';
            bandeau.className = 'alert alert-warning text-center';
            bandeau.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 1000; min-width: 300px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);';
            document.body.appendChild(bandeau);
        }
        
        const icon = retard_minutes > 0 ? '🚨' : '⏰';
        const label = retard_minutes > 0
            ? `<strong>RETARD ${retard_minutes} min</strong> — ${medicament}`
            : `<strong>RAPPEL</strong> — ${medicament} (${heure})`;
        
        bandeau.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>${icon} ${label}</div>
                <div class="d-flex gap-2">
                    ${prescription_id ? `
                        <button type="button" class="btn btn-success btn-sm" 
                            onclick="window.medReminderAuto.confirmerPrise(${prescription_id})">
                            <i class="fas fa-check"></i> Valider
                        </button>
                    ` : ''}
                    <button type="button" class="btn-close" style="font-size:.8rem;"
                        onclick="document.getElementById('bandeau-alerte').style.display='none'"></button>
                </div>
            </div>
        `;
        bandeau.style.display = 'block';
    }
    
    async verifierEtRepeter(id, alerteInitiale) {
        try {
            const response = await fetch('/api/patients/mes-alertes/', {
                headers: { 'X-CSRFToken': this.getCSRFToken() }
            });
            
            if (!response.ok) return;
            
            const data = await response.json();
            const alerte = data.alertes.find(a => String(a.prescription_id) === id);
            
            if (!alerte) {
                // Prescription validée -> arrêter les alertes
                this.arreterAlerte(id);
            } else {
                // Toujours en attente -> répéter l'alerte
                this.jouerSonAlarme();
                this.afficherNotification(alerte.medicament_nom, alerte.heure_prevue, alerte.retard_minutes, alerte.prescription_id);
            }
        } catch (error) {
            // En cas d'erreur, répéter quand même
            this.jouerSonAlarme();
            this.afficherNotification(alerteInitiale.medicament_nom, alerteInitiale.heure_prevue, alerteInitiale.retard_minutes, alerteInitiale.prescription_id);
        }
    }
    
    async confirmerPrise(prescriptionId) {
        try {
            const response = await fetch('/api/patients/confirmer-prise/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ prescription_id: prescriptionId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.arreterAlerte(String(prescriptionId));
                
                // Masquer le bandeau
                const bandeau = document.getElementById('bandeau-alerte');
                if (bandeau) bandeau.style.display = 'none';
                
                console.log('✅ Prise confirmée et alerte arrêtée');
            }
        } catch (error) {
            console.error('❌ Erreur confirmation prise:', error);
        }
    }
    
    arreterAlerte(id) {
        if (this.intervalTimers && this.intervalTimers[id]) {
            clearInterval(this.intervalTimers[id]);
            delete this.intervalTimers[id];
        }
        delete this.alertesActives[id];
        console.log(`✅ Alerte arrêtée pour prescription ${id}`);
    }
    
    getCSRFToken() {
        const name = 'csrftoken';
        if (document.cookie) {
            for (const cookie of document.cookie.split(';')) {
                const c = cookie.trim();
                if (c.startsWith(name + '=')) {
                    return decodeURIComponent(c.substring(name.length + 1));
                }
            }
        }
        return '';
    }
    
    stop() {
        if (this.intervalCheck) {
            clearInterval(this.intervalCheck);
        }
        Object.keys(this.alertesActives).forEach(id => this.arreterAlerte(id));
    }
}

// Initialiser automatiquement au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    // Demander la permission de notification
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Démarrer le système d'alertes automatiques
    window.medReminderAuto = new MedReminderAutoAlerts();
});
