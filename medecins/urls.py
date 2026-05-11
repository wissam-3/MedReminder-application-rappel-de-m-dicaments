from django.urls import path
from . import views

app_name = 'medecins'

urlpatterns = [
    # Dashboard
    path('dashboard/', views.dashboard, name='dashboard'),
    
    # Listes
    path('liste-patients/', views.liste_patients, name='liste_patients'),
    path('lister-medicaments/', views.liste_medicaments, name='liste_medicaments'),
    # path('liste-proches/', views.liste_proches, name='liste_proches'),  # SUPPRIMÉ - Admin uniquement
    
    # Actions
    path('ajouter-medicament/', views.ajouter_medicament, name='ajouter_medicament'),
    path('prescrire/<int:patient_id>/', views.prescrire_medicament, name='prescrire'),
    # path('ajouter-proche/<int:patient_id>/', views.ajouter_proche, name='ajouter_proche'),  # SUPPRIMÉ - Admin uniquement
    path('suivi-patients/', views.suivi_patients, name='suivi_patients'),
    path('deconnexion/', views.deconnexion, name='deconnexion'),
    path('supprimer-traitement/<int:prescription_id>/', views.supprimer_traitement, name='supprimer_traitement'),
    path('verifier-medicament/', views.verifier_medicament, name='verifier_medicament'),
    path('supprimer-medicament/<int:medicament_id>/', views.supprimer_medicament, name='supprimer_medicament'),
]