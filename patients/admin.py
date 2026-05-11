from django.contrib import admin
from .models import Patient, Prescription, ConfirmationPrise

@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ['user', 'telephone', 'date_inscription']
    search_fields = ['user__username', 'telephone']
    filter_horizontal = ['medecins']

@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ['patient', 'medicament', 'medecin', 'heure_prise', 'date_debut', 'date_fin']
    list_filter = ['medecin', 'date_debut', 'date_fin']
    search_fields = ['patient__user__username', 'medicament__nom']

@admin.register(ConfirmationPrise)
class ConfirmationPriseAdmin(admin.ModelAdmin):
    list_display = ['prescription', 'date_confirmation', 'heure_confirmation']
    list_filter = ['date_confirmation']