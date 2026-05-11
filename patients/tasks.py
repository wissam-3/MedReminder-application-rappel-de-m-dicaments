from celery import shared_task
from django.utils import timezone
from .models import Prescription, ConfirmationPrise
from datetime import timedelta


@shared_task
def alerte_rappel_medicament_chaque_minute():
    """
    Envoie une ALERTE CHAQUE MINUTE au patient si la prise n'a pas été confirmée
    Cette tâche s'exécute toutes les minutes jusqu'à confirmation
    """
    today = timezone.now().date()
    now = timezone.now()
    
    # Récupérer toutes les prescriptions actives du jour
    prescriptions_actives = Prescription.objects.filter(
        date_debut__lte=today,
        date_fin__gte=today
    )
    
    alertes_envoyees = []
    
    for prescription in prescriptions_actives:
        heure_prevue = prescription.heure_prise
        
        # Vérifier si le patient a DÉJÀ confirmé la prise aujourd'hui
        deja_confirme = ConfirmationPrise.objects.filter(
            prescription=prescription,
            date_confirmation=today
        ).exists()
        
        # Si déjà confirmé, passer à la prochaine prescription
        if deja_confirme:
            continue
        
        # Calculer la différence en minutes
        diff_minutes = (now.hour - heure_prevue.hour) * 60 + (now.minute - heure_prevue.minute)
        
        # Envoyer une alerte si l'heure est atteinte (heure prévue ou après)
        if diff_minutes >= 0:
            patient = prescription.patient
            medicament = prescription.medicament
            
            alertes_envoyees.append({
                'prescription_id': prescription.id,
                'patient_id': patient.id,
                'patient_username': patient.user.username,
                'medicament_nom': medicament.nom,
                'heure_prevue': heure_prevue.strftime('%H:%M'),
                'heures_ecoulees': diff_minutes // 60,
                'minutes_ecoulees': diff_minutes % 60
            })
            
            # 🔔 Envoyer l'alerte au PATIENT CHAQUE MINUTE
            envoyer_alerte_patient.delay(
                patient.id, 
                medicament.nom, 
                heure_prevue.strftime('%H:%M'),
                retard_minutes=diff_minutes
            )
            
            # 🚨 Si retard >= 5 minutes, alerter les PROCHES CHAQUE MINUTE
            if diff_minutes >= 5:
                proches = patient.proches.all()
                for proche in proches:
                    envoyer_alerte_proche.delay(
                        proche.id,
                        patient.user.get_full_name() or patient.user.username,
                        medicament.nom,
                        heure_prevue.strftime('%H:%M'),
                        diff_minutes
                    )
    
    return {
        'alertes_envoyees': alertes_envoyees,
        'total': len(alertes_envoyees),
        'timestamp': str(now)
    }


@shared_task
def verifier_prises_medicaments():
    """
    Vérifie toutes les 5 minutes les prises de médicaments
    """
    today = timezone.now().date()
    now = timezone.now()
    
    # Récupérer toutes les prescriptions actives du jour
    prescriptions_actives = Prescription.objects.filter(
        date_debut__lte=today,
        date_fin__gte=today
    )
    
    alertes_prises = []
    alertes_retards = []
    
    for prescription in prescriptions_actives:
        heure_prevue = prescription.heure_prise
        
        # Vérifier si le patient a déjà validé la prise
        deja_valide = ConfirmationPrise.objects.filter(
            prescription=prescription,
            date_confirmation=today
        ).exists()
        
        if deja_valide:
            continue
        
        # Calculer la différence en minutes
        diff_minutes = (now.hour - heure_prevue.hour) * 60 + (now.minute - heure_prevue.minute)
        
        # Alerte de retard (plus de 5 minutes)
        if diff_minutes >= 5:
            alertes_retards.append({
                'prescription_id': prescription.id,
                'patient_id': prescription.patient.id,
                'patient_nom': prescription.patient.user.get_full_name() or prescription.patient.user.username,
                'medicament': prescription.medicament.nom,
                'heure_prevue': heure_prevue.strftime('%H:%M'),
                'retard_minutes': diff_minutes
            })
        
        # Alerte à l'heure exacte (0-5 minutes après)
        elif 0 <= diff_minutes <= 5:
            alertes_prises.append({
                'prescription_id': prescription.id,
                'patient_id': prescription.patient.id,
                'patient_nom': prescription.patient.user.get_full_name() or prescription.patient.user.username,
                'medicament': prescription.medicament.nom,
                'heure_prevue': heure_prevue.strftime('%H:%M')
            })
    
    return {
        'alertes_prises': alertes_prises,
        'alertes_retards': alertes_retards,
        'total': len(alertes_prises) + len(alertes_retards)
    }


