// Version simple avec sonnerie intégrée (fonctionne sur tous les navigateurs)
class SimpleAlert {
    constructor() {
        this.audio = null;
        this.init();
    }

    init() {
        // Créer un son avec l'API Audio simple
        this.createBeepSound();
        this.startChecking();
    }

    createBeepSound() {
        // Utiliser l'API AudioContext seulement si disponible
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            if (window.AudioContext) {
                this.audioContext = new AudioContext();
            }
        } catch(e) {
            console.log('AudioContext non supporté');
        }
    }

    beep() {
        if (this.audioContext) {
            const oscillator = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            oscillator.connect(gain);
            gain.connect(this.audioContext.destination);
            oscillator.frequency.value = 880;
            gain.gain.value = 0.3;
            oscillator.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, this.audioContext.currentTime + 0.5);
            oscillator.stop(this.audioContext.currentTime + 0.5);
            
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        } else {
            // Fallback : utiliser l'élément audio
            const audio = new Audio('data:audio/wav;base64,U3RlYWx0aCBzb3VuZA==');
            audio.play().catch(e => console.log('Audio non supporté'));
        }
    }

    async startChecking() {
        setInterval(async () => {
            try {
                const response = await fetch('/patients/api/verifier-prises/');
                const data = await response.json();
                
                if (data.alertes_immediates && data.alertes_immediates.length > 0) {
                    this.beep();
                    // Afficher dans la console
                    console.log('🔔 RAPPEL:', data.alertes_immediates);
                }
                if (data.alertes_retard && data.alertes_retard.length > 0) {
                    this.beep();
                    console.log('⚠️ RETARD:', data.alertes_retard);
                }
            } catch(e) {
                console.error('Erreur:', e);
            }
        }, 60000); // Vérifier toutes les minutes
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SimpleAlert();
});