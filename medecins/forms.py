from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm
from .models import Medicament

class InscriptionMedecinForm(UserCreationForm):
    nom = forms.CharField(max_length=100, required=True, label="Nom complet")
    telephone = forms.CharField(max_length=20, required=False, label="Téléphone")
    
    class Meta:
        model = User
        fields = ['username', 'nom', 'telephone', 'password1', 'password2']
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control'}),
            'password1': forms.PasswordInput(attrs={'class': 'form-control'}),
            'password2': forms.PasswordInput(attrs={'class': 'form-control'}),
        }

class MedicamentForm(forms.ModelForm):
    class Meta:
        model = Medicament
        fields = ['nom', 'dose', 'instruction']
        widgets = {
            'nom': forms.TextInput(attrs={'class': 'form-control'}),
            'dose': forms.TextInput(attrs={'class': 'form-control'}),
            'instruction': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }