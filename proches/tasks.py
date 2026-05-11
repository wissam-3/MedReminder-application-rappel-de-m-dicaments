from celery import shared_task
from django.utils import timezone
from patients.models import Prescription, ConfirmationPrise


@shared_task
def verifier_retards_proche(proche_id):
    """
    Vérifie spécifiquement les retards pour un proche
    """
    from proches.models import Proche
    try:
        proche = Proche.objects.get(id=proche_id)
        
        today = timezone.now().date()
        now = timezone.now()
        
        alertes = []
        
        for patient in proche.patients.all():
            prescriptions = patient.prescriptions.filter(
                date_debut__lte=today,
                date_fin__gte=today
            )
            
            for prescription in prescriptions:
                deja_valide = ConfirmationPrise.objects.filter(
                    prescription=prescription,
                    date_confirmation=today
                ).exists()
                
                if not deja_valide:
                    diff_minutes = (now.hour - prescription.heure_prise.hour) * 60 + (now.minute - prescription.heure_prise.minute)
                    
                    if diff_minutes >= 5:  # 5 minutes de retard
                        alertes.append({
                            'patient_nom': patient.user.get_full_name() or patient.user.username,
                            'medicament': prescription.medicament.nom,
                            'heure_prevue': prescription.heure_prise.strftime('%H:%M'),
                            'retard_minutes': diff_minutes
                        })
        
        return alertes
    
    except Exception as e:
        return str(e)