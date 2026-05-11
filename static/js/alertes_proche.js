// =====================================================
// MedReminder - Alertes Sonores (Proches)
// VERSION PRÉCISE :
//   • Notification au proche dès que l'heure est atteinte (le patient doit prendre)
//   • Alerte retard (son + bandeau) à exactement 5 min de retard, puis chaque minute
// =====================================================

class MedReminderProcheAlerts {
    constructor() {
        this.timers = {};           // setTimeout pour notification à l'heure H
        this.retardTimers = {};     // setTimeout pour alerte retard à H+5min
        this.intervalTimers = {};   // setInterval de répétition chaque minute (retard)
        this.alertesActives = {};   // {id: {notifEnvoyee, retardEnvoye}}

        this.audioRetard = new Audio('/static/sounds/retard.mp3');
        this.audioContextUnlocked = false;

        this.initAudio();
        this.demanderPermissionNotification();

        // Charger les prescriptions surveillées et programmer les timers précis
        this.chargerEtProgrammerAlertes();

        // Synchronisation périodique toutes les 30 secondes
        // (les alertes sonores précises sont gérées par alertes_proche.js)
        loadNotifications();
        setInterval(loadNotifications, 30000);
        
        // Test immédiat pour vérifier les notifications proches
        setTimeout(() => {
            console.log('🧪 Test notification proche...');
            if (window.medReminderProcheAlerts) {
                window.medReminderProcheAlerts.afficherNotificationNavigateur(
                    "⏰ Test - MedReminder",
                    "Test de notification pour le proche"
                );
            }
        }, 2000);
    }

    // ─── AUDIO ────────────────────────────────────────────────────────────────

    initAudio() {
        this.audioRetard.volume = 1.0;

        const activerAudio = () => {
            if (!this.audioContextUnlocked) {
                this.audioRetard.load();
                this.audioContextUnlocked = true;
                console.log('🔊 Audio proche débloqué');
            }
            document.removeEventListener('click', activerAudio);
            document.removeEventListener('touchstart', activerAudio);
        };

        document.addEventListener('click', activerAudio);
        document.addEventListener('touchstart', activerAudio);
    }

    jouerRetard() {
        if (this.audioContextUnlocked) {
            this.audioRetard.currentTime = 0;
            this.audioRetard.play().catch(e => console.warn('Impossible de jouer retard.mp3 :', e));
        } else {
            console.warn('⚠️ Audio bloqué – cliquez une fois sur la page d\'abord');
        }
    }

    // ─── NOTIFICATIONS ────────────────────────────────────────────────────────

