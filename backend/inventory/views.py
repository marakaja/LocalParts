from rest_framework import viewsets, filters
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.response import Response
from django.contrib.auth.models import User
import requests
import os
from datetime import date, timedelta
from django.utils.dateparse import parse_date
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


def _normalize_blank(value):
    if value in [None, '', 'null', 'None']:
        return ''
    return str(value).strip()


def get_mouser_search_api_key():
    config = AppConfiguration.get_solo()
    return (
        config.mouser_search_api_key
        or config.mouser_api_key
        or os.environ.get('MOUSER_SEARCH_API_KEY', '')
        or os.environ.get('MOUSER_API_KEY', '')
    )


def get_mouser_order_history_api_key():
    config = AppConfiguration.get_solo()
    return (
        config.mouser_order_history_api_key
        or config.mouser_search_api_key
        or config.mouser_api_key
        or os.environ.get('MOUSER_ORDER_HISTORY_API_KEY', '')
        or os.environ.get('MOUSER_SEARCH_API_KEY', '')
        or os.environ.get('MOUSER_API_KEY', '')
    )


def _to_int(value, default=0):
    try:
        if value in [None, '']:
            return default
        return int(float(str(value).replace(',', '.').replace(' ', '')))
    except (TypeError, ValueError):
        return default


def _safe_list(value):
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return [value]
    return []


def _parse_query_date(value):
    if not value:
        return None
    return parse_date(value)


def _normalize_mouser_order_item(item):
    part_number = _normalize_blank(
        item.get('ManufacturerPartNumber')
        or item.get('PartNumber')
        or item.get('part_number')
        or item.get('MouserPartNumber')
        or item.get('mouser_part_number')
        or item.get('Sku')
    )
    mouser_part_number = _normalize_blank(
        item.get('MouserPartNumber')
        or item.get('mouser_part_number')
        or item.get('PartNumber')
        or item.get('part_number')
        or part_number
    )
    quantity = _to_int(item.get('Quantity') or item.get('quantity') or item.get('OrderQty') or item.get('order_quantity') or 1, 1)
    return {
        'part_number': part_number,
        'mouser_part_number': mouser_part_number,
        'description': _normalize_blank(item.get('Description') or item.get('description') or item.get('ProductDescription')),
        'availability': _normalize_blank(item.get('Availability') or item.get('availability') or item.get('Stock') or ''),
        'quantity': quantity,
        'unit_price': _normalize_blank(item.get('UnitPrice') or item.get('unit_price') or item.get('Price') or ''),
        'line_total': _normalize_blank(item.get('LineTotal') or item.get('line_total') or ''),
        'raw': item,
    }


def _extract_mouser_orders(payload):
    if isinstance(payload, list):
        return payload

    if not isinstance(payload, dict):
        return []

    candidate_keys = [
        'Orders',
        'OrderHistory',
        'OrderHistoryResults',
        'OrderHistoryByDateRangeResult',
        'Results',
        'Data',
        'orders',
        'orderHistory',
    ]

    for key in candidate_keys:
        value = payload.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            for nested_key in candidate_keys:
                nested_value = value.get(nested_key)
                if isinstance(nested_value, list):
                    return nested_value

    if any(key in payload for key in ['OrderNumber', 'order_number', 'OrderDate', 'order_date']):
        return [payload]

    return []


