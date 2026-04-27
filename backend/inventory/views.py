from rest_framework import viewsets, filters
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.response import Response
from django.contrib.auth.models import User
import requests
import os
from .models import AppConfiguration, Component, PurchaseOrder, PurchaseOrderItem, Tag
from .serializers import (
    ComponentSerializer,
    MouserApiKeySerializer,
    PurchaseOrderSerializer,
    TagSerializer,
    UserProfileSerializer,
    UserAccessSerializer,
)


def normalize_attribute_name(attribute_name):
    normalized = attribute_name.strip().lower()
    alias_map = {
        'resistance (ohms)': 'Resistance',
        'resistance': 'Resistance',
        'resistor resistance': 'Resistance',
        'resistor value': 'Resistance',
        'resistance value': 'Resistance',
        'resistor value': 'Resistance',
        'ohms': 'Resistance',
        'tolerance': 'Tolerance',
        'power rating': 'Power Rating',
        'wattage': 'Power Rating',
        'package / case': 'Package / Case',
        'package case': 'Package / Case',
        'package': 'Package / Case',
        'case code': 'Package / Case',
        'case': 'Package / Case',
        'mounting style': 'Mounting Style',
        'mounting': 'Mounting Style',
        'temperature coefficient': 'Temperature Coefficient',
        'temp coefficient': 'Temperature Coefficient',
    }
    return alias_map.get(normalized, attribute_name)


def add_specification_aliases(specifications, source_map):
    alias_groups = {
        'Resistance': ['Odpor'],
        'Tolerance': ['Tolerance', 'Tolerance (%)'],
        'Power Rating': ['Výkon'],
        'Package / Case': ['Pouzdro'],
        'Mounting Style': ['Montáž'],
        'Temperature Coefficient': ['Teplotní koeficient'],
    }

    for canonical_name, aliases in alias_groups.items():
        value = source_map.get(canonical_name)
        if value in [None, ""]:
            continue
        specifications[canonical_name] = value
        for alias in aliases:
            specifications[alias] = value

    return specifications

class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']


class UserAccountViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('username')
    serializer_class = UserAccessSerializer
    permission_classes = [IsAdminUser]

def get_mouser_api_key():
    db_key = AppConfiguration.get_solo().mouser_api_key
    if db_key:
        return db_key
    return os.environ.get('MOUSER_API_KEY', '')

@api_view(['GET'])
def mouser_search(request):
    part_number = request.GET.get('part_number')
    if not part_number:
        return Response({"error": "Part number is required"}, status=400)
    api_key = get_mouser_api_key()
    if not api_key:
        return Response({"error": "Mouser API key is not configured"}, status=503)
    
    url = f"https://api.mouser.com/api/v1.0/search/partnumber?apiKey={api_key}"
    payload = {
        "SearchByPartRequest": {
            "mouserPartNumber": part_number,
            "partSearchOptions": "string"
        }
    }
    headers = {'Content-Type': 'application/json'}
    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            data = response.json()
            parts = data.get('SearchResults', {}).get('Parts', [])
            if parts:
                part = parts[0]
                mfr_part = part.get("ManufacturerPartNumber", "")
                
                # Zjištění, zda už daný díl máme v inventáři 
                local_stock = 0
                mouser_part = part.get("MouserPartNumber", "")
                from django.db.models import Q
                local_comp = Component.objects.filter(Q(part_number__iexact=mfr_part) | Q(part_number__iexact=mouser_part) | Q(name__iexact=mfr_part)).first()
                if local_comp:
                    local_stock = local_comp.quantity
                
                # Výběr cen podle odebraného množství
                price_breaks = part.get("PriceBreaks", [])                
                
                # Ziskani parametru v JSON a kategorie
                attributes = part.get("ProductAttributes", [])
                parameters = {}
                for attr in attributes:
                    attribute_name = attr.get("AttributeName")
                    attribute_value = attr.get("AttributeValue")
                    if not attribute_name or attribute_value in [None, ""]:
                        continue
                    normalized_name = normalize_attribute_name(attribute_name)
                    parameters[normalized_name] = attribute_value
                basic_parameters = {
                    "ManufacturerPartNumber": part.get("ManufacturerPartNumber", ""),
                    "MouserPartNumber": part.get("MouserPartNumber", ""),
                    "Manufacturer": part.get("Manufacturer", ""),
                    "Description": part.get("Description", ""),
                    "Category": part.get("Category", ""),
                    "Availability": part.get("Availability", ""),
                    "LifecycleStatus": part.get("LifecycleStatus", ""),
                    "DataSheetUrl": part.get("DataSheetUrl", ""),
                    "ImagePath": part.get("ImagePath", ""),
                }
                full_specifications = {
                    key: value
                    for key, value in part.items()
                    if key != "PriceBreaks" and value not in [None, "", [], {}]
                }
                full_specifications["BasicParameters"] = {
                    key: value for key, value in basic_parameters.items() if value not in [None, ""]
                }
                full_specifications["ProductAttributesMap"] = parameters
                add_specification_aliases(full_specifications, parameters)
                category = part.get("Category", "")

                result = {
                    "name": mfr_part,
                    "description": part.get("Description", ""),
                    "category": category,
                    "parameters": parameters,
                    "distributor": "Mouser",
                    "datasheet_url": part.get("DataSheetUrl", ""),
                    "price_breaks": price_breaks,
                    "full_specifications": full_specifications,
                    "local_stock": local_stock,
                    "mouser_stock": part.get("Availability", "0").replace(" In Stock", ""),
                    "mouser_part_number": part.get("MouserPartNumber", "")
                }
                return Response(result)
            return Response({"error": "No parts found"}, status=404)
        return Response({"error": "Mouser API error"}, status=response.status_code)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def me(request):
    if not request.user or not request.user.is_authenticated:
        return Response({"detail": "Authentication required"}, status=401)
    serializer = UserProfileSerializer(request.user)
    return Response(serializer.data)


