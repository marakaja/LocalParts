from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ComponentViewSet, PurchaseOrderViewSet, TagViewSet, UserAccountViewSet, mouser_search, me, mouser_api_key_settings, create_order_from_mouser, search_mouser_orders, mouser_order_history, process_mouser_order

router = DefaultRouter()
router.register(r'components', ComponentViewSet)
router.register(r'orders', PurchaseOrderViewSet)
router.register(r'tags', TagViewSet)
router.register(r'users', UserAccountViewSet)

urlpatterns = [
    path('mouser-search/', mouser_search, name='mouser-search'),
    path('mouser-orders/create/', create_order_from_mouser, name='create-order-from-mouser'),
    path('mouser-orders/search/', search_mouser_orders, name='search-mouser-orders'),
    path('mouser-orders/history/', mouser_order_history, name='mouser-order-history'),
    path('mouser-orders/<int:order_id>/process/', process_mouser_order, name='process-mouser-order'),
    path('mouser-api-key/', mouser_api_key_settings, name='mouser-api-key-settings'),
    path('me/', me, name='me'),
    path('', include(router.urls)),
]