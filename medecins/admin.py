from django.contrib import admin
from .models import Medecin, Medicament

@admin.register(Medecin)
class MedecinAdmin(admin.ModelAdmin):
    list_display = ['nom', 'user', 'telephone']
    search_fields = ['nom', 'telephone']

@admin.register(Medicament)
class MedicamentAdmin(admin.ModelAdmin):
    list_display = ['nom', 'dose', 'cree_par', 'date_creation']
    list_filter = ['cree_par', 'date_creation']
    search_fields = ['nom']