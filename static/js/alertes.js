// =====================================================
// MedReminder - Alertes Sonores (MP3)
// =====================================================

class MedReminderAlerts {
    constructor() {
        this.checkInterval = null;
        // Mémoriser les alertes déjà sonnées pour éviter la répétition
        // Clé = prescription_id + date, valeur = timestamp de la dernière alerte
        this.alertesSonnees = {};
        // Délai minimum entre deux sonneries pour la même prescription (1 minute)
        this.delaiRepetition = 60 * 1000;
        
        // Charger les fichiers audios
        this.audioRappel = new Audio('/static/sounds/rappel.mp3');
        this.audioValidation = new Audio('/static/sounds/validation.mp3');
        this.audioRetard = new Audio('/static/sounds/retard.mp3');
        
        this.audioContextUnlocked = false;

        this.initAudio();
        this.demanderPermissionNotification();
        this.startMonitoring();
    }

    // Débloquer l'audio après la première interaction utilisateur
    initAudio() {
        // Forcer le volume au maximum (1.0)
        this.audioRappel.volume = 1.0;
        this.audioValidation.volume = 1.0;
        this.audioRetard.volume = 1.0;

        const activerAudio = () => {
            if (!this.audioContextUnlocked) {
                // Charger explicitement les audios après le clic
                this.audioRappel.load();
                this.audioValidation.load();
                this.audioRetard.load();
                
                this.audioContextUnlocked = true;
                console.log('🔊 Audio MP3 débloqué avec succès et volume au maximum');
            }
            // On enlève le listener après le premier clic
            document.removeEventListener('click', activerAudio);
            document.removeEventListener('touchstart', activerAudio);
        };

        document.addEventListener('click', activerAudio);
        document.addEventListener('touchstart', activerAudio);
    }

