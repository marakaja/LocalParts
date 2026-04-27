import sys
with open('inventory/urls.py', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace('from .views import ComponentViewSet, mouser_search', 'from .views import ComponentViewSet, PurchaseOrderViewSet, mouser_search')
code = code.replace("router.register(r'components', ComponentViewSet)", "router.register(r'components', ComponentViewSet)\nrouter.register(r'orders', PurchaseOrderViewSet)")

with open('inventory/urls.py', 'w', encoding='utf-8') as f:
    f.write(code)
