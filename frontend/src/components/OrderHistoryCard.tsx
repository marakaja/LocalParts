import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Container, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Box, Dialog, DialogActions,
  DialogContent, DialogTitle, TextField, Button, Checkbox, Alert,
  CircularProgress, Card, CardContent, CardHeader, Tabs, Tab, Stack, Divider
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LinkIcon from '@mui/icons-material/Link';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import SearchIcon from '@mui/icons-material/Search';

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface OrderItem {
  id: number;
  part_number: string;
  quantity: number;
  tags?: Tag[];
}

interface PurchaseOrder {
  id: number;
  name: string;
  created_at: string;
  is_completed: boolean;
  items: OrderItem[];
  tags?: Tag[];
  is_mouser_order?: boolean;
  mouser_order_number?: string;
  matched_local_order?: {
    id: number;
    name: string;
    is_completed: boolean;
  } | null;
  mouser_data?: MouserData;
}

interface Component {
  id: number;
  part_number: string;
  name: string;
  quantity: number;
  location?: string;
}

interface MouserSearchResult {
  part_number: string;
  mouser_part_number: string;
  description: string;
  availability: string;
  price_breaks: any[];
}

interface MouserComparisonEntry {
  part_number: string;
  local_quantity: number;
  mouser_quantity: number;
  matched_quantity: number;
  quantity?: number;
}

interface MouserComparisonSummary {
  local_order?: { id: number; name: string } | null;
  mouser_order?: { id: number; name: string; mouser_order_number?: string } | null;
  matched_items: MouserComparisonEntry[];
  extra_items: MouserComparisonEntry[];
  missing_items: MouserComparisonEntry[];
}

interface MouserData {
  order_date?: string;
  status?: string;
  total_price?: string;
  items?: OrderItem[];
  processing?: {
    matched_local_order_id?: number | null;
    comparison?: MouserComparisonSummary | null;
  };
}

const normalizePartNumber = (value: string) => value.trim().toLowerCase();

const compareOrders = (mouserOrder: PurchaseOrder, localOrder?: PurchaseOrder | null): MouserComparisonSummary | null => {
  if (!localOrder) {
    return null;
  }

  const localMap = new Map<string, number>();
  localOrder.items.forEach((item) => {
    const key = normalizePartNumber(item.part_number);
    localMap.set(key, (localMap.get(key) || 0) + item.quantity);
  });

  const mouserMap = new Map<string, number>();
  mouserOrder.items.forEach((item) => {
    const key = normalizePartNumber(item.part_number);
    mouserMap.set(key, (mouserMap.get(key) || 0) + item.quantity);
  });

  const matchedItems: MouserComparisonEntry[] = [];
  const extraItems: MouserComparisonEntry[] = [];
  const missingItems: MouserComparisonEntry[] = [];

  const keys = Array.from(new Set([...localMap.keys(), ...mouserMap.keys()])).sort();
  keys.forEach((key) => {
    const localQuantity = localMap.get(key) || 0;
    const mouserQuantity = mouserMap.get(key) || 0;
    const matchedQuantity = Math.min(localQuantity, mouserQuantity);

    if (matchedQuantity > 0) {
      matchedItems.push({
        part_number: key.toUpperCase(),
        local_quantity: localQuantity,
        mouser_quantity: mouserQuantity,
        matched_quantity: matchedQuantity,
      });
    }

    if (mouserQuantity > localQuantity) {
      extraItems.push({
        part_number: key.toUpperCase(),
        local_quantity: localQuantity,
        mouser_quantity: mouserQuantity,
        matched_quantity: matchedQuantity,
        quantity: mouserQuantity - localQuantity,
      });
    }

    if (localQuantity > mouserQuantity) {
      missingItems.push({
        part_number: key.toUpperCase(),
        local_quantity: localQuantity,
        mouser_quantity: mouserQuantity,
        matched_quantity: matchedQuantity,
        quantity: localQuantity - mouserQuantity,
      });
    }
  });

  return {
    local_order: { id: localOrder.id, name: localOrder.name },
    mouser_order: { id: mouserOrder.id, name: mouserOrder.name, mouser_order_number: mouserOrder.mouser_order_number },
    matched_items: matchedItems,
    extra_items: extraItems,
    missing_items: missingItems,
  };
};

