from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm

class InscriptionPatientForm(UserCreationForm):
    telephone = forms.CharField(max_length=20, required=True)
    code_medecin = forms.CharField(max_length=50, required=False, 
                                   help_text="Code du médecin (son nom d'utilisateur) - optionnel")
    
    class Meta:
        model = User
        fields = ['username', 'telephone', 'password1', 'password2']
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control'}),
            'telephone': forms.TextInput(attrs={'class': 'form-control'}),
            'password1': forms.PasswordInput(attrs={'class': 'form-control'}),
            'password2': forms.PasswordInput(attrs={'class': 'form-control'}),
        }