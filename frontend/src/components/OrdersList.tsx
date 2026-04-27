import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Container, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';

interface Order {
  id: number;
  name: string;
  created_at: string;
  is_completed: boolean;
  tags?: Tag[];
}

interface Tag {
  id: number;
  name: string;
  color: string;
}

const OrdersList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState('');
  const navigate = useNavigate();

  const fetchOrders = async () => {
    try {
      const res = await axios.get('/api/orders/');
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await axios.get('/api/tags/');
      setTags(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchTags();
  }, []);

  const filteredOrders = useMemo(() => {
    if (!tagFilter) return orders;
    return orders.filter(order => (order.tags || []).some(tag => String(tag.id) === tagFilter));
  }, [orders, tagFilter]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Opravdu chcete tuto objednávku smazat?')) return;
    try {
      await axios.delete(`/api/orders/${id}/`);
      fetchOrders();
    } catch (err) {
      console.error('Chyba při mazání objednávky', err);
      alert('Nepodařilo se smazat objednávku.');
    }
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ mt: 2, mb: 4, px: { xs: 1, sm: 2, md: 3 } }}>
      <Typography variant="h4" gutterBottom>
        Seznam Objednávek
      </Typography>
      
      <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => navigate('/order/new')} sx={{ mb: 3 }}>
        Nová objednávka
      </Button>

      <Box mb={2}>
        <FormControl sx={{ minWidth: 260, width: { xs: '100%', sm: 'auto' } }}>
          <InputLabel id="orders-tag-filter-label">Filtrovat podle tagu</InputLabel>
          <Select
            labelId="orders-tag-filter-label"
            value={tagFilter}
            label="Filtrovat podle tagu"
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <MenuItem value=""><em>Všechny tagy</em></MenuItem>
            {tags.map(tag => (
              <MenuItem key={tag.id} value={String(tag.id)}>{tag.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper} sx={{ width: '100%' }}>
        <Table sx={{ width: '100%', '& .MuiTableCell-root': { px: { xs: 0.75, sm: 2 } } }}>
          <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Název objednávky</TableCell>
              <TableCell>Datum vytvoření</TableCell>
              <TableCell>Tagy</TableCell>
              <TableCell align="center">Stav</TableCell>
              <TableCell align="center">Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{order.id}</TableCell>
                <TableCell><strong>{order.name}</strong></TableCell>
                <TableCell>{new Date(order.created_at).toLocaleDateString('cs-CZ')}</TableCell>
                <TableCell>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {(order.tags || []).length > 0 ? (
                      (order.tags || []).map(tag => (
                        <Chip
                          key={tag.id}
                          size="small"
                          label={tag.name}
                          sx={{ borderColor: tag.color, color: tag.color }}
                          variant="outlined"
                        />
                      ))
                    ) : (
                      <Typography variant="caption" color="text.secondary">Bez tagů</Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Chip 
                    label={order.is_completed ? 'Provedená' : 'Rozpracovaná'} 
                    color={order.is_completed ? 'success' : 'warning'} 
                    size="small" 
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton color="primary" onClick={() => navigate(`/order/${order.id}`)}> 
                    <EditIcon />
                  </IconButton>
                  <IconButton color="error" onClick={() => handleDelete(order.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {filteredOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">Žádná objednávka neodpovídá filtru.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default OrdersList;