    // Demander la permission pour les notifications navigateur
    demanderPermissionNotification() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(perm => {
                console.log('Permission notifications:', perm);
            });
        }
    }

    // =========================================
    // LECTURE DES SONS MP3
    // =========================================

    jouerRappel() {
        if (this.audioContextUnlocked) {
            this.audioRappel.currentTime = 0;
            this.audioRappel.play().catch(e => console.warn('Impossible de jouer rappel.mp3', e));
        } else {
            console.warn('⚠️ Audio bloqué - cliquez d\'abord sur la page');
        }
    }

    jouerValidation() {
        if (this.audioContextUnlocked) {
            this.audioValidation.currentTime = 0;
            this.audioValidation.play().catch(e => console.warn('Impossible de jouer validation.mp3', e));
        }
    }

    jouerRetard() {
        if (this.audioContextUnlocked) {
            this.audioRetard.currentTime = 0;
            this.audioRetard.play().catch(e => console.warn('Impossible de jouer retard.mp3', e));
        }
    }

    // =========================================
    // AFFICHAGE BANDEAU D'ALERTE
    // =========================================

    afficherBandeau(message, type = 'warning') {
        const bandeau = document.getElementById('bandeau-alerte');
        const messageSpan = document.getElementById('message-alerte');
        
        if (bandeau && messageSpan) {
            messageSpan.innerHTML = message;
            bandeau.style.display = 'block';
            bandeau.style.position = 'fixed';
            bandeau.style.top = '20px';
            bandeau.style.left = '50%';
            bandeau.style.transform = 'translateX(-50%)';
            bandeau.style.zIndex = '9999';
            bandeau.style.minWidth = '350px';
            bandeau.style.maxWidth = '600px';
            bandeau.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
            bandeau.className = `alert alert-${type} text-center`;
            
            // Auto-masquer après 15 secondes
            clearTimeout(this._bandeauTimeout);
            this._bandeauTimeout = setTimeout(() => {
                bandeau.style.display = 'none';
            }, 15000);
        }
    }

    // Notification système du navigateur
    afficherNotification(titre, message, type = 'info') {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(titre, {
                    body: message,
                    icon: '/static/images/logo.png',
                    tag: `medreminder-${type}`,
                    requireInteraction: type === 'retard'
                });
            } catch (e) {
                console.warn('Notification impossible:', e);
            }
        }
    }

    // =========================================
    // VÉRIFICATION DES PRISES
    // =========================================

    // Générer une clé unique pour une alerte
    cléAlerte(prescriptionId, type) {
        // Ex: "4-rappel" ou "4-retard" (pour que le retard puisse sonner même si le rappel a sonné y a 1 min)
        return `${prescriptionId}-${type}`;
    }

    // Vérifier si cette alerte a déjà sonné récemment (dans la dernière minute)
    dejaJouee(prescriptionId, type) {
        const clé = this.cléAlerte(prescriptionId, type);
        const dernierSon = this.alertesSonnees[clé];
        if (!dernierSon) return false;
        return (Date.now() - dernierSon) < this.delaiRepetition;
    }

    // Marquer une alerte comme jouée
    marquerJouee(prescriptionId, type) {
        const clé = this.cléAlerte(prescriptionId, type);
        this.alertesSonnees[clé] = Date.now();
    }

    // Appel API pour vérifier les prises
    async verifierPrises() {
        try {
            const response = await fetch('/patients/api/verifier-prises/');
            if (!response.ok) return;
            const data = await response.json();
            
            if (data.error) return;

            // --- Alertes immédiates (rappel toutes les minutes) ---
            if (data.alertes_immediates && data.alertes_immediates.length > 0) {
                let nouvelleAlerte = false;
                const messages = [];

                data.alertes_immediates.forEach(alerte => {
                    if (!this.dejaJouee(alerte.prescription_id, 'rappel')) {
                        nouvelleAlerte = true;
                        this.marquerJouee(alerte.prescription_id, 'rappel');
                        messages.push(`💊 <strong>${alerte.medicament}</strong> (${alerte.dose}) à ${alerte.heure_prevue}`);
                        console.log(`🔔 RAPPEL SONORE : ${alerte.medicament} à ${alerte.heure_prevue}`);
                    }
                });

                if (nouvelleAlerte) {
                    this.jouerRappel();
                    this.afficherBandeau(
                        `<i class="fas fa-bell me-2"></i> Il est l'heure de prendre :<br>${messages.join('<br>')}`,
                        'warning'
                    );
                    this.afficherNotification(
                        '💊 MedReminder - Rappel médicament',
                        messages.map(m => m.replace(/<[^>]+>/g, '')).join(', '),
                        'rappel'
                    );
                }
            }

            // --- Alertes de retard ---
            if (data.alertes_retard && data.alertes_retard.length > 0) {
                let nouvelRetard = false;
                const messages = [];

                data.alertes_retard.forEach(alerte => {
                    if (!this.dejaJouee(alerte.prescription_id, 'retard')) {
                        nouvelRetard = true;
                        this.marquerJouee(alerte.prescription_id, 'retard');
                        messages.push(`⏰ <strong>${alerte.medicament}</strong> : ${alerte.retard} min de retard`);
                        console.log(`⚠️ RETARD : ${alerte.medicament} - ${alerte.retard} min`);
                    }
                });

                if (nouvelRetard) {
                    this.jouerRetard();
                    this.afficherBandeau(
                        `<i class="fas fa-triangle-exclamation me-2"></i> Médicament(s) en retard (> 5 min) :<br>${messages.join('<br>')}`,
                        'danger'
                    );
                    this.afficherNotification(
                        '⚠️ MedReminder - Médicament en retard !',
                        messages.map(m => m.replace(/<[^>]+>/g, '')).join(', '),
                        'retard'
                    );
                }
            }

        } catch (error) {
            console.error('Erreur vérification prises:', error);
        }
    }

    // =========================================
    // DÉMARRAGE / ARRÊT
    // =========================================

    startMonitoring() {
        console.log('🩺 MedReminder : surveillance démarrée (vérification toutes les 30s)');
        // Première vérification après 2 secondes (laisser la page charger)
        setTimeout(() => this.verifierPrises(), 2000);
        // Puis toutes les 30 secondes
        this.checkInterval = setInterval(() => this.verifierPrises(), 30000);
    }

    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            console.log('🩺 MedReminder : surveillance arrêtée');
        }
    }
}

// =====================================================
// Initialisation au chargement de la page
// =====================================================
let reminder = null;

document.addEventListener('DOMContentLoaded', () => {
    reminder = new MedReminderAlerts();
    console.log('✅ MedReminder Alertes chargé');
});

// Son de validation quand le patient clique "Valider la prise"
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-valider') || e.target.closest('.btn-valider-prise')) {
        // Jouer le son de validation immédiatement
        if (reminder) reminder.jouerValidation();
    }
});