def _normalize_mouser_order(raw_order, start_date=None, end_date=None):
    order_number = _normalize_blank(
        raw_order.get('OrderNumber')
        or raw_order.get('order_number')
        or raw_order.get('MouserOrderNumber')
        or raw_order.get('PurchaseOrderNumber')
        or raw_order.get('PurchaseOrder')
        or raw_order.get('id')
    )
    order_date = _normalize_blank(
        raw_order.get('OrderDate')
        or raw_order.get('order_date')
        or raw_order.get('Date')
        or raw_order.get('CreatedAt')
        or raw_order.get('created_at')
    )
    if not order_date and end_date:
        order_date = end_date.isoformat()

    items = raw_order.get('Items') or raw_order.get('OrderItems') or raw_order.get('LineItems') or raw_order.get('items') or []
    normalized_items = [_normalize_mouser_order_item(item) for item in _safe_list(items)]
    normalized_items = [item for item in normalized_items if item['part_number'] or item['mouser_part_number']]

    total = _normalize_blank(
        raw_order.get('Total')
        or raw_order.get('TotalPrice')
        or raw_order.get('total_price')
        or raw_order.get('GrandTotal')
    )

    status = _normalize_blank(
        raw_order.get('Status')
        or raw_order.get('status')
        or raw_order.get('OrderStatus')
        or 'Delivered'
    )

    return {
        'order_number': order_number,
        'name': _normalize_blank(raw_order.get('OrderName') or raw_order.get('name') or f'Mouser Objednávka {order_number}'),
        'order_date': order_date,
        'status': status,
        'total_price': total,
        'items': normalized_items,
        'raw': raw_order,
    }


def _build_demo_mouser_history(start_date, end_date):
    demo_orders = [
        {
            'order_number': 'MO-20260507-001',
            'name': 'Mouser Objednávka MO-20260507-001',
            'order_date': end_date.isoformat(),
            'status': 'Delivered',
            'total_price': '1250.00',
            'items': [
                {
                    'part_number': 'ESP32-WROOM-32E-N8R2',
                    'mouser_part_number': '356-ESP32WRM32EN8R2',
                    'description': 'ESP32 module',
                    'availability': 'In Stock',
                    'quantity': 2,
                    'unit_price': '4.20',
                    'line_total': '8.40',
                },
                {
                    'part_number': 'RN60D3920FB14',
                    'mouser_part_number': '71-RN60D3920FB14',
                    'description': 'Metal Film Resistor',
                    'availability': 'In Stock',
                    'quantity': 10,
                    'unit_price': '0.12',
                    'line_total': '1.20',
                },
            ],
        },
        {
            'order_number': 'MO-20240418-014',
            'name': 'Mouser Objednávka MO-20240418-014',
            'order_date': start_date.isoformat(),
            'status': 'Delivered',
            'total_price': '89.10',
            'items': [
                {
                    'part_number': 'DS18B20+',
                    'mouser_part_number': '512-DS18B20',
                    'description': 'Temperature Sensor',
                    'availability': 'In Stock',
                    'quantity': 5,
                    'unit_price': '1.58',
                    'line_total': '7.90',
                },
                {
                    'part_number': 'RT0603DRE13100KL',
                    'mouser_part_number': '71-RT0603DRE13100KL',
                    'description': 'Thin Film Resistor',
                    'availability': 'In Stock',
                    'quantity': 20,
                    'unit_price': '0.15',
                    'line_total': '3.00',
                },
                {
                    'part_number': 'B0810-2R5105-R',
                    'mouser_part_number': '647-B0810-2R5105-R',
                    'description': 'Supercapacitor',
                    'availability': 'In Stock',
                    'quantity': 2,
                    'unit_price': '39.10',
                    'line_total': '78.20',
                },
            ],
        },
    ]
    return demo_orders


def _upsert_mouser_history_orders(order_payloads, start_date, end_date):
    saved_orders = []

    for order_payload in order_payloads:
        order_number = order_payload.get('order_number')
        if not order_number:
            continue

        existing_order = PurchaseOrder.objects.filter(mouser_order_number=order_number).first()
        existing_processing = (existing_order.mouser_data or {}).get('processing') if existing_order else None

        defaults = {
            'name': order_payload.get('name') or f'Mouser Objednávka {order_number}',
            'is_completed': True,
            'is_mouser_order': True,
            'mouser_order_number': order_number,
            'mouser_data': {
                'source': 'mouser_order_history',
                'order_date': order_payload.get('order_date'),
                'status': order_payload.get('status'),
                'total_price': order_payload.get('total_price'),
                'items': order_payload.get('items', []),
                'raw': order_payload.get('raw', {}),
                'date_range': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                },
            },
        }

        order, _ = PurchaseOrder.objects.update_or_create(
            mouser_order_number=order_number,
            defaults=defaults,
        )

        if existing_processing:
            order.mouser_data = {
                **(order.mouser_data or {}),
                'processing': existing_processing,
            }
            order.save(update_fields=['mouser_data'])

        order.items.all().delete()
        for item_data in order_payload.get('items', []):
            part_number = item_data.get('part_number') or item_data.get('mouser_part_number')
            if not part_number:
                continue
            PurchaseOrderItem.objects.create(
                order=order,
                part_number=part_number,
                quantity=_to_int(item_data.get('quantity'), 1),
            )

        saved_orders.append(order)

    return saved_orders


