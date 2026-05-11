from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.http import JsonResponse
from django.contrib.auth.models import User
from .models import Proche
from .forms import ConnexionProcheForm, InscriptionProcheForm
from patients.models import Patient, Prescription, ConfirmationPrise
from medecins.models import Medecin


def inscription(request):
    """Inscription d'un nouveau proche avec code d'accès médecin"""
    if request.method == 'POST':
        form = InscriptionProcheForm(request.POST)
        if form.is_valid():
            code_acces = form.cleaned_data['code_acces']
            
            try:
                medecin = Medecin.objects.get(username=code_acces)
            except Medecin.DoesNotExist:
                messages.error(request, 'Code d\'accès invalide. Veuillez contacter votre médecin.')
                return render(request, 'proches/inscription.html', {'form': form})
            
            user = form.save()
            
            proche = Proche.objects.create(
                user=user,
                nom=form.cleaned_data['nom'],
                telephone=form.cleaned_data['telephone']
            )
            
            patients = Patient.objects.filter(medecin=medecin)
            proche.patients.set(patients)
            
            login(request, user)
            
            messages.success(
                request, 
                f'Inscription réussie {proche.nom} ! Vous suivez maintenant {patients.count()} patient(s).'
            )
            return redirect('proches:tableau_bord')
    else:
        form = InscriptionProcheForm()
    
    return render(request, 'proches/inscription.html', {'form': form})


def connexion(request):
    """Connexion d'un proche existant"""
    if request.method == 'POST':
        form = ConnexionProcheForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            user = authenticate(request, username=username, password=password)
            
            if user is not None and hasattr(user, 'proche'):
                login(request, user)
                messages.success(request, f'Bonjour {user.proche.nom} !')
                return redirect('proches:tableau_bord')
            else:
                messages.error(request, 'Identifiants invalides ou vous n\'êtes pas un proche.')
    else:
        form = ConnexionProcheForm()
    
    return render(request, 'proches/connexion.html', {'form': form})


def deconnexion(request):
    """Déconnexion du proche"""
    logout(request)
    messages.info(request, 'Vous avez été déconnecté.')
    return redirect('accueil')


@login_required
def tableau_bord(request):
    """Tableau de bord principal du proche"""
    if not hasattr(request.user, 'proche'):
        messages.error(request, 'Accès réservé aux proches.')
        return redirect('accueil')
    
    proche = request.user.proche
    today = timezone.now().date()
    now = timezone.localtime(timezone.now())
    
    patients_data = []
    alertes_retard = []
    
    for patient in proche.patients.all():
        prescriptions_actives = patient.prescriptions.filter(
            date_debut__lte=today,
            date_fin__gte=today
        ).order_by('heure_prise')
        
        for prescription in prescriptions_actives:
            prescription.a_valide_aujourdhui = prescription.a_deja_confirme_aujourdhui()
            
            heure_prevue = prescription.heure_prise
            heure_limite = heure_prevue.replace(
                hour=min(heure_prevue.hour + 2, 23),
                minute=heure_prevue.minute
            )
            
            if not prescription.a_valide_aujourdhui and now.time() > heure_limite:
                retard_minutes = (
                    (now.hour - heure_prevue.hour) * 60 + 
                    (now.minute - heure_prevue.minute)
                )
                alertes_retard.append({
                    'patient': patient,
                    'prescription': prescription,
                    'heure_prevue': heure_prevue,
                    'retard_minutes': retard_minutes
                })
        
        patients_data.append({
            'patient': patient,
            'prescriptions_actives': prescriptions_actives,
        })
    
    context = {
        'proche': proche,
        'patients_data': patients_data,
        'alertes_retard': alertes_retard,
        'total_alertes': len(alertes_retard),
        'today': today,
        'now': now,
    }
    return render(request, 'proches/tableau_bord.html', context)


