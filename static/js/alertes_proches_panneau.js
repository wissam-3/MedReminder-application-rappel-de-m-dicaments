// Système d'alertes proches avec panneau de notifications
console.log('🔔 Système d\'alertes proches avec panneau chargé');

class ProcheAlertsWithPanel {
    constructor() {
        this.alertes = [];
        this.panneau = null;
        
        // Demander la permission de notification
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        // Créer le panneau
        this.creerPanneau();
        
        // Démarrer la vérification
        this.demarrerVerification();
        console.log('🔔 Système d\'alertes proches avec panneau démarré');
    }
    
    creerPanneau() {
        // Créer le panneau de notifications
        this.panneau = document.createElement('div');
        this.panneau.id = 'panneau-alertes-proches';
        this.panneau.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            max-height: 400px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 10000;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // En-tête du panneau
        const entete = document.createElement('div');
        entete.style.cssText = `
            background: #007bff;
            color: white;
            padding: 12px 16px;
            border-radius: 12px 12px 0 0;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        entete.innerHTML = `
            <span>📱 Alertes Médicaments</span>
            <button onclick="document.getElementById('panneau-alertes-proches').style.display='none'" 
                    style="background: none; border: none; color: white; cursor: pointer; font-size: 18px;">×</button>
        `;
        
        // Contenu du panneau
        const contenu = document.createElement('div');
        contenu.id = 'contenu-panneau-alertes';
        contenu.style.cssText = `
            padding: 16px;
        `;
        
        this.panneau.appendChild(entete);
        this.panneau.appendChild(contenu);
        document.body.appendChild(this.panneau);
        
        // Masquer par défaut
        this.panneau.style.display = 'none';
    }
    
    demarrerVerification() {
        // Vérifier immédiatement
        this.verifierAlertes();
        
        // Ensuite vérifier toutes les 30 secondes
        setInterval(() => {
            this.verifierAlertes();
        }, 30000);
    }
    
    async verifierAlertes() {
        try {
            console.log('🔍 Vérification des alertes proches...');
            const response = await fetch('/proches/api/verifier-alertes/');
            if (!response.ok) return;
            
            const data = await response.json();
            const maintenant = new Date();
            console.log('📊 Données reçues de l\'API:', data);
            console.log('⏰ Heure actuelle:', maintenant.toLocaleTimeString());
            
            // Traiter les prescriptions imminentes
            if (data.prescriptions_imminentes) {
                console.log('📋 Prescriptions imminentes trouvées:', data.prescriptions_imminentes.length);
                for (const presc of data.prescriptions_imminentes) {
                    const id = String(presc.prescription_id);
                    
                    // Calculer si l'heure est arrivée
                    const [heures, minutes] = presc.heure_prevue.split(':').map(Number);
                    const heureAlerte = new Date();
                    heureAlerte.setHours(heures, minutes, 0, 0);
                    
                    const diffMs = maintenant - heureAlerte;
                    const diffMinutes = Math.floor(diffMs / 60000);
                    
                    console.log(`⏰ Prescription ${presc.patient} - ${presc.medicament}:`);
                    console.log(`   Heure prévue: ${presc.heure_prevue}`);
                    console.log(`   Heure actuelle: ${maintenant.toLocaleTimeString()}`);
                    console.log(`   Différence: ${diffMinutes} minutes`);
                    console.log(`   Déjà notifié: ${this.alertes.find(a => a.id === id) ? 'OUI' : 'NON'}`);
                    
                    // Si l'heure est arrivée et pas encore notifié
                    if (diffMinutes >= 0 && !this.alertes.find(a => a.id === id)) {
                        console.log('✅ ALERTE DE PRISE DÉCLENCHÉE pour:', presc.patient);
                        this.ajouterAlertePrise(presc);
                        this.programmerAlerteRetard(presc);
                        this.alertesProgrammees[id] = true;
                    } else {
                        console.log('❌ Alerte de prise NON déclenchée (heure pas arrivée ou déjà notifiée)');
                    }
                }
            } else {
                console.log('📭 Aucune prescription imminente trouvée');
            }
            
            // Traiter les alertes de retard
            if (data.alertes_retard) {
                console.log('🚨 Alertes de retard trouvées:', data.alertes_retard.length);
                for (const alerte of data.alertes_retard) {
                    const id = String(alerte.prescription_id);
                    
                    // Si pas encore en alerte de retard
                    if (!this.alertes.find(a => a.id === id && a.type === 'retard')) {
                        console.log('✅ ALERTE DE RETARD DÉCLENCHÉE pour:', alerte.patient);
                        this.ajouterAlerteRetard(alerte);
                        this.alertesRetard[id] = true;
                    } else {
                        console.log('❌ Alerte de retard NON déclenchée (déjà active)');
                    }
                }
            } else {
                console.log('📭 Aucune alerte de retard trouvée');
            }
            
        } catch (error) {
            console.error('❌ Erreur vérification alertes proches:', error);
        }
    }
    
    ajouterAlertePrise(presc) {
        console.log(`📢 AJOUTER ALERTE PRISE: ${presc.patient} doit prendre ${presc.medicament}`);
        
        const alerte = {
            id: String(presc.prescription_id),
            type: 'prise',
            patient: presc.patient,
            medicament: presc.medicament,
            heure: presc.heure_prevue,
            message: `${presc.patient} doit prendre ${presc.medicament}`,
            timestamp: new Date()
        };
        
        this.alertes.push(alerte);
        this.mettreAJourPanneau();
        this.envoyerNotificationNavigateur(alerte);
        // this.afficherPanneau(); // Ne pas afficher automatiquement
        
        // Programmer l'alerte de retard après 5 minutes
        setTimeout(() => {
            this.programmerAlerteRetard(presc);
        }, 300000);
    }
    
    ajouterAlerteRetard(alerte) {
        console.log(`🚨 AJOUTER ALERTE RETARD: ${alerte.patient} - ${alerte.medicament}`);
        
        const alerte = {
            id: String(alerte.prescription_id),
            type: 'retard',
            patient: alerte.patient,
            medicament: alerte.medicament,
            heure: alerte.heure_prevue,
            retard: alerte.retard_minutes || 5,
            message: `${alerte.patient} n'a pas pris ${alerte.medicament} (retard: ${alerte.retard_minutes || 5} min)`,
            timestamp: new Date()
        };
        