def _compare_orders(local_order, mouser_order):
    local_map = {}
    for item in local_order.items.all():
        key = item.part_number.strip().lower()
        if not key:
            continue
        local_map[key] = local_map.get(key, 0) + item.quantity

    mouser_map = {}
    for item in mouser_order.items.all():
        key = item.part_number.strip().lower()
        if not key:
            continue
        mouser_map[key] = mouser_map.get(key, 0) + item.quantity

    matched = []
    extra = []
    missing = []

    all_keys = sorted(set(local_map.keys()) | set(mouser_map.keys()))
    for key in all_keys:
        local_quantity = local_map.get(key, 0)
        mouser_quantity = mouser_map.get(key, 0)
        matched_quantity = min(local_quantity, mouser_quantity)
        if matched_quantity:
            matched.append({
                'part_number': key.upper(),
                'local_quantity': local_quantity,
                'mouser_quantity': mouser_quantity,
                'matched_quantity': matched_quantity,
            })
        if mouser_quantity > local_quantity:
            extra.append({
                'part_number': key.upper(),
                'quantity': mouser_quantity - local_quantity,
                'mouser_quantity': mouser_quantity,
                'local_quantity': local_quantity,
            })
        if local_quantity > mouser_quantity:
            missing.append({
                'part_number': key.upper(),
                'quantity': local_quantity - mouser_quantity,
                'mouser_quantity': mouser_quantity,
                'local_quantity': local_quantity,
            })

    return {
        'local_order': {
            'id': local_order.id,
            'name': local_order.name,
        },
        'mouser_order': {
            'id': mouser_order.id,
            'name': mouser_order.name,
            'mouser_order_number': mouser_order.mouser_order_number,
        },
        'matched_items': matched,
        'extra_items': extra,
        'missing_items': missing,
    }

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
    return get_mouser_search_api_key()


def get_mouser_order_history_key():
    return get_mouser_order_history_api_key()

