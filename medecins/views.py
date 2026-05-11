from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.http import JsonResponse
from django.contrib.auth.models import User
from .models import Medecin, Medicament
from .forms import InscriptionMedecinForm, MedicamentForm
from patients.models import Patient, Prescription, ConfirmationPrise
from proches.models import Proche


def inscription(request):
    if request.method == 'POST':
        form = InscriptionMedecinForm(request.POST)
        if form.is_valid():
            user = form.save()
            medecin = Medecin.objects.create(
                user=user,
                nom=form.cleaned_data['nom'],
                telephone=form.cleaned_data['telephone']
            )
            login(request, user)
            messages.success(request, 'Inscription réussie !')
            return redirect('medecins:dashboard')
    else:
        form = InscriptionMedecinForm()
    return render(request, 'medecins/inscription.html', {'form': form})


def connexion(request):
    if request.method == 'POST':
        username = request.POST['username']
        password = request.POST['password']
        user = authenticate(request, username=username, password=password)
        if user is not None and hasattr(user, 'medecin'):
            login(request, user)
            return redirect('medecins:dashboard')
        else:
            messages.error(request, 'Identifiants invalides')
    return render(request, 'medecins/connexion.html')


def deconnexion(request):
    logout(request)
    return redirect('accueil')


@login_required
def dashboard(request):
    if not hasattr(request.user, 'medecin'):
        return redirect('accueil')
    
    medecin = request.user.medecin
    patients = Patient.objects.filter(medecins=medecin)
    today = timezone.now().date()
    
    # Compter les médicaments du médecin
    total_medicaments = Medicament.objects.filter(cree_par=medecin).count()
    
    # Compter les traitements actifs
    total_traitements_actifs = 0
    patients_data = []
    
    for patient in patients:
        # Traitements actifs du patient
        traitements_actifs = patient.prescriptions.filter(
            date_debut__lte=today,
            date_fin__gte=today
        ).count()
        total_traitements_actifs += traitements_actifs
        
        # Calculer le taux d'adhésion du patient
        toutes_prescriptions = patient.prescriptions.all()
        total_attendues = 0
        total_confirmations = 0
        
        for prescription in toutes_prescriptions:
            jours_attendus = (prescription.date_fin - prescription.date_debut).days + 1
            total_attendues += jours_attendus
            confirmations = ConfirmationPrise.objects.filter(prescription=prescription).count()
            total_confirmations += confirmations
        
        taux_adhesion = (total_confirmations / total_attendues * 100) if total_attendues > 0 else 0
        
        patients_data.append({
            'patient': patient,
            'traitements_actifs': traitements_actifs,
            'total_confirmations': total_confirmations,
            'total_attendues': total_attendues,
            'taux_adhesion': round(taux_adhesion, 1)
        })
    
    # Moyenne d'adhésion globale
    moyenne_adhesion = 0
    if patients_data:
        moyenne_adhesion = sum([p['taux_adhesion'] for p in patients_data]) / len(patients_data)
    
    # Données pour le graphique (7 derniers jours)
    jours_semaine = []
    prises_par_jour = []
    
    for i in range(6, -1, -1):
        date = today - timezone.timedelta(days=i)
        jours_semaine.append(date.strftime('%A')[0:3])
        
        total_prises_jour = ConfirmationPrise.objects.filter(
            prescription__patient__medecins=medecin,
            date_confirmation=date
        ).count()
        prises_par_jour.append(total_prises_jour)
    
    context = {
        'medecin': medecin,
        'patients': patients,
        'patients_data': patients_data,
        'total_patients': patients.count(),
        'total_medicaments': total_medicaments,
        'total_traitements_actifs': total_traitements_actifs,
        'moyenne_adhesion': round(moyenne_adhesion, 1),
        'jours_semaine': jours_semaine,
        'prises_par_jour': prises_par_jour,
        'today': today,
    }
    return render(request, 'medecins/tableau_bord.html', context)


@login_required
def ajouter_medicament(request):
    if not hasattr(request.user, 'medecin'):
        return redirect('accueil')
    
    if request.method == 'POST':
        form = MedicamentForm(request.POST)
        if form.is_valid():
            nom = form.cleaned_data['nom']
            
            # Vérifier si le médicament existe déjà pour ce médecin
            medicament_existant = Medicament.objects.filter(
                cree_par=request.user.medecin,
                nom__iexact=nom
            ).exists()
            
            if medicament_existant:
                messages.error(request, f'⚠️ Le médicament "{nom}" existe déjà dans votre catalogue !')
                return redirect('medecins:liste_medicaments')
            
            # Créer le nouveau médicament
            medicament = form.save(commit=False)
            medicament.cree_par = request.user.medecin
            medicament.save()
            messages.success(request, f'✅ Médicament "{nom}" ajouté avec succès !')
            return redirect('medecins:liste_medicaments')
    else:
        form = MedicamentForm()
    
    return render(request, 'medecins/ajouter_medicament.html', {'form': form})


@login_required
def liste_medicaments(request):
    if not hasattr(request.user, 'medecin'):
        return redirect('accueil')
    
    medicaments = Medicament.objects.filter(cree_par=request.user.medecin)
    return render(request, 'medecins/lister_medicaments.html', {'medicaments': medicaments})


