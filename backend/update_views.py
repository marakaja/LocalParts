import sys
with open('inventory/views.py', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace('from .models import Component', 'from .models import Component, PurchaseOrder')
code = code.replace('from .serializers import ComponentSerializer', 'from .serializers import ComponentSerializer, PurchaseOrderSerializer')

stock_inject = '''                    "price_breaks": price_breaks,
                    "local_stock": local_stock,
                    "mouser_stock": part.get("Availability", "0").replace(" In Stock", ""),'''
code = code.replace('                    "price_breaks": price_breaks,\n                    "local_stock": local_stock,', stock_inject)

viewset_code = '''
class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all().order_by('-created_at')
    serializer_class = PurchaseOrderSerializer
'''
code += viewset_code

with open('inventory/views.py', 'w', encoding='utf-8') as f:
    f.write(code)
