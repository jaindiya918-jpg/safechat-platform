from django.urls import path
from . import views
from .views import PostListCreateView, LikePostView, IncrementViewView, PostDeleteView, ReportPostView


urlpatterns = [
    path('check/', views.ToxicityCheckView.as_view(), name='toxicity-check'),
    path('check_ai_image/', views.CheckAIImageView.as_view(), name='check-ai-image'),
    path('check_rumor/', views.CheckRumorView.as_view(), name='check-rumor'),
    path('warnings/', views.WarningListView.as_view(), name='warning-list'),
    path('warnings/user/<int:user_id>/', views.UserWarningsView.as_view(), name='user-warnings'),
    path('restrict/', views.RestrictUserView.as_view(), name='restrict-user'),
    path('restrictions/', views.RestrictionListView.as_view(), name='restriction-list'),
    path('', PostListCreateView.as_view(), name='post-list-create'),
    path('<int:pk>/like/', LikePostView.as_view(), name='post-like'),
    path('<int:pk>/view/', IncrementViewView.as_view(), name='post-view'),
    path('<int:pk>/report/', ReportPostView.as_view(), name='post-report'),
    path('<int:pk>/', PostDeleteView.as_view(), name='post-delete'),

]
