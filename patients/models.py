from django.db import models
from django.contrib.auth.models import User
from medecins.models import Medicament, Medecin
from django.utils import timezone

class Patient(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    telephone = models.CharField(max_length=20)
    date_inscription = models.DateField(auto_now_add=True)
    medecins = models.ManyToManyField(Medecin, related_name='patients', blank=True)
    
    def __str__(self):
        return self.user.username
    
    def get_prescriptions_actives(self):
        today = timezone.now().date()
        return self.prescriptions.filter(date_debut__lte=today, date_fin__gte=today)

class Prescription(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='prescriptions')
    medicament = models.ForeignKey(Medicament, on_delete=models.CASCADE, related_name='prescriptions')
    medecin = models.ForeignKey(Medecin, on_delete=models.CASCADE, related_name='prescriptions')
    heure_prise = models.TimeField()
    date_debut = models.DateField()
    date_fin = models.DateField()
    date_prescription = models.DateField(auto_now_add=True)
    
    def est_active(self):
        today = timezone.now().date()
        return self.date_debut <= today <= self.date_fin
    
    def a_deja_confirme_aujourdhui(self):
        today = timezone.now().date()
        return self.confirmations.filter(date_confirmation=today).exists()
    
    def __str__(self):
        return f"{self.patient} - {self.medicament} à {self.heure_prise}"

class ConfirmationPrise(models.Model):
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name='confirmations')
    date_confirmation = models.DateField(auto_now_add=True)
    heure_confirmation = models.TimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['prescription', 'date_confirmation']
    
    def __str__(self):
        return f"{self.prescription.patient} - {self.prescription.medicament.nom} le {self.date_confirmation}"