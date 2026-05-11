from django.urls import path
from . import views

app_name = 'proches'

urlpatterns = [
    # Authentification
    path('inscription/', views.inscription, name='inscription'),
    path('connexion/', views.connexion, name='connexion'),
    path('deconnexion/', views.deconnexion, name='deconnexion'),
    
    # Dashboard
    path('tableau-bord/', views.tableau_bord, name='tableau_bord'),
    path('patient/<int:patient_id>/', views.detail_patient, name='detail_patient'),
    
    # APIs
    path('api/notifications/', views.api_notifications, name='api_notifications'),
    path('api/verifier-alertes/', views.api_verifier_alertes, name='api_verifier_alertes'),
    path('api/confirmer-prise/<int:prescription_id>/', views.api_confirmer_prise, name='api_confirmer_prise'),
    path('api/marquer-lues/', views.api_marquer_lues, name='api_marquer_lues'),
    
    # Redirection
    path('', views.tableau_bord, name='home'),
]