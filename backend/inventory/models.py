from django.db import models

class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    color = models.CharField(max_length=20, default="#e0e0e0")

    def __str__(self):
        return self.name

class Component(models.Model):
    part_number = models.CharField(max_length=150, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=150, blank=True, null=True) # Mouser style categories
    parameters = models.JSONField(default=dict, blank=True) # Store varied attributes
    quantity = models.PositiveIntegerField(default=0)
    location = models.CharField(max_length=255, blank=True, null=True)
    distributor = models.CharField(max_length=255, blank=True, null=True)
    barcode_data = models.CharField(max_length=255, unique=True, blank=True, null=True)
    datasheet_url = models.URLField(max_length=500, blank=True, null=True)
    eda_model_url = models.URLField(max_length=500, blank=True, null=True) # EDA/CAD Link
    created_at = models.DateTimeField(auto_now_add=True)
    is_completed = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.part_number} - {self.name}"

class PurchaseOrder(models.Model):
    name = models.CharField(max_length=255)
    tags = models.ManyToManyField(Tag, blank=True, related_name="orders")
    created_at = models.DateTimeField(auto_now_add=True)
    is_completed = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class PurchaseOrderItem(models.Model):
    order = models.ForeignKey(PurchaseOrder, related_name='items', on_delete=models.CASCADE)
    part_number = models.CharField(max_length=150)
    quantity = models.PositiveIntegerField()
    tags = models.ManyToManyField(Tag, blank=True, related_name='order_items')

    def __str__(self):
        return f"{self.part_number} (x{self.quantity})"


class AppConfiguration(models.Model):
    mouser_api_key = models.CharField(max_length=255, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'Application Configuration'