@api_view(['GET', 'PUT'])
@permission_classes([IsAdminUser])
def mouser_api_key_settings(request):
    config = AppConfiguration.get_solo()

    if request.method == 'GET':
        serializer = MouserApiKeySerializer(config)
        return Response(serializer.data)

    serializer = MouserApiKeySerializer(config, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    api_key = serializer.validated_data.get('mouser_api_key')
    if api_key is not None:
        config.mouser_api_key = api_key.strip()
        config.save(update_fields=['mouser_api_key', 'updated_at'])
    return Response(MouserApiKeySerializer(config).data)

class ComponentViewSet(viewsets.ModelViewSet):
    queryset = Component.objects.all()
    serializer_class = ComponentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['distributor', 'location']
    search_fields = ['name', 'description', 'part_number', 'barcode_data']
    ordering_fields = ['name', 'quantity', 'created_at']

    def get_queryset(self):
        queryset = super().get_queryset()
        barcode = self.request.query_params.get('barcode')
        if barcode:
            return queryset.filter(barcode_data__iexact=barcode)
        return queryset


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all().order_by('-created_at')
    serializer_class = PurchaseOrderSerializer

    @action(detail=True, methods=['post'])
    def copy_items(self, request, pk=None):
        source_order = self.get_object()
        item_ids = request.data.get('item_ids') or []
        target_order_id = request.data.get('target_order_id')
        move_item = str(request.data.get('move_item', 'false')).lower() in ['1', 'true', 'yes', 'on']

        if not isinstance(item_ids, list) or not item_ids or not target_order_id:
            return Response({'error': 'item_ids(list) and target_order_id are required'}, status=400)

        try:
            target_order = PurchaseOrder.objects.get(id=target_order_id)
        except PurchaseOrder.DoesNotExist:
            return Response({'error': 'Target order not found'}, status=404)

        if target_order.id == source_order.id:
            return Response({'error': 'Target order must be different from source order'}, status=400)

        if target_order.is_completed:
            return Response({'error': 'Cannot copy/move items into a completed order'}, status=400)

        if move_item and source_order.is_completed:
            return Response({'error': 'Cannot move items from a completed order'}, status=400)

        source_items = source_order.items.filter(id__in=item_ids)
        if source_items.count() != len(set(item_ids)):
            return Response({'error': 'One or more items were not found in source order'}, status=404)

        for source_item in source_items:
            copied = PurchaseOrderItem.objects.create(
                order=target_order,
                part_number=source_item.part_number,
                quantity=source_item.quantity,
            )
            copied.tags.set(source_item.tags.all())
            target_order.tags.add(*source_item.tags.all())

        moved_count = 0

        if move_item:
            moved_count = source_items.count()
            source_items.delete()

        return Response({
            'status': 'ok',
            'copied_count': len(item_ids),
            'moved_count': moved_count,
        })

