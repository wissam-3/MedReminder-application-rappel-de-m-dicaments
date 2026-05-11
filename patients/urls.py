from django.urls import path
from . import views

app_name = 'patients'

urlpatterns = [
    path('inscription/', views.inscription, name='inscription'),
    path('connexion/', views.connexion, name='connexion'),
    path('deconnexion/', views.deconnexion, name='deconnexion'),
    path('mes-medicaments/', views.mes_medicaments, name='mes_medicaments'),
    path('valider-prise/<int:prescription_id>/', views.valider_prise, name='valider_prise'),
    path('historique/', views.historique, name='historique'),
    
    # API pour les alertes sonores (appelée par JavaScript)
    path('api/verifier-prises/', views.api_verifier_prises, name='api_verifier_prises'),
    path('api/mes-alertes/', views.api_mes_alertes, name='api_mes_alertes'),
    path('api/confirmer-prise/', views.api_confirmer_prise, name='api_confirmer_prise'),
]