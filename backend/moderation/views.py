from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
from .models import Warning, Restriction
from .serializers import WarningSerializer, RestrictionSerializer
from .ai_detector import ToxicityDetector
from rest_framework import generics, permissions, status, views
from django.shortcuts import get_object_or_404
from .models import Post, PostLike, PostReport, ConfirmedRumor
from .serializers import PostSerializer
from moderation.ai_detector import is_factually_correct

class CheckRumorView(APIView):
    def post(self, request):
        text = request.data.get('text', '')
        if not text:
            return Response({'isRumour': False, 'warning': ''})
            
        is_correct, reason = is_factually_correct(text)
        return Response({
            'isRumour': not is_correct,
            'warning': reason
        })

class ToxicityCheckView(APIView):
    def post(self, request):
        text = request.data.get('text', '')
        method = request.data.get('method', 'keyword')
        
        detector = ToxicityDetector(method=method)
        result = detector.analyze(text)
        
        return Response(result)

class CheckAIImageView(APIView):
    def post(self, request):
        image_url = request.data.get('image_url')
        if not image_url:
            return Response({'error': 'Image URL is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        from .ai_detector import AIImageDetector
        detector = AIImageDetector()
        result = detector.detect(image_url)
        
        return Response(result)

class WarningListView(generics.ListAPIView):
    queryset = Warning.objects.all().select_related('user')
    serializer_class = WarningSerializer

class UserWarningsView(APIView):
    def get(self, request, user_id):
        warnings = Warning.objects.filter(user_id=user_id).order_by('-created_at')
        serializer = WarningSerializer(warnings, many=True)
        return Response({
            'count': warnings.count(),
            'warnings': serializer.data
        })

class RestrictUserView(APIView):
    def post(self, request):
        user_id = request.data.get('user_id')
        restriction_type = request.data.get('restriction_type', 'chat')
        reason = request.data.get('reason', 'Manual restriction')
        is_permanent = request.data.get('is_permanent', False)
        
        try:
            user = User.objects.get(id=user_id)
            
            restriction = Restriction.objects.create(
                user=user,
                restriction_type=restriction_type,
                reason=reason,
                issued_by=request.user if request.user.is_authenticated else None,
                is_permanent=is_permanent
            )
            
            return Response(
                RestrictionSerializer(restriction).data,
                status=status.HTTP_201_CREATED
            )
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

class RestrictionListView(generics.ListAPIView):
    queryset = Restriction.objects.all().select_related('user')
    serializer_class = RestrictionSerializer

class PostListCreateView(generics.ListCreateAPIView):
    queryset = Post.objects.all().order_by('-created_at')
    serializer_class = PostSerializer
    permission_classes = [permissions.AllowAny] # No Django auth needed

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Allows passing user_id in query param for "is_liked" check
        context['user_id'] = self.request.query_params.get('user_id')
        return context

    def perform_create(self, serializer):
        caption = serializer.validated_data.get('caption', '')
        
        # Webz.io Fact-Checking
        is_correct, reason = is_factually_correct(caption)
        
        # Save with detected rumor status
        serializer.save(is_rumor=not is_correct, rumor_reason=reason if not is_correct else "")

class LikePostView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        like, created = PostLike.objects.get_or_create(post=post, user_id=str(user_id))
        
        if not created:
            # If already liked, toggle (remove) it
            like.delete()
            liked = False
        else:
            liked = True
            
        return Response({'liked': liked, 'likes_count': post.likes_count})

class IncrementViewView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        post.views += 1
        post.save()
        return Response({'views': post.views})

class PostDeleteView(generics.DestroyAPIView):
    queryset = Post.objects.all()
    # No auth needed for this mock setup, but we check user_id manually
    permission_classes = [permissions.AllowAny]

    def delete(self, request, *args, **kwargs):
        post = self.get_object()
        user_id = request.query_params.get('user_id')
        
        # Simple ownership check
        if not user_id or str(post.user_id) != str(user_id):
            return Response(
                {"error": "You are not authorized to delete this post."}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        return super().delete(request, *args, **kwargs)
class ReportPostView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        user_id = request.data.get('user_id')
        reason = request.data.get('reason')
        description = request.data.get('description', '')

        if not user_id:
            return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not reason:
            return Response({"error": "reason is required"}, status=status.HTTP_400_BAD_REQUEST)

        PostReport.objects.create(
            post=post,
            reporter_user_id=str(user_id),
            reason=reason,
            description=description
        )
        
        # Check if reports for this post with reason "Misinformation" reached 10
        misinfo_reports_count = PostReport.objects.filter(post=post, reason="Misinformation").count()
        if misinfo_reports_count >= 10:
            post.is_rumor = True
            post.rumor_reason = "Flags: Community identified this post as potential misinformation."
            post.save()
            
            # Save to ConfirmedRumor to prevent future occurrences
            ConfirmedRumor.objects.get_or_create(caption_text=post.caption)
        
        return Response({'message': 'Report submitted successfully'}, status=status.HTTP_201_CREATED)