@login_required
def detail_patient(request, patient_id):
    """Détail d'un patient spécifique"""
    if not hasattr(request.user, 'proche'):
        messages.error(request, 'Accès réservé aux proches.')
        return redirect('accueil')
    
    proche = request.user.proche
    patient = get_object_or_404(Patient, id=patient_id)
    
    if patient not in proche.patients.all():
        messages.error(request, 'Vous n\'êtes pas autorisé à voir ce patient.')
        return redirect('proches:tableau_bord')
    
    today = timezone.now().date()
    now = timezone.localtime(timezone.now())
    
    prescriptions_actives = patient.prescriptions.filter(
        date_debut__lte=today,
        date_fin__gte=today
    ).order_by('heure_prise')
    
    for prescription in prescriptions_actives:
        prescription.a_valide_aujourdhui = prescription.a_deja_confirme_aujourdhui()
        
        heure_prevue = prescription.heure_prise
        heure_limite = heure_prevue.replace(
            hour=min(heure_prevue.hour + 2, 23),
            minute=heure_prevue.minute
        )
        
        if not prescription.a_valide_aujourdhui and now.time() > heure_limite:
            prescription.en_retard = True
            prescription.retard_minutes = (
                (now.hour - heure_prevue.hour) * 60 + 
                (now.minute - heure_prevue.minute)
            )
        else:
            prescription.en_retard = False
    
    historique = ConfirmationPrise.objects.filter(
        prescription__patient=patient,
        date_confirmation__date__gte=today - timezone.timedelta(days=30)
    ).order_by('-date_confirmation')
    
    context = {
        'proche': proche,
        'patient': patient,
        'prescriptions_actives': prescriptions_actives,
        'historique': historique,
        'today': today,
        'now': now,
    }
    return render(request, 'proches/detail_patient.html', context)


# ==================== API POUR LES NOTIFICATIONS ====================

@login_required
def api_notifications(request):
    """API pour récupérer les notifications du proche"""
    if not hasattr(request.user, 'proche'):
        return JsonResponse({'error': 'Non autorisé'}, status=403)
    
    proche = request.user.proche
    today = timezone.now().date()
    now = timezone.localtime(timezone.now())
    
    notifications = []
    
    for patient in proche.patients.all():
        # Récupérer le nom du patient
        if hasattr(patient, 'user') and patient.user:
            patient_nom = patient.user.get_full_name() or patient.user.username
        else:
            patient_nom = patient.telephone
        
        prescriptions = patient.prescriptions.filter(
            date_debut__lte=today,
            date_fin__gte=today
        )
        
        for prescription in prescriptions:
            # Vérifier si non pris aujourd'hui
            if not prescription.a_deja_confirme_aujourdhui():
                heure_prevue = prescription.heure_prise
                heure_actuelle = now.time()
                
                minutes_prevues = heure_prevue.hour * 60 + heure_prevue.minute
                minutes_actuelles = heure_actuelle.hour * 60 + heure_actuelle.minute
                diff_minutes = minutes_actuelles - minutes_prevues
                
                # Alerte à partir de 5 minutes de retard
                if diff_minutes >= 5:
                    # Formater le retard
                    if diff_minutes > 60:
                        retard_text = f"{diff_minutes // 60}h{diff_minutes % 60}min"
                    else:
                        retard_text = f"{diff_minutes} minutes"
                    
                    notifications.append({
                        'patient_id': patient.id,
                        'patient_nom': patient_nom,
                        'patient_telephone': patient.telephone,
                        'prescription_id': prescription.id,
                        'medicament': prescription.medicament.nom,
                        'dose': prescription.medicament.dose,
                        'retard_minutes': diff_minutes,
                        'retard_text': retard_text,
                        'heure_prevue': heure_prevue.strftime('%H:%M'),
                        'message': f"{patient_nom} n'a pas pris {prescription.medicament.nom} - Retard de {retard_text}"
                    })
    
    # Trier par retard décroissant
    notifications.sort(key=lambda x: x['retard_minutes'], reverse=True)
    
    return JsonResponse({
        'notifications': notifications,
        'unread_count': len(notifications),
        'total': len(notifications)
    })


