from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.http import JsonResponse
from django.contrib.auth.models import User
from .models import Patient, Prescription, ConfirmationPrise
from .forms import InscriptionPatientForm
from medecins.models import Medecin


def inscription(request):
    if request.method == 'POST':
        form = InscriptionPatientForm(request.POST)
        if form.is_valid():
            user = form.save()
            patient = Patient.objects.create(
                user=user,
                telephone=form.cleaned_data['telephone']
            )
            
            code_medecin = form.cleaned_data.get('code_medecin')
            if code_medecin:
                try:
                    medecin = Medecin.objects.get(user__username=code_medecin)
                    patient.medecins.add(medecin)
                    messages.success(request, f'✅ Vous avez été ajouté au Dr. {medecin.nom}')
                except Medecin.DoesNotExist:
                    messages.warning(request, '⚠️ Code médecin invalide. Vous pourrez ajouter un médecin plus tard.')
            
            login(request, user)
            messages.success(request, 'Inscription réussie ! Bienvenue sur MedReminder')
            return redirect('patients:mes_medicaments')
    else:
        form = InscriptionPatientForm()
    
    return render(request, 'patients/inscription.html', {'form': form})


def connexion(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        
        if user is not None and hasattr(user, 'patient'):
            login(request, user)
            messages.success(request, f'Bonjour {user.username} !')
            return redirect('patients:mes_medicaments')
        else:
            messages.error(request, 'Identifiants invalides ou vous n\'êtes pas un patient')
    
    return render(request, 'patients/connexion.html')


def deconnexion(request):
    logout(request)
    messages.info(request, 'Vous avez été déconnecté')
    return redirect('accueil')


@login_required
def mes_medicaments(request):
    if not hasattr(request.user, 'patient'):
        messages.error(request, 'Accès réservé aux patients')
        return redirect('accueil')
    
    patient = request.user.patient
    today = timezone.now().date()
    
    # Récupérer les prescriptions actives
    prescriptions_actives = patient.prescriptions.filter(
        date_debut__lte=today,
        date_fin__gte=today
    ).order_by('heure_prise')
    
    # Ajouter l'info si déjà confirmé aujourd'hui
    for prescription in prescriptions_actives:
        prescription.deja_confirme = prescription.a_deja_confirme_aujourdhui()
    
    # Récupérer l'historique des confirmations des 7 derniers jours
    historique_recent = ConfirmationPrise.objects.filter(
        prescription__patient=patient,
        date_confirmation__gte=today - timezone.timedelta(days=7)
    ).order_by('-date_confirmation')
    
    context = {
        'patient': patient,
        'prescriptions_actives': prescriptions_actives,
        'historique_recent': historique_recent,
        'today': today,
    }
    return render(request, 'patients/mes_medicaments.html', context)


@login_required
def valider_prise(request, prescription_id):
    if not hasattr(request.user, 'patient'):
        messages.error(request, 'Accès réservé aux patients')
        return redirect('accueil')
    
    patient = request.user.patient
    prescription = get_object_or_404(Prescription, id=prescription_id, patient=patient)
    
    # Vérifier si la prescription est active
    if not prescription.est_active():
        messages.error(request, 'Ce traitement n\'est plus actif')
        return redirect('patients:mes_medicaments')
    
    # Vérifier si déjà confirmé aujourd'hui
    if prescription.a_deja_confirme_aujourdhui():
        messages.warning(request, f'Vous avez déjà validé la prise de {prescription.medicament.nom} pour aujourd\'hui')
        return redirect('patients:mes_medicaments')
    
    # Créer la confirmation
    ConfirmationPrise.objects.create(prescription=prescription)
    messages.success(request, f'✅ Prise de {prescription.medicament.nom} validée !')
    
    return redirect('patients:mes_medicaments')


@login_required
def historique(request):
    if not hasattr(request.user, 'patient'):
        messages.error(request, 'Accès réservé aux patients')
        return redirect('accueil')
    
    patient = request.user.patient
    
    # Toutes les confirmations triées par date
    toutes_confirmations = ConfirmationPrise.objects.filter(
        prescription__patient=patient
    ).order_by('-date_confirmation')
    
    # Regrouper par mois
    confirmations_par_mois = {}
    for confirmation in toutes_confirmations:
        mois = confirmation.date_confirmation.strftime('%B %Y')
        if mois not in confirmations_par_mois:
            confirmations_par_mois[mois] = []
        confirmations_par_mois[mois].append(confirmation)
    
    context = {
        'patient': patient,
        'confirmations_par_mois': confirmations_par_mois,
        'total_confirmations': toutes_confirmations.count(),
    }
    return render(request, 'patients/historique.html', context)


# ==================== API POUR ALERTES SONORES ====================
@login_required
def api_verifier_prises(request):
    """
    API pour vérifier les prises en temps réel (alertes sonores)
    Appelée toutes les 30 secondes par JavaScript
    """
    if not hasattr(request.user, 'patient'):
        return JsonResponse({'error': 'Non autorisé'}, status=403)
    
    patient = request.user.patient
    # Utiliser l'heure locale (important pour les fuseaux horaires)
    now = timezone.localtime(timezone.now())
    today = now.date()
    
    # Récupérer les prescriptions actives
    prescriptions = patient.prescriptions.filter(
        date_debut__lte=today,
        date_fin__gte=today
    )
    
    alertes_immediates = []
    alertes_retard = []
    
    for prescription in prescriptions:
        # Vérifier si déjà validé aujourd'hui
        deja_valide = ConfirmationPrise.objects.filter(
            prescription=prescription,
            date_confirmation=today
        ).exists()
        
        if deja_valide:
            continue
        
        heure_prevue = prescription.heure_prise
        heure_actuelle = now.time()
        
        # Convertir en minutes depuis minuit pour comparaison précise
        minutes_prevues = heure_prevue.hour * 60 + heure_prevue.minute
        minutes_actuelles = heure_actuelle.hour * 60 + heure_actuelle.minute
        
        diff_minutes = minutes_actuelles - minutes_prevues
        
        # ALERTE IMMÉDIATE (0 à 4 minutes après l'heure prévue)
        # Jouera rappel.mp3 chaque minute via Javascript
        if 0 <= diff_minutes < 5:
            alertes_immediates.append({
                'medicament': prescription.medicament.nom,
                'dose': prescription.medicament.dose,
                'heure_prevue': heure_prevue.strftime('%H:%M'),
                'prescription_id': prescription.id
            })
            # Affichage dans la console du serveur pour déboguer
            print(f"🔔 ALERTE SONORE à {heure_actuelle.strftime('%H:%M:%S')} pour {prescription.medicament.nom}")
        
        # Alerte de retard (à partir de 5 minutes)
        elif diff_minutes >= 5:
            alertes_retard.append({
                'medicament': prescription.medicament.nom,
                'dose': prescription.medicament.dose,
                'heure_prevue': heure_prevue.strftime('%H:%M'),
                'retard': diff_minutes
            })
            print(f"⚠️ RETARD de {diff_minutes} min pour {prescription.medicament.nom}")
    
    return JsonResponse({
        'alertes_immediates': alertes_immediates,
        'alertes_retard': alertes_retard,
        'timestamp': now.isoformat()
    })


@login_required
def api_mes_alertes(request):
    """
    API pour récupérer les alertes actuelles du patient
    Appelée par JavaScript pour afficher les notifications sonores
    """
    if not hasattr(request.user, 'patient'):
        return JsonResponse({'error': 'Non autorisé'}, status=403)
    
    patient = request.user.patient
    now = timezone.localtime(timezone.now())
    today = now.date()
    
    # Récupérer les prescriptions actives
    prescriptions = patient.prescriptions.filter(
        date_debut__lte=today,
        date_fin__gte=today
    )
    
    alertes = []
    
    for prescription in prescriptions:
        # Vérifier si déjà validé aujourd'hui
        deja_confirme = ConfirmationPrise.objects.filter(
            prescription=prescription,
            date_confirmation=today
        ).exists()
        
        if deja_confirme:
            continue
        
        heure_prevue = prescription.heure_prise
        heure_actuelle = now.time()
        
        # Convertir en minutes depuis minuit
        minutes_prevues = heure_prevue.hour * 60 + heure_prevue.minute
        minutes_actuelles = heure_actuelle.hour * 60 + heure_actuelle.minute
        
        diff_minutes = minutes_actuelles - minutes_prevues
        
        # Alerte si l'heure est atteinte ou dépassée, ou dans les 5 prochaines minutes
        if diff_minutes >= -5:  # Inclure les 5 minutes avant
            alertes.append({
                'prescription_id': prescription.id,
                'medicament_nom': prescription.medicament.nom,
                'dose': prescription.medicament.dose,
                'heure_prevue': heure_prevue.strftime('%H:%M'),
                'retard_minutes': max(0, diff_minutes),  # Retard positif seulement
                'minutes_avant': max(0, -diff_minutes),  # Minutes avant l'heure
                'url_confirmer': f'/patients/valider-prise/{prescription.id}/'
            })
    
    return JsonResponse({
        'alertes': alertes,
        'count': len(alertes),
        'timestamp': now.isoformat()
    })


@login_required
def api_confirmer_prise(request):
    """
    API pour confirmer la prise d'un médicament (via AJAX)
    Retour JSON pour mettre à jour le front-end
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Méthode non autorisée'}, status=405)
    
    if not hasattr(request.user, 'patient'):
        return JsonResponse({'error': 'Non autorisé'}, status=403)
    
    import json
    try:
        data = json.loads(request.body)
        prescription_id = data.get('prescription_id')
    except:
        return JsonResponse({'error': 'Données invalides'}, status=400)
    
    patient = request.user.patient
    prescription = get_object_or_404(Prescription, id=prescription_id, patient=patient)
    
    today = timezone.now().date()
    
    # Vérifier si déjà confirmé
    if prescription.a_deja_confirme_aujourdhui():
        return JsonResponse({
            'success': False,
            'message': f'Prise déjà confirmée pour {prescription.medicament.nom}'
        })
    
    # Créer la confirmation
    ConfirmationPrise.objects.create(prescription=prescription)
    
    return JsonResponse({
        'success': True,
        'message': f'✅ Prise de {prescription.medicament.nom} confirmée !',
        'prescription_id': prescription_id
    })