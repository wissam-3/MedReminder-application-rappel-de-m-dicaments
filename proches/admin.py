from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from .models import Proche

@admin.register(Proche)
class ProcheAdmin(admin.ModelAdmin):
    # Liste des colonnes affichées
    list_display = [
        'id',
        'nom', 
        'telephone',
        'get_username',
        'get_email',
        'nb_patients',
        'date_liaison',
        'lien_utilisateur'
    ]
    
    # Champs de recherche
    search_fields = [
        'nom', 
        'telephone',
        'user__username',
        'user__email',
        'patients__user__username'
    ]
    
    # Filtres latéraux
    list_filter = [
        'date_liaison',
        ('patients', admin.RelatedOnlyFieldListFilter),  # Filtre par patient
    ]
    
    # Champs en lecture seule
    readonly_fields = [
        'date_liaison',
        'lien_utilisateur',
        'lien_patients',
        'statistiques'
    ]
    
    # Organisation des champs dans le formulaire d'édition
    fieldsets = (
        ('Informations personnelles', {
            'fields': (
                'user',
                'nom',
                'telephone',
                'lien_utilisateur'
            )
        }),
        ('Patients suivis', {
            'fields': (
                'patients',
                'lien_patients',
                'nb_patients_suivis'
            ),
            'classes': ('collapse',)
        }),
        ('Statistiques', {
            'fields': (
                'statistiques',
                'date_liaison'
            ),
            'classes': ('collapse',)
        }),
    )
    
    # Filtre horizontal pour la ManyToMany (plus beau que le multiselect)
    filter_horizontal = ['patients']
    
    # Champs à pré-remplir
    prepopulated_fields = {}  # Pas nécessaire pour ce modèle
    
    # Actions personnalisées
    actions = ['envoyer_email_rapport', 'exporter_csv']
    
    # Pagination
    list_per_page = 25
    
    # Ordre par défaut
    ordering = ['-date_liaison']
    
    # Champs pour le formulaire d'ajout rapide
    autocomplete_fields = ['user', 'patients']
    
    # ==================== MÉTHODES PERSONNALISÉES ====================
    
    def get_username(self, obj):
        """Affiche le nom d'utilisateur associé"""
        if obj.user:
            return obj.user.username
        return "-"
    get_username.short_description = "Nom d'utilisateur"
    get_username.admin_order_field = 'user__username'
    
    def get_email(self, obj):
        """Affiche l'email de l'utilisateur"""
        if obj.user and obj.user.email:
            return format_html(
                '<a href="mailto:{}">{}</a>',
                obj.user.email,
                obj.user.email
            )
        return "-"
    get_email.short_description = "Email"
    get_email.admin_order_field = 'user__email'
    
    def nb_patients(self, obj):
        """Affiche le nombre de patients suivis"""
        count = obj.patients.count()
        if count > 0:
            return format_html(
                '<span class="badge bg-primary">{}</span>',
                count
            )
        return format_html('<span class="badge bg-secondary">0</span>', count)
    nb_patients.short_description = "Nb patients"
    nb_patients.admin_order_field = 'patients__count'
    
    def nb_patients_suivis(self, obj):
        """Affiche la liste des patients avec leurs détails"""
        patients = obj.patients.all()
        if patients:
            html = '<div style="max-height: 200px; overflow-y: auto;">'
            for patient in patients:
                html += f'''
                <div class="mb-1">
                    <strong>📱 {patient.user.username}</strong><br>
                    <small>Tél: {patient.telephone}</small>
                    <hr class="my-1">
                </div>
                '''
            html += '</div>'
            return format_html(html)
        return "Aucun patient suivi"
    nb_patients_suivis.short_description = "Détail des patients"
    
    def lien_utilisateur(self, obj):
        """Lien vers l'utilisateur dans l'admin"""
        if obj.user:
            url = reverse('admin:auth_user_change', args=[obj.user.id])
            return format_html(
                '<a href="{}" class="button" target="_blank">👤 Voir l\'utilisateur</a>',
                url
            )
        return "-"
    lien_utilisateur.short_description = "Lien utilisateur"
    
    def lien_patients(self, obj):
        """Liens vers les patients dans l'admin"""
        patients = obj.patients.all()
        if patients:
            html = '<div>'
            for patient in patients:
                url = reverse('admin:patients_patient_change', args=[patient.id])
                html += format_html(
                    '<div><a href="{}" target="_blank">📋 {}</a></div>',
                    url,
                    patient.user.username if patient.user else patient.telephone
                )
            html += '</div>'
            return format_html(html)
        return "-"
    lien_patients.short_description = "Liens patients"
    
    def statistiques(self, obj):
        """Affiche les statistiques du proche"""
        nb_retards = obj.get_nb_retards_aujourdhui()
        taux_global = obj.get_taux_adhesion_global()
        
        # Couleur selon le taux
        taux_color = 'success' if taux_global >= 80 else 'warning' if taux_global >= 50 else 'danger'
        
        html = f'''
        <div class="stats-container">
            <div class="stat-item">
                <strong>📊 Taux d'adhésion global :</strong>
                <span class="badge bg-{taux_color}" style="font-size: 14px;">{taux_global}%</span>
            </div>
            <div class="stat-item mt-2">
                <strong>⚠️ Retards aujourd'hui :</strong>
                <span class="badge bg-danger" style="font-size: 14px;">{nb_retards}</span>
            </div>
            <div class="stat-item mt-2">
                <strong>📅 Inscrit depuis :</strong>
                {obj.date_liaison.strftime('%d/%m/%Y')}
            </div>
        </div>
        '''
        
        # Style CSS
        html += '''
        <style>
            .stats-container {
                background: #f8f9fa;
                padding: 10px;
                border-radius: 8px;
            }
            .stat-item {
                margin-bottom: 5px;
            }
        </style>
        '''
        
        return format_html(html)
    statistiques.short_description = "Statistiques"
    
    # ==================== ACTIONS PERSONNALISÉES ====================
    
    def envoyer_email_rapport(self, request, queryset):
        """Action pour envoyer un rapport par email aux proches sélectionnés"""
        from django.core.mail import send_mail
        from django.conf import settings
        
        emails_envoyes = 0
        for proche in queryset:
            if proche.user and proche.user.email:
                try:
                    send_mail(
                        f'Rappel Médicaments - Rapport pour {proche.nom}',
                        f'''
                        Bonjour {proche.nom},
                        
                        Voici votre rapport :
                        - Patients suivis : {proche.patients.count()}
                        - Retards aujourd'hui : {proche.get_nb_retards_aujourdhui()}
                        - Taux d'adhésion global : {proche.get_taux_adhesion_global()}%
                        
                        Connectez-vous pour plus de détails.
                        ''',
                        settings.DEFAULT_FROM_EMAIL,
                        [proche.user.email],
                        fail_silently=False,
                    )
                    emails_envoyes += 1
                except Exception as e:
                    self.message_user(request, f"Erreur pour {proche.nom}: {e}")
        
        self.message_user(request, f"{emails_envoyes} rapport(s) envoyé(s) avec succès.")
    
    envoyer_email_rapport.short_description = "📧 Envoyer un rapport par email"
    
    def exporter_csv(self, request, queryset):
        """Action pour exporter les données en CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="proches_export.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Nom', 'Téléphone', 'Username', 'Email', 
            'Nb Patients', 'Taux Adhésion (%)', 'Retards Aujourd\'hui', 
            'Date Inscription'
        ])
        
        for proche in queryset:
            writer.writerow([
                proche.id,
                proche.nom,
                proche.telephone,
                proche.user.username if proche.user else '',
                proche.user.email if proche.user else '',
                proche.patients.count(),
                proche.get_taux_adhesion_global(),
                proche.get_nb_retards_aujourdhui(),
                proche.date_liaison.strftime('%d/%m/%Y %H:%M')
            ])
        
        return response
    
    exporter_csv.short_description = "📊 Exporter en CSV"
    
    # ==================== MÉTHODES DE SURCHARGE ====================
    
    def get_queryset(self, request):
        """Optimiser les requêtes avec select_related et prefetch_related"""
        return super().get_queryset(request).select_related('user').prefetch_related('patients')
    
    def save_model(self, request, obj, form, change):
        """Surcharge pour ajouter des logs ou traitements spéciaux"""
        if not change:  # Nouvel objet
            # Log de création
            self.message_user(request, f"Proche '{obj.nom}' créé avec succès.")
        else:  # Modification
            self.message_user(request, f"Proche '{obj.nom}' modifié avec succès.")
        
        super().save_model(request, obj, form, change)
    
    def delete_model(self, request, obj):
        """Surcharge pour la suppression"""
        nom = obj.nom
        super().delete_model(request, obj)
        self.message_user(request, f"Proche '{nom}' supprimé avec succès.")


# ==================== INSCRIPTION DANS L'INDEX ADMIN ====================
admin.site.site_header = "Rappel Médicaments - Administration"
admin.site.site_title = "Rappel Médicaments Admin"
admin.site.index_title = "Bienvenue dans l'administration"