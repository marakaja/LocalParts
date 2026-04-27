import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Typography, TextField, Button, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Grid, Snackbar, Alert, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, CircularProgress, Autocomplete, Checkbox } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useParams, useNavigate } from 'react-router-dom';

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface PriceBreak {
  Quantity: number;
  Price: string;
  Currency: string;
}

interface OrderItem {
  id?: number;
  mouserPart: string;
  mfgPart: string;
  description: string;
  quantity: number;
  localStock: number;
  mouserStock: number;
  priceBreaks: PriceBreak[];
  currentPrice: number;
  tags: Tag[];
}

interface OrderSummary {
  id: number;
  name: string;
  created_at: string;
  is_completed: boolean;
}

const OrderBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [orderName, setOrderName] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [needsSave, setNeedsSave] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<'copy' | 'move'>('copy');
  const [openOrders, setOpenOrders] = useState<OrderSummary[]>([]);
  const [transferTargetOrder, setTransferTargetOrder] = useState<OrderSummary | null>(null);

  const [savedStatus, setSavedStatus] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const fetchTags = async () => {
    try {
      const res = await axios.get('/api/tags/');
      setAvailableTags(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTags();
    if (id && id !== 'new') {
      loadOrder(id);
    }
  }, [id]);

  // Upozornění před opuštěním stránky
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSaving || needsSave) {
        e.preventDefault();
        e.returnValue = 'Máte neuložené změny, opravdu chcete odejít?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isSaving, needsSave]);

  // Automatické průběžné uložení s debouncem 1.5 sekundy
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!orderLoading && !isCompleted && needsSave && orderName.trim().length > 0) {
        autoSaveOrder();
      }
    }, 1500);
    return () => clearTimeout(handler);
  }, [orderName, selectedTags, orderItems, needsSave, isCompleted, orderLoading]);

  const calculatePrice = (qty: number, breaks: PriceBreak[]) => {
    if (!breaks || breaks.length === 0) return 0;
    const sorted = [...breaks].sort((a, b) => b.Quantity - a.Quantity);
    let matchedPriceStr = sorted[sorted.length - 1].Price;
    for (let b of sorted) {
      if (qty >= b.Quantity) {
        matchedPriceStr = b.Price;
        break;
      }
    }
    const parsed = parseFloat(matchedPriceStr.toString().replace(/[^0-9,.]/g, '').replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateTotal = (qty: number, breaks: PriceBreak[]) => qty * calculatePrice(qty, breaks);

  const optimizeQuantity = (requestedQty: number, breaks: PriceBreak[], mouserStock: number) => {
    const safeQty = Math.max(1, requestedQty || 1);
    const maxQty = mouserStock > 0 ? mouserStock : Number.MAX_SAFE_INTEGER;
    const candidateQuantities = new Set<number>([safeQty]);

    breaks.forEach((priceBreak) => {
      if (priceBreak.Quantity >= safeQty && priceBreak.Quantity <= maxQty) {
        candidateQuantities.add(priceBreak.Quantity);
      }
    });

    let bestQty = safeQty;
    let bestUnitPrice = calculatePrice(safeQty, breaks);
    let bestTotal = bestQty * bestUnitPrice;

    candidateQuantities.forEach((candidateQty) => {
      const candidateUnitPrice = calculatePrice(candidateQty, breaks);
      const candidateTotal = candidateQty * candidateUnitPrice;
      if (
        candidateTotal < bestTotal - 1e-9 ||
        (Math.abs(candidateTotal - bestTotal) < 1e-9 && candidateQty < bestQty)
      ) {
        bestQty = candidateQty;
        bestUnitPrice = candidateUnitPrice;
        bestTotal = candidateTotal;
      }
    });

    return { quantity: bestQty, currentPrice: bestUnitPrice };
  };

  const parseBreakPrice = (price: string) => {
    const parsed = parseFloat(price.toString().replace(/[^0-9,.]/g, '').replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  };

  const getSortedBreaks = (breaks: PriceBreak[]) => [...breaks].sort((a, b) => a.Quantity - b.Quantity);

  const getActiveBreakQuantity = (qty: number, breaks: PriceBreak[]) => {
    const sorted = getSortedBreaks(breaks);
    let active = sorted.length > 0 ? sorted[0].Quantity : 0;
    sorted.forEach((priceBreak) => {
      if (qty >= priceBreak.Quantity) {
        active = priceBreak.Quantity;
      }
    });
    return active;
  };

  const getOptimizationHint = (item: OrderItem) => {
    const optimized = optimizeQuantity(item.quantity, item.priceBreaks, item.mouserStock);
    if (optimized.quantity === item.quantity) return null;

    const currentTotal = calculateTotal(item.quantity, item.priceBreaks);
    const optimizedTotal = calculateTotal(optimized.quantity, item.priceBreaks);
    if (optimizedTotal >= currentTotal) return null;

    return `Výhodnější je ${optimized.quantity} ks (${optimized.currentPrice.toFixed(2)} / ks, celkem ${optimizedTotal.toFixed(2)}).`;
  };

  const getEffectivePricing = (item: OrderItem) => {
    const optimized = optimizeQuantity(item.quantity, item.priceBreaks, item.mouserStock);
    const currentTotal = calculateTotal(item.quantity, item.priceBreaks);
    const optimizedTotal = calculateTotal(optimized.quantity, item.priceBreaks);

    if (optimized.quantity !== item.quantity && optimizedTotal < currentTotal) {
      return {
        quantity: optimized.quantity,
        unitPrice: optimized.currentPrice,
        total: optimizedTotal,
      };
    }

    return {
      quantity: item.quantity,
      unitPrice: item.currentPrice,
      total: currentTotal,
    };
  };

  const buildOrderTagIds = async () => {
    const orderTagIds = await prepareTags();
    const itemTagIds = orderItems.flatMap((item) => item.tags.map((tag) => tag.id));
    return Array.from(new Set([...orderTagIds, ...itemTagIds]));
  };

  const loadOrder = async (orderId: string) => {
    setOrderLoading(true);
    try {
      const res = await axios.get(`/api/orders/${orderId}/`);
      const payload = res.data;
      setOrderName(payload.name);
      setIsCompleted(payload.is_completed);
      if (payload.tags) {
        setSelectedTags(payload.tags);
      }

      // Fetch details for each item to reconstruct the state
      const itemsWithDetails: OrderItem[] = await Promise.all(
        payload.items.map(async (item: any) => {
          try {
            const mouserRes = await axios.get(`/api/mouser-search/?part_number=${item.part_number}`);
            const mData = mouserRes.data;
            const mStock = parseInt((mData.mouser_stock || '0').replace(/[^0-9]/g, '')) || 0;
            return {
              id: item.id,
              mouserPart: mData.mouser_part_number || item.part_number,
              mfgPart: mData.name,
              description: mData.description,
              quantity: item.quantity,
              localStock: mData.local_stock || 0,
              mouserStock: mStock,
              priceBreaks: mData.price_breaks || [],
              currentPrice: calculatePrice(item.quantity, mData.price_breaks || []),
              tags: item.tags || []
            };
          } catch (e) {
            // Fallback if mousers API fails for an item
            return {
              id: item.id,
              mouserPart: item.part_number,
              mfgPart: item.part_number,
              description: 'Nenalezeno/Chyba',
              quantity: item.quantity,
              localStock: 0,
              mouserStock: 0,
              priceBreaks: [],
              currentPrice: 0,
              tags: item.tags || []
            };
          }
        })
      );
      setOrderItems(itemsWithDetails);
    } catch (err) {
      alert('Chyba při načítání objednávky.');
    } finally {
      setOrderLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!searchInput) return;
    setLoading(true);
    let partNumber = searchInput;
    if (partNumber.includes('mouser')) {
      const parts = partNumber.split('/');
      partNumber = parts[parts.length - 1] || searchInput;
    }
    
    try {
      const res = await axios.get(`/api/mouser-search/?part_number=${partNumber}`);
      const data = res.data;
      const newQty = 1;
      const mStock = parseInt((data.mouser_stock || '0').replace(/[^0-9]/g, '')) || 0;
      const topTagIds = await prepareTags();
      const tagsRes = await axios.get('/api/tags/');
      setAvailableTags(tagsRes.data);
      const selectedTopTags = tagsRes.data.filter((tag: Tag) => topTagIds.includes(tag.id));

      const newItem: OrderItem = {
        mouserPart: data.mouser_part_number || partNumber,
        mfgPart: data.name,
        description: data.description,
        quantity: newQty,
        localStock: data.local_stock || 0,
        mouserStock: mStock,
        priceBreaks: data.price_breaks || [],
        currentPrice: calculatePrice(newQty, data.price_breaks || []),
        tags: selectedTopTags
      };
      
      setSelectedItemIds([]);
      setOrderItems(prev => [...prev, newItem]);
      setSearchInput('');
      setNeedsSave(true);
    } catch (err) {
      alert("Komponenta nebyla na Mouseru nalezena nebo nastala chyba.");
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (isCompleted) return;
    const newItems = [...orderItems];
    const safeQty = Math.max(1, newQty || 1);
    newItems[index].quantity = safeQty;
    newItems[index].currentPrice = calculatePrice(safeQty, newItems[index].priceBreaks);
    setOrderItems(newItems);
    setNeedsSave(true);
  };

  const updateItemTags = (index: number, newTags: Tag[]) => {
    if (isCompleted) return;
    const newItems = [...orderItems];
    newItems[index].tags = newTags;
    setOrderItems(newItems);
    setNeedsSave(true);
  };

  const removeRow = (index: number) => {
    if (isCompleted) return;
    setOrderItems(orderItems.filter((_, i) => i !== index));
    setNeedsSave(true);
  };

  const prepareTags = async () => {
    // Some tags might be new string if freeSolo is used
    const processedTags = [];
    for (const tag of selectedTags) {
      if (typeof tag === 'string' || !tag.id) {
        const tagName = typeof tag === 'string' ? tag : (tag as any).inputValue || tag.name;
        // Check if exists
        const existing = availableTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
        if (existing) {
          processedTags.push(existing.id);
        } else {
          // Create tag
          try {
            const res = await axios.post('/api/tags/', { name: tagName, color: '#2196f3' });
            processedTags.push(res.data.id);
            setAvailableTags(prev => [...prev, res.data]);
          } catch (e) {
            console.error("Error creating tag", e);
          }
        }
      } else {
        processedTags.push(tag.id);
      }
    }
    return processedTags;
  };

  const toggleItemSelection = (itemId?: number) => {
    if (!itemId) return;
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((idValue) => idValue !== itemId) : [...prev, itemId]
    );
  };

  const toggleSelectAll = () => {
    const selectableIds = orderItems.filter((item) => item.id).map((item) => item.id as number);
    if (selectableIds.length > 0 && selectableIds.every((value) => selectedItemIds.includes(value))) {
      setSelectedItemIds([]);
      return;
    }
    setSelectedItemIds(selectableIds);
  };

  const openTransferDialog = async (mode: 'copy' | 'move', itemIds?: number[]) => {
    const effectiveItemIds = itemIds && itemIds.length > 0 ? itemIds : selectedItemIds;

    if (!id || id === 'new') {
      alert('Nejprve objednávku uložte, aby šlo položky kopírovat nebo přesouvat.');
      return;
    }

    if (effectiveItemIds.length === 0) {
      alert('Nejprve označte alespoň jednu položku.');
      return;
    }

    if (mode === 'move' && isCompleted) {
      alert('Z uzavřené objednávky nelze položky přesouvat.');
      return;
    }

    try {
      const ordersRes = await axios.get('/api/orders/');
      const availableTargets = (ordersRes.data as OrderSummary[]).filter(
        (order) => !order.is_completed && String(order.id) !== String(id)
      );
      setSelectedItemIds(effectiveItemIds);
      setOpenOrders(availableTargets);
      setTransferTargetOrder(availableTargets[0] || null);
      setTransferMode(mode);
      setTransferDialogOpen(true);
    } catch (error) {
      console.error(error);
      alert('Nepodařilo se načíst rozpracované objednávky.');
    }
  };

  const openSingleTransferDialog = async (itemId?: number, mode: 'copy' | 'move' = 'copy') => {
    if (!itemId) {
      alert('Položka ještě není uložená, nejprve objednávku uložte.');
      return;
    }
    await openTransferDialog(mode, [itemId]);
  };

  const confirmTransfer = async () => {
    if (!id || id === 'new') return;
    if (!transferTargetOrder) {
      alert('Vyberte cílovou rozpracovanou objednávku.');
      return;
    }

    try {
      await axios.post(`/api/orders/${id}/copy_items/`, {
        item_ids: selectedItemIds,
        target_order_id: transferTargetOrder.id,
        move_item: transferMode === 'move',
      });
      await loadOrder(id);
      setSelectedItemIds([]);
      setTransferDialogOpen(false);
      setSavedStatus({
        open: true,
        message: transferMode === 'move' ? 'Vybrané položky byly přesunuty.' : 'Vybrané položky byly zkopírovány.',
        severity: 'success',
      });
    } catch (error) {
      console.error(error);
      setSavedStatus({
        open: true,
        message: transferMode === 'move' ? 'Přesun vybraných položek selhal.' : 'Kopírování vybraných položek selhalo.',
        severity: 'error',
      });
    }
  };

  const autoSaveOrder = async () => {
    setIsSaving(true);
    try {
      const hasItemsWithoutId = orderItems.some((item) => !item.id);
      const tagIds = await buildOrderTagIds();
      const payload = {
        name: orderName,
        is_completed: isCompleted,
        tag_ids: tagIds,
        items: orderItems.map(i => ({
          part_number: i.mfgPart,
          quantity: i.quantity,
          tag_ids: i.tags.map((tag) => tag.id)
        }))
      };
      
      if (id && id !== 'new') {
        const updateRes = await axios.put(`/api/orders/${id}/`, payload);
        // Do not reload the whole order; just hydrate missing IDs from backend response.
        if (hasItemsWithoutId) {
          const savedItems = (updateRes.data?.items || []) as Array<{ id: number }>;
          if (savedItems.length === orderItems.length) {
            setOrderItems((prev) => prev.map((item, index) => ({ ...item, id: savedItems[index]?.id ?? item.id })));
          }
        }
      } else {
        const res = await axios.post('/api/orders/', payload);
        // Po zalozeni nove objednavky presmerovat ihned na jeji URL aniz by selhala stavova navigace
        navigate(`/order/${res.data.id}`, { replace: true });
      }
      
      setNeedsSave(false);
      setSavedStatus({ open: true, message: 'Automaticky uloženo', severity: 'success' });
    } catch (err) {
      console.error(err);
      setSavedStatus({ open: true, message: 'Chyba při ukládání objednávky.', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOrder = async (markCompleted: boolean = false) => {
    if (!orderName.trim()) {
      alert('Zadejte prosím název objednávky.');
      return;
    }
    // rucni ukonceni
    try {
      const hasItemsWithoutId = orderItems.some((item) => !item.id);
      const tagIds = await buildOrderTagIds();
      const payload = {
        name: orderName,
        is_completed: markCompleted ? true : isCompleted,
        tag_ids: tagIds,
        items: orderItems.map(i => ({
          part_number: i.mfgPart,
          quantity: i.quantity,
          tag_ids: i.tags.map((tag) => tag.id)
        }))
      };
      
      if (id && id !== 'new') {
        const updateRes = await axios.put(`/api/orders/${id}/`, payload);
        if (hasItemsWithoutId) {
          const savedItems = (updateRes.data?.items || []) as Array<{ id: number }>;
          if (savedItems.length === orderItems.length) {
            setOrderItems((prev) => prev.map((item, index) => ({ ...item, id: savedItems[index]?.id ?? item.id })));
          }
        }
      } else {
        const res = await axios.post('/api/orders/', payload);
        navigate(`/order/${res.data.id}`, { replace: true });
      }
      
      if (markCompleted) setIsCompleted(true);
      setNeedsSave(false);
      setSavedStatus({ open: true, message: 'Objednávka úspěšně uložena a uzamčena!', severity: 'success' });
    } catch (err) {
      console.error(err);
      setSavedStatus({ open: true, message: 'Chyba při ukládání objednávky.', severity: 'error' });
    }
  };

  const handleUnlock = () => {
    setUnlockDialogOpen(true);
  };

  const confirmUnlock = async () => {
    setIsCompleted(false);
    setUnlockDialogOpen(false);
    // Auto-save the unlocked status immediately
    try {
      const payload = {
        name: orderName,
        is_completed: false,
        items: orderItems.map(i => ({
          part_number: i.mfgPart,
          quantity: i.quantity,
          tag_ids: i.tags.map((tag) => tag.id)
        }))
      };
      await axios.put(`/api/orders/${id}/`, payload);
      setSavedStatus({ open: true, message: 'Objednávka byla odemčena.', severity: 'success' });
    } catch(err) {
      setSavedStatus({ open: true, message: 'Chyba při odemykání.', severity: 'error' });
    }
  };

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Mouser Part Number,Manufacturer Part,Description,Quantity,Price per Unit,Total Price\n";
    
    orderItems.forEach(item => {
      const effective = getEffectivePricing(item);
      const row = [
        item.mouserPart,
        item.mfgPart,
        `"${item.description.replace(/"/g, '""')}"`,
        effective.quantity,
        effective.unitPrice.toFixed(2),
        effective.total.toFixed(2)
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = orderName.trim() ? `Mouser_${orderName.replace(/\s+/g, '_')}.csv` : "mouser_order.csv";
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (orderLoading) {
    return (
      <Container sx={{ mt: 10, mb: 4, textAlign: 'center' }}>
        <CircularProgress size={60} sx={{ mb: 3 }} />
        <Typography variant="h6" color="text.secondary">Načítám parametry objednávky a zjišťuji aktuální ceny a zásoby na Mouser...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} disableGutters sx={{ mt: 2, mb: 4, width: '100%', px: { xs: 1, sm: 1.5, md: 2, lg: 2.5, xl: 3 } }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        flexDirection={{ xs: 'column', sm: 'row' }}
        gap={{ xs: 1, sm: 2 }}
        mb={2}
      >
        <Typography variant="h4">
          <ShoppingCartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Příprava Mouser objednávky
          {isCompleted && <Chip label="Provedená / Uzamčená" color="success" size="medium" sx={{ ml: 2, verticalAlign: 'middle' }} />}
        </Typography>
        <Button variant="outlined" sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }} onClick={() => {
          if (needsSave || isSaving) {
            if (!window.confirm("Máte neuložené změny, opravdu chcete odejít?")) return;
          }
          navigate('/orders');
        }}>Zpět na seznam</Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center" mb={1}>
          <Grid item xs={12} md={6}>
            <TextField 
              label="Název objednávky" 
              variant="outlined" 
              required
              fullWidth
              value={orderName}
              onChange={(e) => {
                setOrderName(e.target.value);
                setNeedsSave(true);
              }}
              disabled={isCompleted}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              forcePopupIcon={false}
              getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
              value={selectedTags}
              onChange={(event, newValue) => {
                setSelectedTags(newValue as Tag[]);
                setNeedsSave(true);
              }}
              disabled={isCompleted}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const label = typeof option === 'string' ? option : option.name;
                  const bColor = typeof option === 'string' ? '#2196f3' : option.color;
                  return (
                      <Chip variant="outlined" label={label} {...getTagProps({ index })} 
                        sx={{ borderColor: bColor, color: bColor, fontWeight: 'bold' }} 
                      />
                  );
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  label="Tagy"
                  placeholder="Vyberte nebo vytvořte štítek"
                />
              )}
            />
          </Grid>
        </Grid>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} display="flex" gap={1}>
            <TextField 
              label="Mouser URL / číslo dílu" 
              variant="outlined" 
              fullWidth
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
              disabled={isCompleted}
            />
            <Button variant="contained" color="primary" onClick={handleAddItem} disabled={loading || isCompleted} sx={{ minWidth: '120px' }}>
              {loading ? 'Hledám...' : 'Přidat'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {orderItems.length > 0 && (
        <Box display="flex" gap={1} flexWrap="wrap" mb={1.5}>
          <Button variant="outlined" onClick={() => openTransferDialog('copy')} disabled={selectedItemIds.length === 0 || !id || id === 'new'}>
            Kopírovat vybrané
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => openTransferDialog('move')}
            disabled={selectedItemIds.length === 0 || isCompleted || !id || id === 'new'}
          >
            Přesunout vybrané
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
            Označeno: {selectedItemIds.length}
          </Typography>
        </Box>
      )}

      {orderItems.length > 0 && (
        <TableContainer component={Paper} sx={{ overflowX: 'auto', mb: 3 }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
              <TableRow>
                <TableCell padding="checkbox" align="center">
                  <Checkbox
                    size="small"
                    checked={orderItems.filter((item) => item.id).length > 0 && orderItems.filter((item) => item.id).every((item) => selectedItemIds.includes(item.id as number))}
                    onChange={toggleSelectAll}
                  />
                </TableCell>
                <TableCell>Díl (Mouser / Výrobce)</TableCell>
                <TableCell align="center">Sklad (lokální / Mouser)</TableCell>
                <TableCell align="center">Chci ks</TableCell>
                <TableCell>Tagy projektu</TableCell>
                <TableCell align="right">Cena / ks</TableCell>
                <TableCell align="right">Celkem</TableCell>
                <TableCell align="center">Akce</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orderItems.map((item, idx) => (
                <TableRow
                  key={idx}
                  sx={{
                    backgroundColor: item.mouserStock <= 0 ? 'rgba(211, 47, 47, 0.08)' : 'inherit',
                  }}
                >
                  <TableCell padding="checkbox" align="center">
                    <Checkbox
                      size="small"
                      checked={item.id ? selectedItemIds.includes(item.id) : false}
                      onChange={() => toggleItemSelection(item.id)}
                      disabled={!item.id}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      component="a"
                      href={`https://cz.mouser.com/c/?q=${encodeURIComponent(item.mouserPart)}`}
                      target="_blank"
                      rel="noopener"
                      variant="subtitle2"
                      color="primary"
                      sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {item.mouserPart}
                    </Typography>
                    <Typography variant="body2">{item.mfgPart}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                      <Chip size="small" label={`L: ${item.localStock} ks`} color={item.localStock > 0 ? "success" : "default"} />
                      <Chip size="small" label={`M: ${item.mouserStock} ks`} color={item.mouserStock > 0 ? "primary" : "error"} variant="outlined" />
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box>
                      <TextField 
                        type="number" 
                        value={item.quantity} 
                        onChange={(e) => updateQuantity(idx, parseInt(e.target.value) || 1)}
                        inputProps={{ min: 1 }}
                        sx={{ width: '80px' }}
                        size="small"
                        disabled={isCompleted}
                      />
                      {getOptimizationHint(item) && (
                        <Chip
                          size="small"
                          color="info"
                          variant="outlined"
                          label={getOptimizationHint(item)}
                          sx={{ mt: 0.5, maxWidth: 260, height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Autocomplete
                      multiple
                      options={availableTags}
                      forcePopupIcon={false}
                      value={item.tags}
                      getOptionLabel={(option) => option.name}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      onChange={(_, newValue) => updateItemTags(idx, newValue as Tag[])}
                      disabled={isCompleted}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            variant="outlined"
                            size="small"
                            label={option.name}
                            {...getTagProps({ index })}
                            sx={{ borderColor: option.color, color: option.color }}
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField {...params} size="small" placeholder="Projekt / tag" />
                      )}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.25}>
                      {getSortedBreaks(item.priceBreaks).map((priceBreak) => {
                        const isActive = getActiveBreakQuantity(item.quantity, item.priceBreaks) === priceBreak.Quantity;
                        return (
                          <Typography
                            key={`${item.mouserPart}-${priceBreak.Quantity}`}
                            variant="caption"
                            component="div"
                            sx={{
                              px: 0.5,
                              borderRadius: 0.5,
                              bgcolor: isActive ? 'success.light' : 'transparent',
                              color: isActive ? 'success.contrastText' : 'text.secondary',
                              fontWeight: isActive ? 700 : 400,
                              display: 'block',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {priceBreak.Quantity}+ ks: {parseBreakPrice(priceBreak.Price).toFixed(1)} 
                          </Typography>
                        );
                      })}
                      {item.priceBreaks.length === 0 && (
                        <Typography variant="caption" color="text.secondary">Není cena</Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right"><strong>{getEffectivePricing(item).total.toFixed(2)}</strong></TableCell>
                  <TableCell align="center">
                    <Box display="flex" gap={0.5} justifyContent="center" flexWrap="wrap">
                      <Button color="primary" size="small" onClick={() => openSingleTransferDialog(item.id, 'copy')} disabled={!item.id || !id || id === 'new'}>
                        Kopie
                      </Button>
                      <Button color="secondary" size="small" onClick={() => openSingleTransferDialog(item.id, 'move')} disabled={!item.id || !id || id === 'new' || isCompleted}>
                        Přesun
                      </Button>
                      <Button color="error" size="small" onClick={() => removeRow(idx)} disabled={isCompleted}>X</Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {orderItems.length > 0 && (
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
           <Typography variant="h6">
             Hodnota bez DPH: <strong>{orderItems.reduce((acc, curr) => acc + getEffectivePricing(curr).total, 0).toFixed(2)}</strong>
           </Typography>
           <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
             {!isCompleted ? (
               <>
                 {isSaving ? (
                   <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
                     Ukládám...
                   </Typography>
                 ) : (
                   needsSave && <Typography variant="body2" color="warning.main" sx={{ mr: 2 }}>Neuložené změny</Typography>
                 )}
                 <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => handleSaveOrder(true)}>
                   Označit jako Provedenou
                 </Button>
               </>
             ) : (
                <Button variant="outlined" color="warning" startIcon={<LockOpenIcon />} onClick={handleUnlock}>
                 Odemknout objednávku
               </Button>
             )}
             
             <Button variant="contained" color="primary" startIcon={<DownloadIcon />} onClick={exportCSV}>
               Export CSV
             </Button>
           </Box>
        </Box>
      )}

      <Snackbar 
        open={savedStatus.open} 
        autoHideDuration={4000} 
        onClose={() => setSavedStatus({...savedStatus, open: false})}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={savedStatus.severity} sx={{ width: '100%' }}>
          {savedStatus.message}
        </Alert>
      </Snackbar>

      <Dialog open={transferDialogOpen} onClose={() => setTransferDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{transferMode === 'move' ? 'Přesunout vybrané položky' : 'Kopírovat vybrané položky'}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Vyberte cílovou rozpracovanou objednávku. Označené položky: {selectedItemIds.length}
          </DialogContentText>
          <Autocomplete
            options={openOrders}
            value={transferTargetOrder}
            onChange={(_, newValue) => setTransferTargetOrder(newValue)}
            getOptionLabel={(option) => `${option.name} (#${option.id})`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Cílová objednávka" variant="outlined" />}
            noOptionsText="Žádná rozpracovaná objednávka"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)}>Zrušit</Button>
          <Button onClick={confirmTransfer} variant="contained" disabled={!transferTargetOrder}>
            Potvrdit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={unlockDialogOpen} onClose={() => setUnlockDialogOpen(false)}>
        <DialogTitle>Opravdu odemknout?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tato objednávka již byla označena jako provedená. Pokud ji odemknete, riskujete nekonzistenci ve faktuře nebo objednávkovém systému, protože do ní budete moci upravovat počty nebo přidávat komponenty.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnlockDialogOpen(false)}>Zrušit</Button>
          <Button onClick={confirmUnlock} color="warning" variant="contained" autoFocus>
            Ano, odemknout
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default OrderBuilder;