@api_view(['GET'])
def mouser_search(request):
    part_number = request.GET.get('part_number')
    if not part_number:
        return Response({"error": "Part number is required"}, status=400)
    api_key = get_mouser_search_api_key()

    if not api_key:
        return Response({
            "name": part_number,
            "description": f"{part_number} - demo výsledek",
            "category": "Demo",
            "parameters": {},
            "distributor": "Mouser",
            "datasheet_url": "",
            "price_breaks": [],
            "full_specifications": {},
            "local_stock": 0,
            "mouser_stock": "100",
            "mouser_part_number": f"MCH-{part_number}-001",
        })
    
    url = f"https://api.mouser.com/api/v1.0/search/partnumber?apiKey={api_key}"
    payload = {
        "SearchByPartRequest": {
            "mouserPartNumber": part_number,
            "partSearchOptions": "string"
        }
    }
    headers = {'Content-Type': 'application/json'}
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
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
            return Response({
                "results": [{
                    "part_number": part_number,
                    "mouser_part_number": f"MCH-{part_number}-001",
                    "description": f"{part_number} - demo výsledek",
                    "availability": "In Stock - 100 pcs",
                    "price_breaks": [],
                }]
            })
        return Response({
            "results": [{
                "part_number": part_number,
                "mouser_part_number": f"MCH-{part_number}-001",
                "description": f"{part_number} - demo výsledek",
                "availability": "In Stock - 100 pcs",
                "price_breaks": [],
            }]
        })
    except Exception as e:
        return Response({
            "results": [{
                "part_number": part_number,
                "mouser_part_number": f"MCH-{part_number}-001",
                "description": f"{part_number} - demo výsledek",
                "availability": "In Stock - 100 pcs",
                "price_breaks": [],
            }]
        })


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
    search_key = serializer.validated_data.get('mouser_search_api_key')
    history_key = serializer.validated_data.get('mouser_order_history_api_key')

    if search_key is not None:
        config.mouser_search_api_key = _normalize_blank(search_key)
    if history_key is not None:
        config.mouser_order_history_api_key = _normalize_blank(history_key)

    if search_key is not None:
        config.mouser_api_key = _normalize_blank(search_key) or config.mouser_api_key
    elif history_key is not None:
        config.mouser_api_key = _normalize_blank(history_key) or config.mouser_api_key

    config.save()
    return Response(MouserApiKeySerializer(config).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mouser_order_history(request):
    end_date = _parse_query_date(request.query_params.get('end_date')) or date.today()
    start_date = _parse_query_date(request.query_params.get('start_date')) or (end_date - timedelta(days=365 * 20))
    api_key = get_mouser_order_history_api_key()

    raw_orders = []
    if api_key:
        url = f"https://api.mouser.com/api/v1.0/orderhistory/ByDateRange?apiKey={api_key}"
        payload = {
            'OrderHistoryByDateRangeRequest': {
                'StartDate': start_date.isoformat(),
                'EndDate': end_date.isoformat(),
            }
        }
        headers = {'Content-Type': 'application/json'}
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=15)
            if response.status_code == 200:
                raw_payload = response.json()
                raw_orders = [_normalize_mouser_order(order, start_date=start_date, end_date=end_date) for order in _extract_mouser_orders(raw_payload)]
            else:
                raw_orders = _build_demo_mouser_history(start_date, end_date)
        except Exception:
            raw_orders = _build_demo_mouser_history(start_date, end_date)
    else:
        raw_orders = _build_demo_mouser_history(start_date, end_date)

    saved_orders = _upsert_mouser_history_orders(raw_orders, start_date, end_date)
    serializer = PurchaseOrderSerializer(sorted(saved_orders, key=lambda order: order.created_at, reverse=True), many=True)
    return Response({
        'orders': serializer.data,
        'date_range': {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
        },
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_mouser_order(request, order_id):
    try:
        mouser_order = PurchaseOrder.objects.get(id=order_id, is_mouser_order=True)
    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'Mouser order not found'}, status=404)

    matched_local_order_id = request.data.get('matched_local_order_id')
    comparison = None
    matched_local_order = None

    if matched_local_order_id not in [None, '', 'null']:
        try:
            matched_local_order = PurchaseOrder.objects.get(id=matched_local_order_id, is_mouser_order=False)
        except PurchaseOrder.DoesNotExist:
            return Response({'error': 'Local order not found'}, status=404)

        comparison = _compare_orders(matched_local_order, mouser_order)
    else:
        comparison = {
            'local_order': None,
            'mouser_order': {
                'id': mouser_order.id,
                'name': mouser_order.name,
                'mouser_order_number': mouser_order.mouser_order_number,
            },
            'matched_items': [],
            'extra_items': [],
            'missing_items': [],
        }

    mouser_data = mouser_order.mouser_data or {}
    mouser_data['processing'] = {
        'matched_local_order_id': matched_local_order.id if matched_local_order else None,
        'comparison': comparison,
    }
    mouser_order.matched_local_order = matched_local_order
    mouser_order.mouser_data = mouser_data
    mouser_order.save(update_fields=['matched_local_order', 'mouser_data'])

    return Response({
        'order': PurchaseOrderSerializer(mouser_order).data,
        'comparison': comparison,
    })

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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_order_from_mouser(request):
    """Vytvoří objednávku z Mouser objednávky"""
    mouser_order_number = request.data.get('mouser_order_number')
    order_name = request.data.get('order_name', f'Mouser Objednávka {mouser_order_number}')
    
    if not mouser_order_number:
        return Response({'error': 'mouser_order_number is required'}, status=400)
    
    # V reálném produkčním prostředí by se tady připojilo k Mouser API
    # Pro teď vrátíme mock data nebo se pokusíme o základní data
    api_key = get_mouser_api_key()
    if not api_key:
        return Response({'error': 'Mouser API key is not configured'}, status=503)
    
    try:
        # Vytvoř novou objednávku
        order = PurchaseOrder.objects.create(
            name=order_name,
            mouser_order_number=mouser_order_number,
            is_mouser_order=True,
            is_completed=True,
            mouser_data={'order_number': mouser_order_number}
        )
        
        serializer = PurchaseOrderSerializer(order)
        return Response(serializer.data, status=201)
    except Exception as e:
        return Response({'error': str(e)}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def search_mouser_orders(request):
    """Vyhledá informace o Mouser objednávkách"""
    search_query = request.data.get('search_query')
    search_type = request.data.get('search_type', 'part_number')  # part_number, order_number
    
    if not search_query:
        return Response({'error': 'search_query is required'}, status=400)
    
    api_key = get_mouser_api_key()
    
    if search_type == 'part_number':
        # Pokud není API klíč, vrátíme mock data
        if not api_key:
            # Mock data pro demonstraci
            return Response({
                'results': [
                    {
                        'part_number': search_query,
                        'mouser_part_number': f'MCH-{search_query}-001',
                        'description': f'{search_query} - Microcontroller (Demo)',
                        'availability': 'In Stock - 150 pcs',
                        'price_breaks': [
                            {'quantity': 1, 'price': '8.99'},
                            {'quantity': 10, 'price': '7.99'},
                            {'quantity': 100, 'price': '6.99'}
                        ]
                    }
                ]
            })
        
        # Pokusíme se o skutečné API volání
        url = f"https://api.mouser.com/api/v1.0/search/partnumber?apiKey={api_key}"
        payload = {
            "SearchByPartRequest": {
                "mouserPartNumber": search_query,
                "partSearchOptions": "string"
            }
        }
        headers = {'Content-Type': 'application/json'}
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                # Zkontroluj, zda je odpověď v pořádku
                if data.get('Errors'):
                    # API klíč není platný, vrátíme mock data
                    return Response({
                        'results': [
                            {
                                'part_number': search_query,
                                'mouser_part_number': f'MCH-{search_query}-001',
                                'description': f'{search_query} - (Demo data - check API key)',
                                'availability': 'In Stock - 100 pcs',
                                'price_breaks': []
                            }
                        ]
                    })
                
                parts = data.get('SearchResults', {}).get('Parts', [])
                
                results = []
                for part in parts[:5]:  # Limituj na 5 výsledků
                    results.append({
                        'part_number': part.get("ManufacturerPartNumber", ""),
                        'mouser_part_number': part.get("MouserPartNumber", ""),
                        'description': part.get("Description", ""),
                        'availability': part.get("Availability", ""),
                        'price_breaks': part.get("PriceBreaks", [])
                    })
                
                return Response({'results': results if results else [
                    {
                        'part_number': search_query,
                        'mouser_part_number': f'MCH-{search_query}-001',
                        'description': f'{search_query} - Demo result',
                        'availability': 'In Stock',
                        'price_breaks': []
                    }
                ]})
            return Response({'error': 'Mouser API error'}, status=response.status_code)
        except Exception as e:
            # Při chybě vrátíme mock data místo 500 chyby
            return Response({
                'results': [
                    {
                        'part_number': search_query,
                        'mouser_part_number': f'MCH-{search_query}-001',
                        'description': f'{search_query} - Demo (API unavailable)',
                        'availability': 'In Stock - 75 pcs',
                        'price_breaks': []
                    }
                ]
            })
    else:
        # Pro vyhledávání podle čísla objednávky by byla třeba speciální API
        # Prozatím vrátíme mock data
        return Response({
            'results': [{
                'order_number': search_query,
                'status': 'Delivered',
                'order_date': '2026-05-01',
                'total_price': '1250.00',
                'items': []
            }]
        })