@login_required
def prescrire_medicament(request, patient_id):
    """Prescrire un médicament à un patient"""
    if not hasattr(request.user, 'medecin'):
        messages.error(request, 'Accès réservé aux médecins')
        return redirect('accueil')
    
    patient = get_object_or_404(Patient, id=patient_id)
    medicaments = Medicament.objects.filter(cree_par=request.user.medecin)
    
    if request.method == 'POST':
        medicament_id = request.POST.get('medicament')
        heure_prise = request.POST.get('heure_prise')
        date_debut = request.POST.get('date_debut')
        date_fin = request.POST.get('date_fin')
        
        medicament = get_object_or_404(Medicament, id=medicament_id)
        
        # Permettre les prescriptions multiples du même médicament (suppression de la vérification)
        # Le médecin peut prescrire le même médicament plusieurs fois avec des heures différentes
        
        # Créer la nouvelle prescription
        Prescription.objects.create(
            patient=patient,
            medicament=medicament,
            medecin=request.user.medecin,
            heure_prise=heure_prise,
            date_debut=date_debut,
            date_fin=date_fin
        )
        
        messages.success(request, f'✅ Prescription de {medicament.nom} à {heure_prise} ajoutée avec succès !')
        return redirect('medecins:suivi_patients')
    
    return render(request, 'medecins/prescrire_medicament.html', {
        'patient': patient,
        'medicaments': medicaments
    })


@login_required
def suivi_patients(request):
    if not hasattr(request.user, 'medecin'):
        return redirect('accueil')
    
    medecin = request.user.medecin
    patients = Patient.objects.filter(medecins=medecin)
    today = timezone.now().date()
    
    suivi_data = []
    for patient in patients:
        # Prescriptions actives
        prescriptions_actives = patient.prescriptions.filter(
            date_debut__lte=today,
            date_fin__gte=today
        )
        
        # Calcul des statistiques
        toutes_prescriptions = patient.prescriptions.all()
        total_prises = 0
        confirmations = 0
        traitements_actifs = 0
        
        for prescription in toutes_prescriptions:
            jours_attendus = (prescription.date_fin - prescription.date_debut).days + 1
            total_prises += jours_attendus
            confirmations_prises = ConfirmationPrise.objects.filter(prescription=prescription).count()
            confirmations += confirmations_prises
            traitements_actifs += 1 if prescription.est_active() else 0
        
        taux = (confirmations / total_prises * 100) if total_prises > 0 else 0
        
        suivi_data.append({
            'patient': patient,
            'prescriptions_actives': prescriptions_actives,
            'traitements_actifs': traitements_actifs,
            'total_confirmations': confirmations,
            'total_attendues': total_prises,
            'taux_adhesion': round(taux, 2)
        })
    
    return render(request, 'medecins/suivi_patients.html', {'suivi_data': suivi_data})


# ==================== NOUVELLES FONCTIONS ====================

@login_required
def liste_patients(request):
    if not hasattr(request.user, 'medecin'):
        messages.error(request, 'Accès réservé aux médecins')
        return redirect('accueil')
    
    medecin = request.user.medecin
    patients = Patient.objects.filter(medecins=medecin)
    today = timezone.now().date()
    
    patients_data = []
    for patient in patients:
        traitements_actifs = patient.prescriptions.filter(
            date_debut__lte=today,
            date_fin__gte=today
        ).count()
        
        patients_data.append({
            'patient': patient,
            'traitements_actifs': traitements_actifs,
        })
    
    return render(request, 'medecins/liste_patients.html', {
        'patients_data': patients_data,
        'patients': patients
    })


@login_required
def supprimer_traitement(request, prescription_id):
    """Supprimer une prescription"""
    if not hasattr(request.user, 'medecin'):
        messages.error(request, 'Accès réservé aux médecins')
        return redirect('accueil')
    
    medecin = request.user.medecin
    prescription = get_object_or_404(Prescription, id=prescription_id, medecin=medecin)
    
    medicament_nom = prescription.medicament.nom
    patient_nom = prescription.patient.user.get_full_name() or prescription.patient.user.username
    
    prescription.delete()
    
    messages.success(request, f'✅ Traitement "{medicament_nom}" supprimé pour le patient {patient_nom}')
    return redirect('medecins:suivi_patients')


@login_required
def verifier_medicament(request):
    """Vérifie si un médicament existe déjà (AJAX)"""
    if not hasattr(request.user, 'medecin'):
        return JsonResponse({'existe': False})
    
    nom = request.GET.get('nom', '')
    existe = Medicament.objects.filter(
        cree_par=request.user.medecin,
        nom__iexact=nom
    ).exists()
    
    return JsonResponse({'existe': existe})
@login_required
def supprimer_medicament(request, medicament_id):
    """Supprimer un médicament"""
    if not hasattr(request.user, 'medecin'):
        messages.error(request, 'Accès réservé aux médecins')
        return redirect('accueil')
    
    medecin = request.user.medecin
    medicament = get_object_or_404(Medicament, id=medicament_id, cree_par=medecin)
    
    # Stocker le nom pour le message
    nom_medicament = medicament.nom
    
    # Vérifier si le médicament est utilisé dans des prescriptions
    prescriptions_associees = Prescription.objects.filter(medicament=medicament).count()
    
    if prescriptions_associees > 0:
        messages.warning(request, f'⚠️ Le médicament "{nom_medicament}" est utilisé dans {prescriptions_associees} prescription(s). Supprimez d\'abord les prescriptions associées.')
        return redirect('medecins:liste_medicaments')
    
    # Supprimer le médicament
    medicament.delete()
    
    messages.success(request, f'✅ Médicament "{nom_medicament}" supprimé avec succès !')
    return redirect('medecins:liste_medicaments')