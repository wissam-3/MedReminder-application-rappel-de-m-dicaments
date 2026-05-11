from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login
from django.contrib import messages
from django.contrib.auth.models import User

def connexion_unique(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            
            # DEBUG : Afficher le type d'utilisateur dans la console
            print(f"=== Connexion de : {username} ===")
            print(f"Superuser: {user.is_superuser}")
            print(f"Staff: {user.is_staff}")
            print(f"A un profil medecin: {hasattr(user, 'medecin')}")
            print(f"A un profil patient: {hasattr(user, 'patient')}")
            print(f"A un profil proche: {hasattr(user, 'proche')}")
            
            # Redirection selon le profil
            if hasattr(user, 'medecin'):
                messages.success(request, f'Bienvenue Dr. {user.medecin.nom}')
                return redirect('medecins:dashboard')
            
            elif hasattr(user, 'patient'):
                messages.success(request, f'Bienvenue {user.username}')
                return redirect('patients:mes_medicaments')
            
            elif hasattr(user, 'proche'):
                messages.success(request, f'Bienvenue {user.proche.nom}')
                return redirect('proches:tableau_bord')
            
            elif user.is_superuser or user.is_staff:
                messages.success(request, 'Bienvenue Administrateur')
                return redirect('/admin/')
            
            else:
                # Message d'erreur plus explicite
                messages.error(request, f'Profil introuvable pour "{username}". Veuillez contacter l\'administrateur pour associer un profil (Médecin/Patient/Proche) à votre compte.')
                return redirect('connexion')
        
        else:
            messages.error(request, 'Nom d\'utilisateur ou mot de passe incorrect')
            return redirect('connexion')
    
    return render(request, 'connexion.html')