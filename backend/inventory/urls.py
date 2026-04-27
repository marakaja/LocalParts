from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ComponentViewSet, PurchaseOrderViewSet, TagViewSet, UserAccountViewSet, mouser_search, me, mouser_api_key_settings

router = DefaultRouter()
router.register(r'components', ComponentViewSet)
router.register(r'orders', PurchaseOrderViewSet)
router.register(r'tags', TagViewSet)
router.register(r'users', UserAccountViewSet)

urlpatterns = [
    path('mouser-search/', mouser_search, name='mouser-search'),
    path('mouser-api-key/', mouser_api_key_settings, name='mouser-api-key-settings'),
    path('me/', me, name='me'),
    path('', include(router.urls)),
]