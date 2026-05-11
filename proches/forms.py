from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm
from .models import Proche

class ConnexionProcheForm(forms.Form):
    username = forms.CharField(max_length=150, label="Nom d'utilisateur")
    password = forms.CharField(widget=forms.PasswordInput, label="Mot de passe")

class InscriptionProcheForm(UserCreationForm):
    nom = forms.CharField(max_length=100, required=True, label="Nom complet")
    telephone = forms.CharField(max_length=20, required=True, label="Téléphone")
    code_acces = forms.CharField(max_length=50, required=True, 
                                 label="Code d'accès", 
                                 help_text="Code donné par le médecin")
    
    class Meta:
        model = User
        fields = ['username', 'nom', 'telephone', 'password1', 'password2']
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control'}),
            'password1': forms.PasswordInput(attrs={'class': 'form-control'}),
            'password2': forms.PasswordInput(attrs={'class': 'form-control'}),
        }