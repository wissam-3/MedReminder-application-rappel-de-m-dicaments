from django.core.management.base import BaseCommand
from django.utils import timezone
from django.core.mail import send_mail
from patients.models import Prescription, ConfirmationPrise
from django.contrib import messages
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Vérifie les prises de médicaments non validées et envoie des alertes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--send-emails',
            action='store_true',
            help='Envoyer les emails d\'alerte',
        )
        parser.add_argument(
            '--use-celery',
            action='store_true',
            help='Utiliser Celery pour les tâches asynchrones',
        )

    def handle(self, *args, **options):
        today = timezone.now().date()
        now = timezone.now()
        
        self.stdout.write(self.style.SUCCESS(f'🔍 Vérification des prises du {today} à {now.strftime("%H:%M")}'))
        
        # Récupérer les prescriptions actives
        prescriptions = Prescription.objects.filter(
            date_debut__lte=today,
            date_fin__gte=today
        )
        
        non_validees = []
        alertes_retard = []
        alertes_immediates = []
        
        for prescription in prescriptions:
            # Vérifier si le patient a déjà validé aujourd'hui
            a_valide = ConfirmationPrise.objects.filter(
                prescription=prescription,
                date_confirmation=today
            ).exists()
            
            if a_valide:
                continue
            
            # Calcul du retard
            heure_prevue = prescription.heure_prise
            diff_minutes = (now.hour - heure_prevue.hour) * 60 + (now.minute - heure_prevue.minute)
            
            non_validees.append({
                'patient': prescription.patient.user.username,
                'patient_id': prescription.patient.id,
                'medicament': prescription.medicament.nom,
                'medecin': prescription.medecin.nom,
                'heure_prevue': heure_prevue.strftime('%H:%M'),
                'retard_minutes': diff_minutes
            })
            
            # Alerte immédiate (0-5 minutes)
            if 0 <= diff_minutes <= 5:
                alertes_immediates.append({
                    'prescription': prescription,
                    'patient': prescription.patient,
                    'medicament': prescription.medicament.nom,
                    'heure_prevue': heure_prevue.strftime('%H:%M')
                })
            
            # Alerte de retard (plus de 120 minutes = 2h)
            elif diff_minutes >= 120:
                alertes_retard.append({
                    'prescription': prescription,
                    'patient': prescription.patient,
                    'proches': prescription.patient.proches.all(),
                    'medicament': prescription.medicament.nom,
                    'heure_prevue': heure_prevue.strftime('%H:%M'),
                    'retard_minutes': diff_minutes
                })
        
        # Afficher le résumé
        if non_validees:
            self.stdout.write(f"\n📊 {len(non_validees)} prise(s) non validée(s) :")
            for item in non_validees:
                self.stdout.write(f"  - {item['patient']} : {item['medicament']} (prévu à {item['heure_prevue']})")
                if item['retard_minutes'] > 0:
                    self.stdout.write(self.style.WARNING(f"    ⚠️ Retard: {item['retard_minutes']} minutes"))
        else:
            self.stdout.write(self.style.SUCCESS("✅ Toutes les prises ont été validées aujourd'hui !"))
        
        # Envoyer les alertes immédiates
        if alertes_immediates and options['send_emails']:
            self.stdout.write(f"\n🔔 Envoi de {len(alertes_immediates)} alerte(s) immédiate(s)...")
            for alerte in alertes_immediates:
                self.envoyer_alerte_patient(alerte, options['use_celery'])
        
        # Envoyer les alertes de retard
        if alertes_retard and options['send_emails']:
            self.stdout.write(f"\n⚠️ Envoi de {len(alertes_retard)} alerte(s) de retard...")
            for alerte in alertes_retard:
                self.envoyer_alerte_retard(alerte, options['use_celery'])
        
        # Résumé final
        self.stdout.write(self.style.SUCCESS(f"\n✅ Vérification terminée à {timezone.now().strftime('%H:%M:%S')}"))
        
        return {
            'total_non_validees': len(non_validees),
            'alertes_immediates': len(alertes_immediates),
            'alertes_retard': len(alertes_retard)
        }
    
    def envoyer_alerte_patient(self, alerte, use_celery=False):
        """Envoie une alerte au patient"""
        try:
            sujet = f"💊 Rappel : Prenez votre {alerte['medicament']}"
            message = f"""
Bonjour {alerte['patient'].user.get_full_name() or alerte['patient'].user.username},

Il est temps de prendre votre médicament : {alerte['medicament']}
Heure prévue : {alerte['heure_prevue']}

Connectez-vous à votre espace pour valider votre prise :
http://127.0.0.1:8000/patients/mes-medicaments/

Prenez soin de vous !
MedReminder
            """
            
            if use_celery:
                from patients.tasks import envoyer_alerte_patient as task
                task.delay(alerte['patient'].id, alerte['medicament'], alerte['heure_prevue'])
                print(f"  📨 Tâche Celery planifiée pour {alerte['patient'].user.username}")
            else:
                # Envoi direct
                if alerte['patient'].user.email:
                    send_mail(sujet, message, 'noreply@medreminder.ma', [alerte['patient'].user.email])
                    print(f"  📨 Email envoyé à {alerte['patient'].user.email}")
                else:
                    print(f"  ⚠️ Pas d'email pour {alerte['patient'].user.username}")
        
        except Exception as e:
            print(f"  ❌ Erreur: {e}")
    
    def envoyer_alerte_retard(self, alerte, use_celery=False):
        """Envoie une alerte de retard aux proches"""
        try:
            for proche in alerte['proches']:
                sujet = f"⚠️ Alerte : {alerte['patient'].user.username} a oublié son médicament"
                message = f"""
Bonjour {proche.nom},

{alerte['patient'].user.get_full_name() or alerte['patient'].user.username} n'a pas encore pris son médicament :
💊 {alerte['medicament']}
⏰ Heure prévue : {alerte['heure_prevue']}
⚠️ Retard : {alerte['retard_minutes']} minutes

Connectez-vous pour voir le suivi :
http://127.0.0.1:8000/proches/tableau-bord/

MedReminder
                """
                
                if use_celery:
                    from patients.tasks import envoyer_alerte_proche as task
                    task.delay(proche.id, alerte['patient'].user.username, alerte['medicament'], 
                              alerte['heure_prevue'], alerte['retard_minutes'])
                    print(f"  📨 Tâche Celery planifiée pour proche {proche.nom}")
                else:
                    if proche.user.email:
                        send_mail(sujet, message, 'noreply@medreminder.ma', [proche.user.email])
                        print(f"  📨 Email envoyé au proche {proche.nom}")
                    else:
                        print(f"  ⚠️ Pas d'email pour le proche {proche.nom}")
        
        except Exception as e:
            print(f"  ❌ Erreur: {e}")