    demanderPermissionNotification() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    afficherNotificationNavigateur(titre, message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(titre, {
                    body: message,
                    icon: '/static/images/logo.png',
                    requireInteraction: true
                });
            } catch (e) {}
        }
    }

    afficherBandeau(message, type = 'warning') {
        let bandeau = document.getElementById('bandeau-alerte-proche');
        if (!bandeau) {
            bandeau = document.createElement('div');
            bandeau.id = 'bandeau-alerte-proche';
            bandeau.style.cssText = [
                'position:fixed', 'top:20px', 'left:50%', 'transform:translateX(-50%)',
                'z-index:9999', 'min-width:380px', 'max-width:90vw',
                'border-radius:12px', 'padding:14px 20px', 'font-size:1rem',
                'box-shadow:0 6px 24px rgba(0,0,0,0.30)', 'display:none'
            ].join(';');
            document.body.appendChild(bandeau);
        }

        bandeau.className = `alert alert-${type} text-center mb-0`;
        bandeau.innerHTML = `
            <i class="fas fa-triangle-exclamation me-2"></i>${message}
            <button type="button" class="btn-close float-end" style="font-size:.8rem;"
                onclick="document.getElementById('bandeau-alerte-proche').style.display='none'"></button>
        `;
        bandeau.style.display = 'block';

        // La bannière reste affichée jusqu'à fermeture manuelle (pas d'auto-masquage)
    }

    // ─── PROGRAMMATION PRÉCISE ────────────────────────────────────────────────

    delaiJusquaHeure(heureStr) {
        const [h, m] = heureStr.split(':').map(Number);
        const now = new Date();
        const cible = new Date(now);
        cible.setHours(h, m, 0, 0);
        const diff = cible - now;
        return diff > 0 ? diff : 0;
    }

    /**
     * Charge depuis l'API les prescriptions à surveiller et programme les timers.
     * L'API proche renvoie les prescriptions actives de tous les patients suivis.
     */
    async chargerEtProgrammerAlertes() {
        try {
            const resp = await fetch('/proches/api/verifier-alertes/');
            if (!resp.ok) return;
            const data = await resp.json();

            // Traiter les alertes retard déjà actives (pour page rechargée, reconnexion)
            if (data.alertes_retard && data.alertes_retard.length > 0) {
                for (const alerte of data.alertes_retard) {
                    const id = String(alerte.prescription_id);
                    if (!this.intervalTimers[id]) {
                        // Déjà en retard → déclencher immédiatement et répéter chaque minute
                        this.declencherAlerteRetard(alerte);
                        this.intervalTimers[id] = setInterval(() => {
                            this.verifierEtRepeterRetard(id, alerte);
                        }, 60000);
                    }
                }
            }

            // Traiter les prescriptions imminentes (pas encore en retard, pas encore H)
            if (data.prescriptions_imminentes && data.prescriptions_imminentes.length > 0) {
                for (const presc of data.prescriptions_imminentes) {
                    this.programmerPrescription(presc);
                }
            }

        } catch (e) {
            console.error('Erreur chargement alertes proche :', e);
        }
    }

    programmerPrescription(presc) {
        const id = String(presc.prescription_id);

        // Si déjà tout programmé, ignorer
        if (this.timers[id] || this.intervalTimers[id]) return;

        const delaiH = this.delaiJusquaHeure(presc.heure_prevue);
        const delaiRetard = delaiH + 5 * 60 * 1000; // H + 5 minutes

        // Timer 1 : notification au proche à l'heure H exacte
        if (delaiH > 0) {
            this.timers[id] = setTimeout(() => {
                console.log(`📌 ENVOI NOTIFICATION IMMÉDIATE : ${presc.patient} doit prendre ${presc.medicament}`);
                this.envoyerNotifPatientPrendMedicament(presc);
            }, delaiH);
            console.log(`📌 Proche : notification prévue dans ${Math.round(delaiH/1000)}s pour ${presc.patient} – ${presc.medicament}`);
        }

        // Timer 2 : alerte retard à H+5min
        this.retardTimers[id] = setTimeout(async () => {
            // Vérifier si la prise a été validée entre-temps
            const valide = await this.estValide(id);
            if (!valide) {
                const alerteRetard = {
                    prescription_id: id,
                    patient: presc.patient,
                    medicament: presc.medicament,
                    retard: 5,
                    heure_prevue: presc.heure_prevue
                };
                this.declencherAlerteRetard(alerteRetard);

                // Répéter chaque minute
                if (!this.intervalTimers[id]) {
                    this.intervalTimers[id] = setInterval(() => {
                        this.verifierEtRepeterRetard(id, alerteRetard);
                    }, 60000);
                }
            }
        }, delaiRetard > 0 ? delaiRetard : 0);
    }

    async estValide(prescriptionId) {
        try {
            const resp = await fetch('/proches/api/verifier-alertes/');
            if (!resp.ok) return false;
            const data = await resp.json();
            const ids = (data.alertes_retard || []).map(a => String(a.prescription_id));
            const idsImminents = (data.prescriptions_imminentes || []).map(p => String(p.prescription_id));
            // Si la prescription n'apparaît plus du tout, c'est qu'elle est validée
            return !ids.includes(String(prescriptionId)) && !idsImminents.includes(String(prescriptionId));
        } catch { return false; }
    }

    async verifierEtRepeterRetard(id, alerteInitiale) {
        try {
            const resp = await fetch('/proches/api/verifier-alertes/');
            if (!resp.ok) return;
            const data = await resp.json();
            const alerte = (data.alertes_retard || []).find(a => String(a.prescription_id) === id);

            if (!alerte) {
                // Prise validée → arrêter tout
                this.annulerAlerte(id);
            } else {
                this.declencherAlerteRetard(alerte);
            }
        } catch {
            this.declencherAlerteRetard(alerteInitiale);
        }
    }

    // ─── NOTIFICATIONS PROCHE ─────────────────────────────────────────────────

    /**
     * Envoyée dès que l'heure H est atteinte : le patient DOIT prendre son médicament.
     */
    envoyerNotifPatientPrendMedicament(presc) {
        const msg = `🕐 Il est l'heure pour <strong>${presc.patient}</strong> de prendre <strong>${presc.medicament}</strong> (${presc.heure_prevue})`;
        this.afficherBandeau(msg, 'info');
        this.afficherNotificationNavigateur(
            `⏰ MedReminder – Prise à ${presc.heure_prevue}`,
            `${presc.patient} doit prendre ${presc.medicament} maintenant.`
        );
        console.log(`📢 Proche notifié : ${presc.patient} doit prendre ${presc.medicament} à ${presc.heure_prevue}`);
    }

    /**
     * Envoyée à partir de 5 min de retard, puis chaque minute.
     */
    declencherAlerteRetard(alerte) {
        const retard = alerte.retard || alerte.retard_minutes || 5;
        const msg = `🚨 <strong>${alerte.patient}</strong> a <strong>${retard} min</strong> de retard pour <strong>${alerte.medicament}</strong> (prévu à ${alerte.heure_prevue})`;

        this.jouerRetard();
        this.afficherBandeau(msg, 'danger');
        this.afficherNotificationNavigateur(
            `🚨 MedReminder – Retard ${retard} min`,
            `${alerte.patient} n'a pas pris ${alerte.medicament} (prévu à ${alerte.heure_prevue}).`
        );
        this.alertesActives[String(alerte.prescription_id)] = true;
        console.log(`🚨 ALERTE RETARD proche : ${alerte.patient} – ${alerte.medicament} – retard ${retard} min`);
    }

    annulerAlerte(id) {
        clearTimeout(this.timers[id]);
        clearTimeout(this.retardTimers[id]);
        clearInterval(this.intervalTimers[id]);
        delete this.timers[id];
        delete this.retardTimers[id];
        delete this.intervalTimers[id];
        delete this.alertesActives[id];
        console.log(`✅ Alerte proche annulée pour prescription ${id}`);
    }

    // ─── UTILITAIRES ──────────────────────────────────────────────────────────

    stop() {
        Object.keys(this.timers).forEach(id => clearTimeout(this.timers[id]));
        Object.keys(this.retardTimers).forEach(id => clearTimeout(this.retardTimers[id]));
        Object.keys(this.intervalTimers).forEach(id => clearInterval(this.intervalTimers[id]));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.medReminderProcheAlerts = new MedReminderProcheAlerts();
});
