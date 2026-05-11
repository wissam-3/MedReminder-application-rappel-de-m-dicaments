from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask, IntervalSchedule
from django.utils import timezone


class Command(BaseCommand):
    help = "Configurer les tâches périodiques Celery Beat pour les alertes de rappel de médicaments"

    def handle(self, *args, **options):
        # Créer l'intervalle d'une minute
        intervalle_une_minute, created = IntervalSchedule.objects.get_or_create(
            every=1,
            period=IntervalSchedule.MINUTES,
        )

        # Créer la tâche périodique pour les alertes chaque minute
        periodic_task, created = PeriodicTask.objects.get_or_create(
            name='Alerte Rappel Médicament Chaque Minute',
            defaults={
                'task': 'patients.tasks.alerte_rappel_medicament_chaque_minute',
                'interval': intervalle_une_minute,
                'enabled': True,
            }
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(
                    '✅ Tâche créée: Alerte Rappel Médicament Chaque Minute (chaque 1 minute)'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    '⚠️ Tâche déjà existante: Alerte Rappel Médicament Chaque Minute'
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                'Les alertes de rappel seront envoyées CHAQUE MINUTE jusqu\'à confirmation de la prise'
            )
        )
