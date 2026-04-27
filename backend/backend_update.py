import sys

# 1. Update views.py (local stock bug fix)
with open('inventory/views.py', 'r', encoding='utf-8') as f:
    views_code = f.read()

old_stock_lookup = '''                local_comp = Component.objects.filter(part_number=mfr_part).first()
                if local_comp:
                    local_stock = local_comp.quantity'''

new_stock_lookup = '''                mouser_part = part.get("MouserPartNumber", "")
                from django.db.models import Q
                local_comp = Component.objects.filter(Q(part_number__iexact=mfr_part) | Q(part_number__iexact=mouser_part) | Q(name__iexact=mfr_part)).first()
                if local_comp:
                    local_stock = local_comp.quantity'''

views_code = views_code.replace(old_stock_lookup, new_stock_lookup)

with open('inventory/views.py', 'w', encoding='utf-8') as f:
    f.write(views_code)

# 2. Update models.py to add is_completed to PurchaseOrder
with open('inventory/models.py', 'r', encoding='utf-8') as f:
    models_code = f.read()

models_code = models_code.replace(
    '    created_at = models.DateTimeField(auto_now_add=True)',
    '    created_at = models.DateTimeField(auto_now_add=True)\n    is_completed = models.BooleanField(default=False)'
)

with open('inventory/models.py', 'w', encoding='utf-8') as f:
    f.write(models_code)

# 3. Update serializers.py
with open('inventory/serializers.py', 'r', encoding='utf-8') as f:
    serializers_code = f.read()

serializers_code = serializers_code.replace(
    "fields = ['id', 'name', 'created_at', 'items']",
    "fields = ['id', 'name', 'created_at', 'is_completed', 'items']"
)
# Update the 'create' method to handle 'update' logic because we need to edit orders
update_methods = '''
    def update(self, instance, validated_data):
        if 'items' in validated_data:
            items_data = validated_data.pop('items')
            instance.items.all().delete()
            for item_data in items_data:
                PurchaseOrderItem.objects.create(order=instance, **item_data)
        
        instance.name = validated_data.get('name', instance.name)
        instance.is_completed = validated_data.get('is_completed', instance.is_completed)
        instance.save()
        return instance
'''
if 'def update' not in serializers_code:
    serializers_code += update_methods

with open('inventory/serializers.py', 'w', encoding='utf-8') as f:
    f.write(serializers_code)

