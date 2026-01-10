from rest_framework import serializers
from .models import Warning, Restriction, ToxicityLog
from .models import Post, PostLike

class WarningSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Warning
        fields = ['id', 'user', 'username', 'message', 'reason', 'issued_by', 'is_automatic', 'created_at']
        read_only_fields = ['id', 'created_at']


class RestrictionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Restriction
        fields = ['id', 'user', 'username', 'restriction_type', 'reason', 'issued_by', 'is_permanent', 'expires_at', 'created_at']
        read_only_fields = ['id', 'created_at']


class ToxicityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ToxicityLog
        fields = ['id', 'message', 'toxicity_score', 'detected_categories', 'is_toxic', 'created_at']
        read_only_fields = ['id', 'created_at']

class PostSerializer(serializers.ModelSerializer):
    username = serializers.CharField() # Now writable or passed in
    user_id = serializers.CharField()
    likes_count = serializers.IntegerField(read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'user_id', 'username', 'image', 'caption', 'created_at', 'likes_count', 'views', 'is_liked', 'is_rumor', 'rumor_reason']
        read_only_fields = ['views', 'likes_count', 'is_rumor', 'rumor_reason']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        user_id = None
        if request and request.query_params.get('user_id'):
             user_id = request.query_params.get('user_id')
        
        # Also check if passed via context (preferred for views)
        if not user_id and self.context.get('user_id'):
            user_id = self.context.get('user_id')
            
        if user_id:
             return PostLike.objects.filter(post=obj, user_id=user_id).exists()
        return False