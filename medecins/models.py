from django.db import models
from django.contrib.auth.models import User

class Medecin(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    nom = models.CharField(max_length=100)
    telephone = models.CharField(max_length=20, blank=True)
    
    def __str__(self):
        return f"Dr. {self.nom}"

class Medicament(models.Model):
    nom = models.CharField(max_length=200)
    dose = models.CharField(max_length=100)
    instruction = models.TextField(blank=True)
    cree_par = models.ForeignKey(Medecin, on_delete=models.CASCADE, related_name='medicaments')
    date_creation = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.nom} ({self.dose})"