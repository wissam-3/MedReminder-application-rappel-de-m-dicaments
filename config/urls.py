from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.contrib.auth.views import LogoutView
from django.http import JsonResponse
from . import views
from patients.tasks import traiter_alertes
from patients import views as patients_views
from proches import views as proches_views


# Vue de test pour Celery
def test_celery(request):
    """
    URL de test pour vérifier que Celery fonctionne correctement
    """
    try:
        # Lancer la tâche asynchrone
        resultat = traiter_alertes.delay()
        return JsonResponse({
            'status': 'success',
            'message': 'Tâche Celery démarrée avec succès',
            'task_id': resultat.id,
            'task_status': resultat.status
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Erreur lors du lancement de la tâche: {str(e)}'
        }, status=500)


def test_celery_status(request):
    """
    Vérifie si Celery est opérationnel
    """
    from celery import current_app
    try:
        # Vérifier la connexion au broker Redis
        current_app.control.ping(timeout=1.0)
        return JsonResponse({
            'status': 'ok',
            'message': 'Celery fonctionne correctement',
            'broker': current_app.conf.broker_url
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Celery n\'est pas disponible: {str(e)}'
        }, status=503)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', TemplateView.as_view(template_name='accueil.html'), name='accueil'),
    path('connexion/', views.connexion_unique, name='connexion'),
    path('logout/', LogoutView.as_view(next_page='accueil'), name='logout'),
    
    # URLs des applications
    path('medecins/', include('medecins.urls')),
    path('patients/', include('patients.urls')),
    path('proches/', include('proches.urls')),
    
    # API routes - Patients
    path('api/patients/mes-alertes/', patients_views.api_mes_alertes, name='api_mes_alertes'),
    path('api/patients/confirmer-prise/', patients_views.api_confirmer_prise, name='api_confirmer_prise'),
    path('api/patients/verifier-prises/', patients_views.api_verifier_prises, name='api_verifier_prises'),
    
    # API routes - Proches
    path('api/proches/verifier-alertes/', proches_views.api_verifier_alertes, name='api_verifier_alertes_proches'),
    
    # URLs de test pour Celery
    path('test-celery/', test_celery, name='test_celery'),
    path('test-celery-status/', test_celery_status, name='test_celery_status'),
]