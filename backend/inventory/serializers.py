from rest_framework import serializers
from django.contrib.auth.models import User
from .models import AppConfiguration, Component, PurchaseOrder, PurchaseOrderItem, Tag

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = '__all__'

class ComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Component
        fields = '__all__'

    def validate_barcode_data(self, value):
        if not value:
            return None
        return value


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff', 'is_superuser', 'is_active']


class UserAccessSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'is_staff',
            'is_active',
            'last_login',
            'date_joined',
            'password',
        ]
        read_only_fields = ['last_login', 'date_joined']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class MouserApiKeySerializer(serializers.ModelSerializer):
    api_key = serializers.CharField(source='mouser_api_key', write_only=True, required=False, allow_blank=True)
    configured = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AppConfiguration
        fields = ['api_key', 'configured', 'updated_at']
        read_only_fields = ['configured', 'updated_at']

    def get_configured(self, obj):
        return bool(obj.mouser_api_key)

class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(), source='tags', many=True, write_only=True, required=False
    )

    class Meta:
        model = PurchaseOrderItem
        fields = ['id', 'part_number', 'quantity', 'tags', 'tag_ids']

    def create(self, validated_data):
        tags_data = validated_data.pop('tags', [])
        item = PurchaseOrderItem.objects.create(**validated_data)
        item.tags.set(tags_data)
        return item

    def update(self, instance, validated_data):
        if 'tags' in validated_data:
            tags_data = validated_data.pop('tags')
            instance.tags.set(tags_data)

        instance.part_number = validated_data.get('part_number', instance.part_number)
        instance.quantity = validated_data.get('quantity', instance.quantity)
        instance.save()
        return instance

class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(), source='tags', many=True, write_only=True, required=False
    )

    class Meta:
        model = PurchaseOrder
        fields = ['id', 'name', 'created_at', 'is_completed', 'items', 'tags', 'tag_ids']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        tags_data = validated_data.pop('tags', [])
        order = PurchaseOrder.objects.create(**validated_data)
        order.tags.set(tags_data)
        
        for item_data in items_data:
            item_tags = item_data.pop('tags', [])
            item = PurchaseOrderItem.objects.create(order=order, **item_data)
            item.tags.set(item_tags)
        return order


    def update(self, instance, validated_data):
        if 'items' in validated_data:
            items_data = validated_data.pop('items')
            instance.items.all().delete()
            for item_data in items_data:
                item_tags = item_data.pop('tags', [])
                item = PurchaseOrderItem.objects.create(order=instance, **item_data)
                item.tags.set(item_tags)
        
        if 'tags' in validated_data:
            tags_data = validated_data.pop('tags')
            instance.tags.set(tags_data)
            
        instance.name = validated_data.get('name', instance.name)
        instance.is_completed = validated_data.get('is_completed', instance.is_completed)
        instance.save()
        return instance
