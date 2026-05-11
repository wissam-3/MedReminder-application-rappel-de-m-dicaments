// =====================================================
// MedReminder - Alertes Sonores & Visuelles (Patient)
// VERSION PRÉCISE : alerte à l'heure EXACTE
// =====================================================

class MedReminderPatientAlerts {
    constructor() {
        this.timers = {};           // timers pour chaque prescription (déclenchement exact)
        this.intervalTimers = {};   // intervals de répétition chaque minute
        this.alertesActives = {};   // état des alertes actives

        // Charger les fichiers audio
        this.audioRappel = new Audio('/static/sounds/rappel.mp3');
        this.audioValidation = new Audio('/static/sounds/validation.mp3');
        this.audioContextUnlocked = false;

        this.initAudio();
        this.demanderPermissionNotification();

        // Charger les prescriptions depuis la page et programmer les alertes précises
        this.chargerEtProgrammerAlertes();

        // Vérification périodique FRÉQUENTE pour détecter immédiatement les alertes
        // Toutes les 5 secondes pour une détection rapide
        setInterval(() => this.chargerEtProgrammerAlertes(), 5000);

        // Vérification haute précision toutes les secondes pour les alertes imminentes
        setInterval(() => this.verifierAlertesImminentes(), 1000);
    }
    }

    // ─── AUDIO ────────────────────────────────────────────────────────────────

    initAudio() {
        this.audioRappel.volume = 1.0;
        this.audioValidation.volume = 0.8;

        const activerAudio = () => {
            if (!this.audioContextUnlocked) {
                this.audioRappel.load();
                this.audioValidation.load();
                this.audioContextUnlocked = true;
                console.log('🔊 Audio débloqué pour les alertes patient');
            }
            document.removeEventListener('click', activerAudio);
            document.removeEventListener('touchstart', activerAudio);
        };

        document.addEventListener('click', activerAudio);
        document.addEventListener('touchstart', activerAudio);
    }

    jouerRappel() {
        if (this.audioContextUnlocked) {
            this.audioRappel.currentTime = 0;
            this.audioRappel.play().catch(e => console.warn('Impossible de jouer rappel.mp3 :', e));
        } else {
            console.warn('⚠️ Audio bloqué – cliquez une fois sur la page d\'abord');
        }
    }

    jouerValidation() {
        if (this.audioContextUnlocked) {
            this.audioValidation.currentTime = 0;
            this.audioValidation.play().catch(e => console.warn('Impossible de jouer validation.mp3 :', e));
        }
    }

    // ─── NOTIFICATIONS ────────────────────────────────────────────────────────

    demanderPermissionNotification() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
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
            
            if (prescription_id) {
                notif.onclose = () => {
                    // Fermer la notification manuellement ne stoppe pas les alertes
                    console.log('Notification fermée manuellement - les alertes continuent');
                };
            }
        }
    }

    afficherBandeau(medicament, heure, retard_minutes = 0, prescription_id = null) {
        let bandeau = document.getElementById('bandeau-alerte');
        if (!bandeau) {
            bandeau = document.createElement('div');
            bandeau.id = 'bandeau-alerte';
            bandeau.style.cssText = [
                'position:fixed', 'top:20px', 'left:50%', 'transform:translateX(-50%)',
                'z-index:9999', 'min-width:340px', 'max-width:90vw',
                'border-radius:12px', 'padding:14px 20px', 'font-size:1rem',
                'box-shadow:0 6px 24px rgba(0,0,0,0.30)', 'display:none'
            ].join(';');
            document.body.appendChild(bandeau);
        }

        const icon  = retard_minutes > 0 ? '🚨' : '⏰';
        const label = retard_minutes > 0
            ? `<strong>RETARD ${retard_minutes} min</strong> — ${medicament}`
            : `<strong>RAPPEL</strong> — ${medicament} (${heure})`;

        bandeau.className = `alert ${retard_minutes > 0 ? 'alert-danger' : 'alert-warning'} text-center mb-0`;
        bandeau.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>${icon} ${label}</div>
                <div class="d-flex gap-2">
                    ${prescription_id ? `
                        <button type="button" class="btn btn-success btn-sm" 
                            onclick="window.medReminderAlerts.confirmerPrise(${prescription_id})">
                            <i class="fas fa-check"></i> Valider
                        </button>
                    ` : ''}
                    <button type="button" class="btn-close" style="font-size:.8rem;"
                        onclick="document.getElementById('bandeau-alerte').style.display='none'"></button>
                </div>
            </div>
        `;
        bandeau.style.display = 'block';

        // Ne pas fermer automatiquement : l'alerte reste jusqu'à validation
    }

    // ─── PROGRAMMATION PRÉCISE ────────────────────────────────────────────────

    /**
     * Calcule le délai en ms jusqu'à l'heure H:M (au sens de la minute exacte)
     * Retourne 0 si l'heure est déjà passée (ou dans les 60 secondes).
     */
    delaiJusquaHeure(heureStr) {
        const [h, m] = heureStr.split(':').map(Number);
        const maintenant = new Date();
        const cible = new Date(maintenant);
        cible.setHours(h, m, 0, 0);   // secondes = 0, ms = 0

        let diff = cible - maintenant; // peut être négatif si déjà passé
        return diff > 0 ? diff : 0;
    }

    /**
     * Charge les prescriptions depuis l'API et programme les alertes précises.
     */
    async chargerEtProgrammerAlertes() {
        try {
            const resp = await fetch('/api/patients/mes-alertes/', {
                headers: { 'X-CSRFToken': this.getCSRFToken() }
            });
            if (!resp.ok) return;
            const data = await resp.json();

            // Afficher les alertes chargées
            if (data.alertes.length > 0) {
                console.log(`📋 ${data.alertes.length} prescription(s) à verifier:`);
                data.alertes.forEach(a => {
                    console.log(`  - ${a.medicament_nom} (prévu à ${a.heure_prevue}, retard: ${a.retard_minutes}min)`);
                });
            }

            // Nettoyer les alertes dont la prescription a été validée
            const idsActifs = new Set(data.alertes.map(a => String(a.prescription_id)));
            for (const id of Object.keys(this.alertesActives)) {
                if (!idsActifs.has(id)) {
                    this.annulerAlertesPrescription(id);
                }
            }

            // Programmer une alerte pour chaque prescription active non validée
            for (const alerte of data.alertes) {
                this.programmerAlertePrescription(alerte);
            }
        } catch (e) {
            console.error('Erreur chargement alertes patient :', e);
        }
    }

    programmerAlertePrescription(alerte) {
        const id = String(alerte.prescription_id);

        // Si l'alerte est déjà active (répétition en cours), on ne recrée pas le timer
        if (this.intervalTimers[id]) return;

        const delai = this.delaiJusquaHeure(alerte.heure_prevue);
        const retard = alerte.retard_minutes || 0;
        const minutesAvant = alerte.minutes_avant || 0;

        if (minutesAvant > 0) {
            // ── Cas 0 : Prescription dans le futur (minutes_avant > 0) ──
            // Programmer pour exactement dans minutes_avant minutes
            const delaiMs = minutesAvant * 60 * 1000;
            console.log(`⏳ Alerte programmée dans ${minutesAvant} min (${Math.round(delaiMs/1000)}s) pour ${alerte.medicament_nom} à ${alerte.heure_prevue}`);

            clearTimeout(this.timers[id]);
            this.timers[id] = setTimeout(() => {
                // Déclencher l'alerte à l'heure EXACTE
                this.declencherAlerte(alerte);
                // Puis répéter toutes les 2 minutes tant que non validé
                this.intervalTimers[id] = setInterval(() => {
                    this.verifierEtRepeter(id, alerte);
                }, 120000);
            }, delaiMs);

        } else if (delai > 1000) { // Plus d'1 seconde avant l'heure
            // ── Cas 1 : L'heure N'EST PAS encore atteinte ──
            // On programme un setTimeout précis pour la minute exacte
            console.log(`⏳ Alerte programmée dans ${Math.round(delai/1000)}s pour ${alerte.medicament_nom} à ${alerte.heure_prevue}`);

            clearTimeout(this.timers[id]);
            this.timers[id] = setTimeout(() => {
                // Déclencher l'alerte à l'heure EXACTE
                this.declencherAlerte(alerte);
                // Puis répéter toutes les 2 minutes tant que non validé
                this.intervalTimers[id] = setInterval(() => {
                    this.verifierEtRepeter(id, alerte);
                }, 120000);
            }, delai);

        } else if (delai > 0) { // Moins d'1 seconde avant l'heure
            // Vérifier toutes les 100ms pour une précision maximale
            console.log(`⏰ Alerte imminente dans ${delai}ms pour ${alerte.medicament_nom} à ${alerte.heure_prevue}`);

            clearTimeout(this.timers[id]);
            this.timers[id] = setTimeout(() => {
                this.declencherAlerte(alerte);
                this.intervalTimers[id] = setInterval(() => {
                    this.verifierEtRepeter(id, alerte);
                }, 120000);
            }, delai);

        } else {
            // ── Cas 2 : L'heure EST déjà atteinte ou dépassée ──
            // Déclencher immédiatement et répéter toutes les 2 minutes
            console.log(`🚨 Alerte immédiate pour ${alerte.medicament_nom} à ${alerte.heure_prevue} (retard: ${retard}min)`);
            if (!this.alertesActives[id]) {
                this.declencherAlerte(alerte);
            }
            if (!this.intervalTimers[id]) {
                this.intervalTimers[id] = setInterval(() => {
                    this.verifierEtRepeter(id, alerte);
                }, 120000);
            }
        }
    }

    async verifierEtRepeter(id, alerteInitiale) {
        // Vérifier sur le serveur si la prescription est toujours non validée
        try {
            const resp = await fetch('/api/patients/mes-alertes/', {
                headers: { 'X-CSRFToken': this.getCSRFToken() }
            });
            if (!resp.ok) return;
            const data = await resp.json();
            const alerte = data.alertes.find(a => String(a.prescription_id) === id);

            if (!alerte) {
                // Prescription validée → arrêter tout
                this.annulerAlertesPrescription(id);
            } else {
                // Toujours en attente → rejouer
                this.declencherAlerte(alerte);
            }
        } catch (e) {
            // En cas d'erreur réseau, rejouer quand même
            this.declencherAlerte(alerteInitiale);
        }
    }

    declencherAlerte(alerte) {
        const id = String(alerte.prescription_id);
        const retard = alerte.retard_minutes || 0;

        // Vérifier si l'alerte est déjà en cours de lecture (éviter les doublons)
        if (this.alertesActives[id]) {
            console.log(`ℹ️ Alerte déjà active pour ${alerte.medicament_nom}`);
            return;
        }

        console.log(`🚨 🎵 ALERTE À ${alerte.heure_prevue}: ${alerte.medicament_nom}`);

        this.alertesActives[id] = true;

        // Jouer le son PLUSIEURS FOIS pour s'assurer qu'il est audible
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                this.jouerRappel();
                console.log(`🔊 Son joué (${i+1}/3) pour ${alerte.medicament_nom}`);
            }, i * 1000);
        }

        // Afficher le bandeau
        this.afficherBandeau(alerte.medicament_nom, alerte.heure_prevue, retard, alerte.prescription_id);

        // Afficher la notification navigateur
        this.afficherNotification(alerte.medicament_nom, alerte.heure_prevue, retard, alerte.prescription_id);

        console.log(`✅ ALERTE DÉCLENCHÉE POUR: ${alerte.medicament_nom}`);
    }

    annulerAlertesPrescription(id) {
        clearTimeout(this.timers[id]);
        clearInterval(this.intervalTimers[id]);
        delete this.timers[id];
        delete this.intervalTimers[id];
        delete this.alertesActives[id];
        console.log(`✅ Alerte annulée pour prescription ${id}`);
    }

    // ─── VÉRIFICATION HAUTE PRÉCISION ──────────────────────────────────────

    verifierAlertesImminentes() {
        // Vérifier toutes les prescriptions pour voir si une alerte doit se déclencher
        // Cette vérification se fait chaque seconde pour une précision maximale

        const maintenant = new Date();
        const heureActuelle = maintenant.getHours();
        const minuteActuelle = maintenant.getMinutes();
        const secondeActuelle = maintenant.getSeconds();

        // Vérifier seulement à la seconde 0 (début de chaque minute)
        if (secondeActuelle !== 0) return;

        // Construire l'heure actuelle au format HH:MM
        const heureActuelleStr = `${heureActuelle.toString().padStart(2, '0')}:${minuteActuelle.toString().padStart(2, '0')}`;

        console.log(`⏰ Vérification alarme à ${heureActuelleStr}`);

        // Recharger les alertes depuis le serveur pour être sûr
        this.chargerEtProgrammerAlertes();
    }

    confirmerPrise(prescriptionId) {
        fetch('/api/patients/confirmer-prise/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCSRFToken()
            },
            body: JSON.stringify({ prescription_id: prescriptionId })
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                this.jouerValidation();
                this.annulerAlertesPrescription(String(prescriptionId));

                // Masquer le bandeau
                const bandeau = document.getElementById('bandeau-alerte');
                if (bandeau) bandeau.style.display = 'none';
            }
        })
        .catch(e => console.error('Erreur confirmation prise :', e));
    }

    // ─── UTILITAIRES ──────────────────────────────────────────────────────────

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
        Object.keys(this.timers).forEach(id => clearTimeout(this.timers[id]));
        Object.keys(this.intervalTimers).forEach(id => clearInterval(this.intervalTimers[id]));
    }
}

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
    
    // Jouer le son 3 fois avec intervalle
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const audio = new Audio('/static/sounds/rappel.mp3');
            audio.volume = 1.0;
            audio.currentTime = 0;
            
            audio.play().then(() => {
                console.log(`🔊 Son ${i+1}/3 joué avec succès`);
            }).catch(error => {
                console.error(`❌ Erreur son ${i+1}:`, error);
                alert('⚠️ Veuillez cliquer sur la page puis réessayer - l\'audio doit être débloqué par une interaction utilisateur');
            });
        }, i * 1000);
    }
    
    // Afficher une notification navigateur
    if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification("C'est l'heure de prendre le médicament", {
            body: "TEST ALARME - Médicament de test (Doliprane)",
            icon: '/static/images/logo.png',
            tag: 'test-alarme',
            requireInteraction: true,
            actions: [
                {
                    action: 'validate',
                    title: '✅ Valider la prise'
                }
            ]
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
    
    console.log('✅ Test d\'alarme terminé - vous devriez entendre 3 sons et voir une notification');
}

// Rendre la fonction accessible globalement
window.testerAlarmeComplete = testerAlarmeComplete;

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
    window.medReminderAlerts = new MedReminderPatientAlerts();
    console.log('🔔 Système d\'alerte patient initialisé');
});