        this.alertes.push(alerte);
        this.mettreAJourPanneau();
        this.envoyerNotificationNavigateur(alerte);
        this.jouerSonAlerte();
        this.afficherPanneau();
    }
    
    mettreAJourPanneau() {
        const contenu = document.getElementById('contenu-panneau-alertes');
        if (!contenu) return;
        
        if (this.alertes.length === 0) {
            contenu.innerHTML = `
                <div style="text-align: center; color: #666; padding: 20px;">
                    <div style="font-size: 24px; margin-bottom: 10px;">📱</div>
                    <div>Aucune alerte active</div>
                </div>
            `;
            return;
        }
        
        let html = '';
        for (const alerte of this.alertes) {
            const icone = alerte.type === 'retard' ? '🚨' : '⏰';
            const couleur = alerte.type === 'retard' ? '#dc3545' : '#007bff';
            const retardText = alerte.type === 'retard' ? `<div style="color: #dc3545; font-size: 12px; margin-top: 4px;">Retard: ${alerte.retard} min</div>` : '';
            
            html += `
                <div style="background: ${couleur}10; border-left: 4px solid ${couleur}; padding: 12px; margin-bottom: 12px; border-radius: 6px;">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 20px; margin-right: 8px;">${icone}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #333;">${alerte.patient}</div>
                            <div style="color: #666; font-size: 14px;">${alerte.medicament}</div>
                            <div style="color: #666; font-size: 12px;">Prévu: ${alerte.heure}</div>
                            ${retardText}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        ${alerte.type === 'retard' ? `
                            <button onclick="window.procheAlertsWithPanel.appelerPatient('${alerte.patient_telephone}')" 
                                    style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                📞 Appeler le patient
                            </button>
                        ` : ''}
                        <button onclick="window.procheAlertsWithPanel.masquerAlerte('${alerte.id}')" 
                                style="background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            Masquer
                        </button>
                    </div>
                </div>
            `;
        }
        
        contenu.innerHTML = html;
    }
    
    afficherPanneau() {
        if (this.panneau) {
            this.panneau.style.display = 'block';
            // Masquer automatiquement après 2 minutes (plus long pour donner le temps de voir)
            setTimeout(() => {
                if (this.panneau) {
                    this.panneau.style.display = 'none';
                }
            }, 120000); // 2 minutes
        }
    }
    
    envoyerNotificationNavigateur(alerte) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const titre = alerte.type === 'retard' ? '🚨 MedReminder - RETARD' : '⏰ MedReminder - Prise';
            const notification = new Notification(titre, {
                body: alerte.message,
                icon: '/static/images/logo.png',
                requireInteraction: true
            });
            
            notification.onclick = () => {
                window.focus();
                this.afficherPanneau();
                notification.close();
            };
        }
    }
    
    jouerSonAlerte() {
        const audio = new Audio('/static/sounds/retard.mp3');
        audio.volume = 1.0;
        audio.play().catch(e => console.warn('⚠️ Impossible de jouer le son:', e));
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
                // Mettre à jour l'alerte existante
                const index = this.alertes.findIndex(a => a.id === String(presc.prescription_id) && a.type === 'retard');
                if (index !== -1) {
                    this.alertes[index].retard = alerte.retard_minutes || 5;
                }
            }
        } catch (error) {
            console.error('❌ Erreur vérification alertes proches:', error);
        }
    }
    
    // Initialiser au chargement de la page
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🔔 Initialisation du système d\'alertes proches avec panneau');
        
        // Test immédiat après 2 secondes
        setTimeout(() => {
            console.log('🧪 TEST IMMÉDIAT - Création d\'une fausse alerte');
            if (window.procheAlertsWithPanel) {
                // Créer une fausse alerte de test
                const fausseAlerte = {
                    prescription_id: 'test-123',
                    patient: 'Patient Test',
                    medicament: 'Médicament Test',
                    heure: '10:00'
                };
                
                window.procheAlertsWithPanel.ajouterAlertePrise(fausseAlerte);
                console.log('✅ Test d\'alerte créé - Le panneau devrait s\'afficher');
            } else {
                console.error('❌ ERREUR: window.procheAlertsWithPanel n\'existe pas');
            }
        }, 2000);
        
        // Test manuel pour forcer une alerte de retard
        setTimeout(() => {
            console.log('🧪 TEST MANUEL - Création d\'une fausse alerte de retard');
            if (window.procheAlertsWithPanel) {
                // Créer une fausse alerte de retard
                const fausseAlerteRetard = {
                    prescription_id: 'test-retard-456',
                    patient: 'Patient Test Retard',
                    medicament: 'Médicament Test Retard',
                    heure: '11:19',
                    retard_minutes: 6,
                    patient_telephone: '0123456789'
                };
                
                window.procheAlertsWithPanel.ajouterAlerteRetard(fausseAlerteRetard);
                console.log('✅ Test d\'alerte de retard créé - Le panneau devrait s\'afficher avec bouton d\'appel');
            } else {
                console.error('❌ ERREUR: window.procheAlertsWithPanel n\'existe pas');
            }
        }, 5000);
        
        window.procheAlertsWithPanel = new ProcheAlertsWithPanel();
    });