@shared_task
def envoyer_alerte_patient(patient_id, medicament_nom, heure_prevue, retard_minutes=0):
    """
    Envoie une alerte au patient CHAQUE MINUTE jusqu'à confirmation
    Crée une notification visuelle et sonore
    """
    from .models import Patient
    try:
        patient = Patient.objects.get(id=patient_id)
        
        # Message d'alerte
        if retard_minutes > 0:
            message = f"⏰ RAPPEL: {medicament_nom} - Prévu à {heure_prevue} (Retard: {retard_minutes} min)"
            print(f"🔔 [ALERTE PATIENT] {patient.user.username} - {message}")
        else:
            message = f"⏰ RAPPEL: Il est temps de prendre {medicament_nom} (Heure: {heure_prevue})"
            print(f"🔔 [ALERTE PATIENT] {patient.user.username} - {message}")
        
        # Sauvegarder l'alerte en base de données pour affichage
        from django.contrib.auth.models import User
        from .models import Prescription
        
        # Trouver la prescription correspondante
        prescription = Prescription.objects.filter(
            patient=patient,
            medicament__nom=medicament_nom
        ).first()
        
        if prescription:
            # Vous pouvez créer un modèle Alerte pour tracker les alertes envoyées
            # Pour l'instant, on log simplement
            pass
        
        # 🔊 ENVOYER NOTIFICATION SONORE VIA JS (WebSocket ou polling)
        # Le JavaScript côté patient jouera le son quand il verra cette alerte
        
        return f"Alerte envoyée au patient {patient.user.username}"
    except Exception as e:
        print(f"❌ Erreur lors de l'envoi de l'alerte: {str(e)}")
        return f"Erreur: {str(e)}"


@shared_task
def envoyer_alerte_proche(proche_id, patient_nom, medicament_nom, heure_prevue, retard_minutes):
    """
    Envoie une alerte au proche si le patient est en retard
    """
    from proches.models import Proche
    try:
        proche = Proche.objects.get(id=proche_id)
        print(f"🔔 [ALERTE PROCHE] {proche.nom} - Patient {patient_nom} n'a pas pris {medicament_nom} - Retard: {retard_minutes}min")
        
        # Ici vous pouvez ajouter l'envoi de SMS, Email ou notifications push
        
        return f"Alerte envoyée au proche {proche.nom}"
    except Exception as e:
        return f"Erreur: {str(e)}"


@shared_task
def traiter_alertes():
    """
    Point d'entrée principal pour traiter toutes les alertes
    """
    resultat = verifier_prises_medicaments()
    
    alertes_prises = resultat.get('alertes_prises', [])
    alertes_retards = resultat.get('alertes_retards', [])
    
    for alerte in alertes_prises:
        envoyer_alerte_patient.delay(
            alerte['patient_id'],
            alerte['medicament'],
            alerte['heure_prevue']
        )
    
    for alerte in alertes_retards:
        # Récupérer les proches du patient
        from .models import Prescription
        prescription = Prescription.objects.get(id=alerte['prescription_id'])
        proches = prescription.patient.proches.all()
        
        for proche in proches:
            envoyer_alerte_proche.delay(
                proche.id,
                alerte['patient_nom'],
                alerte['medicament'],
                alerte['heure_prevue'],
                alerte['retard_minutes']
            )
    
    return f"{len(alertes_prises)} alertes immédiates + {len(alertes_retards)} alertes retard traitées"