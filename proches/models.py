from django.db import models
from django.contrib.auth.models import User
from patients.models import Patient

class Proche(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='proche')
    nom = models.CharField(max_length=100)
    telephone = models.CharField(max_length=20, unique=True)
    patients = models.ManyToManyField(Patient, related_name='proches', blank=True)
    date_liaison = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.nom} (suivi de {self.patients.count()} patient(s))"
    
    def get_patients_avec_suivi(self):
        """Récupère tous les patients avec leur taux d'adhésion"""
        from patients.models import Prescription, ConfirmationPrise
        from django.utils import timezone
        
        patients_data = []
        for patient in self.patients.all():
            prescriptions = Prescription.objects.filter(patient=patient)
            total_attendues = 0
            total_confirmations = 0
            
            for prescription in prescriptions:
                jours = (prescription.date_fin - prescription.date_debut).days + 1
                total_attendues += jours
                confirmations = ConfirmationPrise.objects.filter(
                    prescription=prescription,
                    date_confirmation__gte=prescription.date_debut,
                    date_confirmation__lte=prescription.date_fin
                ).count()
                total_confirmations += confirmations
            
            taux = (total_confirmations / total_attendues * 100) if total_attendues > 0 else 0
            
            patients_data.append({
                'patient': patient,
                'taux_adhesion': round(taux, 2),
                'total_confirmations': total_confirmations,
                'total_attendues': total_attendues
            })
        
        return patients_data