function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
  const { children, value, index } = props;
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

const OrderHistoryCard: React.FC = () => {
  const [completedOrders, setCompletedOrders] = useState<PurchaseOrder[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<Map<number, Set<number>>>(new Map());
  const [localLoading, setLocalLoading] = useState(false);
  const [mouserLoading, setMouserLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'match' | 'search'>('add');
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [matchingOrderId, setMatchingOrderId] = useState<string>('');
  const [allOrders, setAllOrders] = useState<PurchaseOrder[]>([]);
  const [addingItems, setAddingItems] = useState(false);
  const [newComponentName, setNewComponentName] = useState('');
  const [newComponentLocation, setNewComponentLocation] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [mouserSearchQuery, setMouserSearchQuery] = useState('');
  const [mouserSearchResults, setMouserSearchResults] = useState<MouserSearchResult[]>([]);
  const [mouserSearching, setMouserSearching] = useState(false);
  const [mouserOrders, setMouserOrders] = useState<PurchaseOrder[]>([]);
  const [mouserExpandedOrderId, setMouserExpandedOrderId] = useState<number | null>(null);
  const [mouserProcessOpen, setMouserProcessOpen] = useState(false);
  const [mouserProcessingOrder, setMouserProcessingOrder] = useState<PurchaseOrder | null>(null);
  const [matchedLocalOrderId, setMatchedLocalOrderId] = useState('');

  const localOrders = useMemo(() => completedOrders.filter((order) => !order.is_mouser_order), [completedOrders]);
  const visibleMouserOrders = useMemo(() => mouserOrders.filter((order) => order.is_mouser_order), [mouserOrders]);
  const selectedLocalOrder = useMemo(
    () => allOrders.find((order) => String(order.id) === matchedLocalOrderId && !order.is_mouser_order) || null,
    [allOrders, matchedLocalOrderId]
  );
  const liveMouserComparison = useMemo(
    () => (mouserProcessingOrder ? compareOrders(mouserProcessingOrder, selectedLocalOrder) : null),
    [mouserProcessingOrder, selectedLocalOrder]
  );

  const fetchCompletedOrders = async () => {
    setLocalLoading(true);
    try {
      const res = await axios.get('/api/orders/?is_completed=true');
      setCompletedOrders(res.data);
    } catch (err) {
      console.error('Chyba při načítání objednávek:', err);
      setErrorMessage('Nepodařilo se načíst objednávky');
    } finally {
      setLocalLoading(false);
    }
  };

  const fetchAllOrders = async () => {
    try {
      const res = await axios.get('/api/orders/');
      setAllOrders(res.data);
    } catch (err) {
      console.error('Chyba při načítání objednávek:', err);
    }
  };

  const fetchComponents = async () => {
    try {
      const res = await axios.get('/api/components/');
      setComponents(res.data);
    } catch (err) {
      console.error('Chyba při načítání součástek:', err);
    }
  };

  const fetchMouserOrders = async () => {
    setMouserLoading(true);
    try {
      const res = await axios.get('/api/mouser-orders/history/');
      setMouserOrders(res.data?.orders || []);
    } catch (err) {
      console.error('Chyba při načítání Mouser historie:', err);
      setErrorMessage('Nepodařilo se načíst Mouser historii');
    } finally {
      setMouserLoading(false);
    }
  };

  useEffect(() => {
    fetchCompletedOrders();
    fetchAllOrders();
    fetchComponents();
    fetchMouserOrders();
  }, []);

  const handleMouserSearch = async () => {
    if (!mouserSearchQuery) {
      setErrorMessage('Zadejte hledaný výraz');
      return;
    }

    setMouserSearching(true);
    try {
      const res = await axios.post('/api/mouser-orders/search/', {
        search_query: mouserSearchQuery,
        search_type: 'part_number'
      });
      setMouserSearchResults(res.data.results || []);
    } catch (err) {
      console.error('Chyba při hledání v Mouser:', err);
      setErrorMessage('Chyba při hledání v Mouser');
    } finally {
      setMouserSearching(false);
    }
  };

  const handleItemSelect = (orderId: number, itemId: number) => {
    setSelectedItems(prevState => {
      const newState = new Map(prevState);
      if (!newState.has(orderId)) {
        newState.set(orderId, new Set());
      }
      const itemSet = newState.get(orderId)!;
      if (itemSet.has(itemId)) {
        itemSet.delete(itemId);
      } else {
        itemSet.add(itemId);
      }
      return newState;
    });
  };

  const handleSelectAllItems = (orderId: number, order: PurchaseOrder) => {
    setSelectedItems(prevState => {
      const newState = new Map(prevState);
      const itemSet = newState.get(orderId) || new Set();
      
      if (itemSet.size === order.items.length) {
        newState.set(orderId, new Set());
      } else {
        const allItemIds = order.items.map(item => item.id);
        newState.set(orderId, new Set(allItemIds));
      }
      return newState;
    });
  };

  const handleAddItemsToWarehouse = async () => {
    if (!currentOrderId) return;

    const selectedItemIds = Array.from(selectedItems.get(currentOrderId) || []);
    if (selectedItemIds.length === 0) {
      setErrorMessage('Vyberte alespoň jednu položku');
      return;
    }

    const order = localOrders.find(o => o.id === currentOrderId);
    if (!order) return;

    const itemsToAdd = order.items.filter(item => selectedItemIds.includes(item.id));

    setAddingItems(true);
    try {
      for (const item of itemsToAdd) {
        const existingComponent = components.find(
          c => c.part_number.toLowerCase() === item.part_number.toLowerCase()
        );

        if (existingComponent) {
          await axios.patch(`/api/components/${existingComponent.id}/`, {
            quantity: existingComponent.quantity + item.quantity,
          });
        } else {
          await axios.post('/api/components/', {
            part_number: item.part_number,
            name: newComponentName || item.part_number,
            description: `Přidáno z objednávky ${order.name}`,
            quantity: item.quantity,
            location: newComponentLocation || 'Nevyplněno',
            category: 'Importováno',
          });
        }
      }

      setSuccessMessage(`${selectedItemIds.length} položek(y) úspěšně přidáno do skladu`);
      setSelectedItems(prevState => {
        const newState = new Map(prevState);
        newState.delete(currentOrderId);
        return newState;
      });
      setOpenDialog(false);
      fetchComponents();
      setNewComponentName('');
      setNewComponentLocation('');

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Chyba při přidávání do skladu:', err);
      setErrorMessage('Chyba při přidávání položek do skladu');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setAddingItems(false);
    }
  };

  const handleOpenAddDialog = (orderId: number) => {
    setCurrentOrderId(orderId);
    setDialogMode('add');
    setOpenDialog(true);
  };

  const handleOpenMatchDialog = (orderId: number) => {
    setCurrentOrderId(orderId);
    setDialogMode('match');
    setOpenDialog(true);
  };

  const handleMatchOrder = async () => {
    if (!currentOrderId || !matchingOrderId) {
      setErrorMessage('Vyberte objednávku, se kterou chcete spárovat');
      return;
    }

    try {
      await axios.patch(`/api/orders/${currentOrderId}/`, {
        name: `${completedOrders.find(o => o.id === currentOrderId)?.name} [Spárováno s #${matchingOrderId}]`,
      });

      setSuccessMessage('Objednávky úspěšně spárovány');
      setOpenDialog(false);
      setMatchingOrderId('');
      fetchCompletedOrders();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Chyba při spárování objednávek:', err);
      setErrorMessage('Chyba při spárování objednávek');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (!window.confirm('Opravdu chcete smazat tuto objednávku?')) return;

    try {
      await axios.delete(`/api/orders/${orderId}/`);
      setSuccessMessage('Objednávka smazána');
      fetchCompletedOrders();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Chyba při mazání objednávky:', err);
      setErrorMessage('Chyba při mazání objednávky');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleOpenMouserProcess = (order: PurchaseOrder) => {
    setMouserProcessingOrder(order);
    setMatchedLocalOrderId(order.matched_local_order?.id ? String(order.matched_local_order.id) : '');
    setMouserProcessOpen(true);
  };

  const handleSaveMouserProcess = async () => {
    if (!mouserProcessingOrder) return;

    try {
      const response = await axios.post(`/api/mouser-orders/${mouserProcessingOrder.id}/process/`, {
        matched_local_order_id: matchedLocalOrderId ? Number(matchedLocalOrderId) : null,
      });

      const updatedOrder = response.data?.order;
      if (updatedOrder) {
        setMouserOrders((prev) => prev.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)));
      } else {
        await fetchMouserOrders();
      }

      setSuccessMessage('Mouser objednávka byla zpracována');
      setMouserProcessOpen(false);
      setMouserProcessingOrder(null);
      setMatchedLocalOrderId('');
      await fetchAllOrders();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Chyba při zpracování Mouser objednávky:', err);
      setErrorMessage('Zpracování Mouser objednávky selhalo');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ mt: 2, mb: 4, px: { xs: 1, sm: 2, md: 3 } }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CheckCircleIcon color="success" />
        Historie Objednávek
      </Typography>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Místní objednávky" />
          <Tab label="Mouser historie" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        {localLoading ? (
          <Container maxWidth="xl" sx={{ mt: 2, mb: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Container>
        ) : localOrders.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="textSecondary">Žádné dokončené objednávky</Typography>
          </Paper>
        ) : (
          <Box>
            {localOrders
              .map((order) => (
                <Card key={order.id} sx={{ mb: 2, boxShadow: 2 }}>
                  <CardHeader
                    title={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                          <Typography variant="h6">
                            #{order.id} - {order.name}
                          </Typography>
                          <Chip label="Dokončená" size="small" color="success" variant="filled" />
                        </Box>
                        <Typography variant="caption" color="textSecondary">
                          {new Date(order.created_at).toLocaleDateString('cs-CZ')}
                        </Typography>
                      </Box>
                    }
                    action={
                      <IconButton
                        size="small"
                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                      >
                        <ExpandMoreIcon
                          sx={{
                            transform: expandedOrderId === order.id ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s',
                          }}
                        />
                      </IconButton>
                    }
                  />

                  {expandedOrderId === order.id && (
                    <CardContent>
                      {order.tags && order.tags.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>Tagy:</Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {order.tags.map(tag => (
                              <Chip
                                key={tag.id}
                                size="small"
                                label={tag.name}
                                sx={{ borderColor: tag.color, color: tag.color }}
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </Box>
                      )}

                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                        Položky ({order.items.length}):
                      </Typography>

                      <TableContainer component={Paper} sx={{ mb: 2 }}>
                        <Table size="small">
                          <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                            <TableRow>
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={
                                    order.items.length > 0 &&
                                    (selectedItems.get(order.id)?.size || 0) === order.items.length
                                  }
                                  indeterminate={
                                    (selectedItems.get(order.id)?.size || 0) > 0 &&
                                    (selectedItems.get(order.id)?.size || 0) < order.items.length
                                  }
                                  onChange={() => handleSelectAllItems(order.id, order)}
                                />
                              </TableCell>
                              <TableCell>Díl číslo</TableCell>
                              <TableCell align="center">Množství</TableCell>
                              <TableCell>Tagy</TableCell>
                              <TableCell align="center">Na skladě</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {order.items.map((item) => {
                              const isSelected = selectedItems.get(order.id)?.has(item.id) || false;
                              const existingComponent = components.find(
                                c => c.part_number.toLowerCase() === item.part_number.toLowerCase()
                              );

                              return (
                                <TableRow
                                  key={item.id}
                                  sx={{
                                    backgroundColor: isSelected ? '#e3f2fd' : 'inherit',
                                    '&:hover': { backgroundColor: '#f5f5f5' },
                                  }}
                                >
                                  <TableCell padding="checkbox">
                                    <Checkbox
                                      checked={isSelected}
                                      onChange={() => handleItemSelect(order.id, item.id)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <strong>{item.part_number}</strong>
                                    {existingComponent && (
                                      <Chip label="Existuje" size="small" variant="outlined" sx={{ ml: 1 }} />
                                    )}
                                  </TableCell>
                                  <TableCell align="center">{item.quantity} ks</TableCell>
                                  <TableCell>
                                    {item.tags && item.tags.length > 0 ? (
                                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                        {item.tags.map(tag => (
                                          <Chip
                                            key={tag.id}
                                            size="small"
                                            label={tag.name}
                                            sx={{ borderColor: tag.color, color: tag.color }}
                                            variant="outlined"
                                          />
                                        ))}
                                      </Box>
                                    ) : (
                                      <Typography variant="caption" color="textSecondary">-</Typography>
                                    )}
                                  </TableCell>
                                  <TableCell align="center">
                                    {existingComponent ? (
                                      <Chip label={`${existingComponent.quantity} ks`} size="small" color="primary" variant="filled" />
                                    ) : (
                                      <Typography variant="caption" color="error">Není</Typography>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          startIcon={<WarehouseIcon />}
                          onClick={() => handleOpenAddDialog(order.id)}
                          disabled={(selectedItems.get(order.id)?.size || 0) === 0}
                        >
                          Přidat do skladu ({selectedItems.get(order.id)?.size || 0})
                        </Button>
                        <Button
                          variant="outlined"
                          color="primary"
                          size="small"
                          startIcon={<LinkIcon />}
                          onClick={() => handleOpenMatchDialog(order.id)}
                        >
                          Spárovat
                        </Button>
                        <IconButton color="error" size="small" onClick={() => handleDeleteOrder(order.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </CardContent>
                  )}
                </Card>
              ))}
          </Box>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" gutterBottom>Mouser historie</Typography>
                <Typography variant="body2" color="text.secondary">
                  Načítá objednávky z posledních 20 let a umožní je spárovat s místními objednávkami.
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  label="Rychlé hledání v Mouser"
                  value={mouserSearchQuery}
                  onChange={(e) => setMouserSearchQuery(e.target.value)}
                  placeholder="Číslo dílu nebo produkt"
                  fullWidth
                  size="small"
                  disabled={mouserSearching}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleMouserSearch();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={handleMouserSearch}
                  disabled={mouserSearching || !mouserSearchQuery.trim()}
                  sx={{ minWidth: 140 }}
                >
                  {mouserSearching ? <CircularProgress size={22} /> : 'Hledat'}
                </Button>
                <Button variant="outlined" onClick={fetchMouserOrders} disabled={mouserLoading} sx={{ minWidth: 170 }}>
                  {mouserLoading ? <CircularProgress size={22} /> : 'Obnovit historii'}
                </Button>
              </Stack>

              {mouserSearchResults.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableRow>
                        <TableCell>Číslo dílu</TableCell>
                        <TableCell>Popis</TableCell>
                        <TableCell align="center">Dostupnost</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {mouserSearchResults.map((result, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <strong>{result.part_number}</strong>
                            <br />
                            <Typography variant="caption" color="text.secondary">{result.mouser_part_number}</Typography>
                          </TableCell>
                          <TableCell>{result.description}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={result.availability}
                              size="small"
                              color={result.availability.includes('In Stock') ? 'success' : 'warning'}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          </Paper>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Mouser objednávky za posledních 20 let</Typography>
            <Chip label={`${visibleMouserOrders.length} objednávek`} color="primary" variant="outlined" />
          </Box>

          {mouserLoading ? (
            <Container maxWidth="xl" sx={{ mt: 2, mb: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Container>
          ) : visibleMouserOrders.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Žádné Mouser objednávky nebyly nalezeny.</Typography>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {visibleMouserOrders.map((order) => {
                const processingComparison = order.mouser_data?.processing?.comparison || null;
                const matchedLocalOrder = order.matched_local_order;
                const isExpanded = mouserExpandedOrderId === order.id;

                return (
                  <Card key={order.id} sx={{ boxShadow: 2 }}>
                    <CardHeader
                      title={
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                          <Typography variant="h6">{order.mouser_order_number || order.name}</Typography>
                          <Chip
                            label={order.mouser_data?.status || 'Mouser'}
                            size="small"
                            color={matchedLocalOrder ? 'success' : 'default'}
                          />
                          {matchedLocalOrder && (
                            <Chip
                              label={`Přiřazeno: ${matchedLocalOrder.name}`}
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      }
                      subheader={
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {order.mouser_data?.order_date ? new Date(order.mouser_data.order_date).toLocaleDateString('cs-CZ') : new Date(order.created_at).toLocaleDateString('cs-CZ')}
                          </Typography>
                          {order.mouser_data?.total_price && (
                            <Typography variant="caption" color="text.secondary">Celkem: {order.mouser_data.total_price}</Typography>
                          )}
                        </Stack>
                      }
                      action={
                        <Stack direction="row" spacing={1} alignItems="center">
                          {processingComparison && (
                            <Chip label={`Shoda ${processingComparison.matched_items.length}`} size="small" color="primary" variant="outlined" />
                          )}
                          <IconButton size="small" onClick={() => setMouserExpandedOrderId(isExpanded ? null : order.id)}>
                            <ExpandMoreIcon sx={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }} />
                          </IconButton>
                        </Stack>
                      }
                    />

                    {isExpanded && (
                      <CardContent>
                        <Stack spacing={2}>
                          {processingComparison && (
                            <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#fafafa' }}>
                              <Typography variant="subtitle2" gutterBottom>Zpracování</Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip label={`Shoda: ${processingComparison.matched_items.reduce((sum, item) => sum + item.matched_quantity, 0)} ks`} size="small" />
                                <Chip label={`Navíc: ${processingComparison.extra_items.reduce((sum, item) => sum + (item.quantity || 0), 0)} ks`} size="small" color="warning" />
                                <Chip label={`Chybí: ${processingComparison.missing_items.reduce((sum, item) => sum + (item.quantity || 0), 0)} ks`} size="small" color="error" />
                              </Stack>
                            </Paper>
                          )}

                          <Box>
                            <Typography variant="subtitle2" gutterBottom>Položky ({order.items.length})</Typography>
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                                  <TableRow>
                                    <TableCell>Číslo dílu</TableCell>
                                    <TableCell align="center">Množství</TableCell>
                                    <TableCell align="center">Poznámka</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {order.items.map((item, index) => (
                                    <TableRow key={`${order.id}-${item.part_number}-${index}`}>
                                      <TableCell><strong>{item.part_number}</strong></TableCell>
                                      <TableCell align="center">{item.quantity} ks</TableCell>
                                      <TableCell align="center">
                                        {item.quantity > 0 ? 'Součást objednávky' : '-'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </Box>

                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <Button
                              variant="contained"
                              color="primary"
                              onClick={() => handleOpenMouserProcess(order)}
                            >
                              Zpracovat
                            </Button>
                            <IconButton color="error" size="small" onClick={() => handleDeleteOrder(order.id)}>
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Stack>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
      </TabPanel>

      <Dialog open={mouserProcessOpen && !!mouserProcessingOrder} onClose={() => setMouserProcessOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Zpracovat Mouser objednávku</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Vyberte místní objednávku, se kterou chcete Mouser objednávku spárovat. Bez výběru zůstane objednávka nepřiřazená.
            </Alert>

            <TextField
              select
              label="Místní objednávka"
              value={matchedLocalOrderId}
              onChange={(e) => setMatchedLocalOrderId(e.target.value)}
              SelectProps={{ native: true }}
              fullWidth
              size="small"
            >
              <option value="">Nepřiřazovat</option>
              {localOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  #{order.id} - {order.name}
                </option>
              ))}
            </TextField>

            <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#fafafa' }}>
              <Typography variant="subtitle2" gutterBottom>Porovnání</Typography>
              {!liveMouserComparison ? (
                <Typography variant="body2" color="text.secondary">
                  Nevybraná místní objednávka znamená, že se objednávka pouze uloží bez porovnání.
                </Typography>
              ) : (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={`Shoda: ${liveMouserComparison.matched_items.reduce((sum, item) => sum + item.matched_quantity, 0)} ks`} color="success" size="small" />
                    <Chip label={`Navíc: ${liveMouserComparison.extra_items.reduce((sum, item) => sum + (item.quantity || 0), 0)} ks`} color="warning" size="small" />
                    <Chip label={`Chybí: ${liveMouserComparison.missing_items.reduce((sum, item) => sum + (item.quantity || 0), 0)} ks`} color="error" size="small" />
                  </Stack>

                  <Divider />

                  <Box>
                    <Typography variant="caption" color="text.secondary">Shodné položky</Typography>
                    <Typography variant="body2">
                      {liveMouserComparison.matched_items.length > 0
                        ? liveMouserComparison.matched_items.map((item) => `${item.part_number} (${item.matched_quantity} ks)`).join(', ')
                        : 'Žádné'}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">Navíc koupeno</Typography>
                    <Typography variant="body2">
                      {liveMouserComparison.extra_items.length > 0
                        ? liveMouserComparison.extra_items.map((item) => `${item.part_number} (+${item.quantity || 0} ks)`).join(', ')
                        : 'Žádné'}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">Chybí proti místní objednávce</Typography>
                    <Typography variant="body2">
                      {liveMouserComparison.missing_items.length > 0
                        ? liveMouserComparison.missing_items.map((item) => `${item.part_number} (-${item.quantity || 0} ks)`).join(', ')
                        : 'Žádné'}
                    </Typography>
                  </Box>
                </Stack>
              )}
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMouserProcessOpen(false)}>Zrušit</Button>
          <Button onClick={() => setMatchedLocalOrderId('')} disabled={!matchedLocalOrderId}>
            Nepřiřazovat
          </Button>
          <Button onClick={handleSaveMouserProcess} variant="contained" color="primary" disabled={!mouserProcessingOrder}>
            Uložit přiřazení
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDialog && dialogMode === 'add'} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Přidat položky do skladu</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info">
              Vybrané položky budou přidány do skladu. Pokud součástka již existuje, bude zvýšeno její množství.
            </Alert>

            <TextField
              label="Název součástky (volitelně)"
              value={newComponentName}
              onChange={(e) => setNewComponentName(e.target.value)}
              placeholder="Ponechte prázdné pro použití čísla dílu"
              fullWidth
              size="small"
            />

            <TextField
              label="Umístění v skladě (volitelně)"
              value={newComponentLocation}
              onChange={(e) => setNewComponentLocation(e.target.value)}
              placeholder="Např. A1, Polička 3"
              fullWidth
              size="small"
            />

            <Typography variant="subtitle2" color="textSecondary">
              {selectedItems.get(currentOrderId!)?.size || 0} položek(y) bude přidáno do skladu
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Zrušit</Button>
          <Button
            onClick={handleAddItemsToWarehouse}
            variant="contained"
            color="primary"
            disabled={addingItems}
          >
            {addingItems ? <CircularProgress size={24} /> : 'Přidat do skladu'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDialog && dialogMode === 'match'} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Spárovat objednávku</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info">
              Spárujte tuto objednávku s jinou objednávkou pro sledování v databázi.
            </Alert>

            <TextField
              select
              label="Vybrat objednávku"
              value={matchingOrderId}
              onChange={(e) => setMatchingOrderId(e.target.value)}
              SelectProps={{
                native: true,
              }}
              fullWidth
            >
              <option value="">-- Vyberte objednávku --</option>
              {allOrders
                .filter(o => o.id !== currentOrderId)
                .map(o => (
                  <option key={o.id} value={o.id}>
                    #{o.id} - {o.name} {o.is_completed ? '(Dokončená)' : '(Rozpracovaná)'}
                  </option>
                ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Zrušit</Button>
          <Button onClick={handleMatchOrder} variant="contained" color="primary">
            Spárovat
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default OrderHistoryCard;
