from django.apps import AppConfig


class ModerationConfig(AppConfig):
    name = 'moderation'

class PostsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'posts'