@login_required
def api_verifier_alertes(request):
    """
    API pour vérifier les alertes en temps réel.
    Retourne :
      - alertes_retard        : prescriptions avec >= 5 min de retard
      - prescriptions_imminentes : prescriptions actives non encore en retard
        (permet au frontend de programmer des timers précis)
    """
    if not hasattr(request.user, 'proche'):
        return JsonResponse({'error': 'Non autorisé'}, status=403)

    proche = request.user.proche
    now = timezone.localtime(timezone.now())
    today = now.date()

    alertes_retard = []
    prescriptions_imminentes = []

    for patient in proche.patients.all():
        if hasattr(patient, 'user') and patient.user:
            patient_nom = patient.user.get_full_name() or patient.user.username
        else:
            patient_nom = patient.telephone

        prescriptions = patient.prescriptions.filter(
            date_debut__lte=today,
            date_fin__gte=today
        )

        for prescription in prescriptions:
            if prescription.a_deja_confirme_aujourdhui():
                continue

            heure_prevue = prescription.heure_prise
            heure_actuelle = now.time()

            minutes_prevues = heure_prevue.hour * 60 + heure_prevue.minute
            minutes_actuelles = heure_actuelle.hour * 60 + heure_actuelle.minute
            diff_minutes = minutes_actuelles - minutes_prevues

            if diff_minutes >= 5:
                # Retard >= 5 min → alerte retard pour le proche
                alertes_retard.append({
                    'patient': patient_nom,
                    'patient_nom': patient_nom,
                    'patient_telephone': patient.telephone,
                    'medicament': prescription.medicament.nom,
                    'dose': prescription.medicament.dose,
                    'retard': diff_minutes,
                    'retard_minutes': diff_minutes,
                    'prescription_id': prescription.id,
                    'heure_prevue': heure_prevue.strftime('%H:%M')
                })
            else:
                # Pas encore en retard (heure pas encore atteinte OU 0-4 min après)
                # Le frontend programmera un timer précis pour H et H+5min
                prescriptions_imminentes.append({
                    'prescription_id': prescription.id,
                    'patient': patient_nom,
                    'patient_nom': patient_nom,
                    'patient_telephone': patient.telephone,
                    'medicament': prescription.medicament.nom,
                    'dose': prescription.medicament.dose,
                    'heure_prevue': heure_prevue.strftime('%H:%M')
                })

    return JsonResponse({
        'alertes_retard': alertes_retard,
        'prescriptions_imminentes': prescriptions_imminentes,
        'total_alertes': len(alertes_retard)
    })


@login_required
def api_confirmer_prise(request, prescription_id):
    """API pour confirmer qu'un patient a pris son médicament"""
    if not hasattr(request.user, 'proche'):
        return JsonResponse({'error': 'Non autorisé'}, status=403)
    
    proche = request.user.proche
    
    try:
        prescription = Prescription.objects.get(
            id=prescription_id,
            patient__in=proche.patients.all()
        )
        
        if prescription.a_deja_confirme_aujourdhui():
            return JsonResponse({
                'success': False,
                'message': 'Cette prise a déjà été confirmée aujourd\'hui'
            })
        
        confirmation = ConfirmationPrise.objects.create(
            prescription=prescription,
            a_ete_pris=True,
            notes=f"Confirmé par le proche {proche.nom}"
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Prise confirmée avec succès',
            'confirmation_id': confirmation.id
        })
        
    except Prescription.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Prescription non trouvée'
        }, status=404)


@login_required
def api_marquer_lues(request):
    """API pour marquer les notifications comme lues"""
    if not hasattr(request.user, 'proche'):
        return JsonResponse({'error': 'Non autorisé'}, status=403)
    
    return JsonResponse({'success': True})