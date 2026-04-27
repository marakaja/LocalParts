import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Container, Typography, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Button, TextField, Box, IconButton, Link, Select, MenuItem, InputLabel, FormControl 
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { Collapse } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

const API_URL = '/api/components/';

export interface ComponentData {
  id?: number;
  part_number: string;
  name: string;
  description: string;
  category: string;
  parameters: Record<string, any>;
  quantity: number;
  location: string;
  distributor: string;
  barcode_data: string;
  datasheet_url: string;
  eda_model_url: string;
}

const ExpandableRow: React.FC<{ comp: ComponentData, handleDelete: (id: number) => void }> = ({ comp, handleDelete }) => {
  const [open, setOpen] = useState(false);
  const mouserSearchUrl = `https://cz.mouser.com/c/?q=${encodeURIComponent(comp.part_number)}`;
  const basicParameters = (comp.parameters as any)?.BasicParameters ?? {};
  const productImage = basicParameters?.ImagePath || (comp.parameters as any)?.ImagePath || '';
  const basicParameterEntries = Object.entries(basicParameters).filter(([key]) => key !== 'ImagePath');

  return (
    <React.Fragment>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight="bold">{comp.part_number}</Typography>
          <Typography variant="caption" color="text.secondary">{comp.name}</Typography>
        </TableCell>
        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{comp.category || '-'}</TableCell>
        <TableCell>{comp.quantity}</TableCell>
        <TableCell align="center" sx={{ whiteSpace: 'nowrap', px: { xs: 0.5, sm: 2 } }}>
          <Box display="flex" justifyContent="center" flexWrap={{ xs: 'wrap', sm: 'nowrap' }} gap={0.5}>
            {comp.datasheet_url && (
              <IconButton component="a" href={comp.datasheet_url} target="_blank" rel="noopener" color="error" title="Datasheet" size="small">
                <PictureAsPdfIcon fontSize="small" />
              </IconButton>
            )}
            {comp.eda_model_url && (
              <IconButton component="a" href={comp.eda_model_url} target="_blank" rel="noopener" download="EDA_model" color="secondary" title="Stáhnout EDA Model" size="small">
                <DashboardCustomizeIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton component="a" href={mouserSearchUrl} target="_blank" rel="noopener" color="info" title="Hledat na Mouser" size="small">
              <ShoppingCartIcon fontSize="small" />
            </IconButton>
            <IconButton color="primary" href={`/edit/${comp.id}`} size="small">
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton color="error" onClick={() => comp.id && handleDelete(comp.id)} size="small">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1, p: 2, bgcolor: '#f9f9f9', borderRadius: 1 }}>
              <Box
                display="flex"
                flexDirection={{ xs: 'column', md: 'row' }}
                gap={2}
                alignItems={{ xs: 'stretch', md: 'flex-start' }}
              >
                <Box
                  sx={{
                    width: { xs: '100%', md: 240 },
                    minWidth: { md: 240 },
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: '#fff',
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    p: 1,
                  }}
                >
                  {productImage ? (
                    <Box
                      component="img"
                      src={productImage}
                      alt={comp.name}
                      sx={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: 220 }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center">
                      Obrázek není k dispozici
                    </Typography>
                  )}
                </Box>

                <Box flex={1}>
                  <Typography variant="h6" gutterBottom component="div">Základní parametry</Typography>
                  <Typography variant="body2" gutterBottom><strong>Popis:</strong> {comp.description || '-'}</Typography>
                  <Typography variant="body2" gutterBottom><strong>Lokace:</strong> {comp.location || '-'}</Typography>
                  <Typography variant="body2" gutterBottom><strong>Dodavatel:</strong> {comp.distributor || '-'}</Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Mouser:</strong>{' '}
                    <Link href={mouserSearchUrl} target="_blank" rel="noopener">
                      Otevřít vyhledání pro {comp.part_number}
                    </Link>
                  </Typography>

                  {basicParameterEntries.length > 0 && (
                    <Box mt={1}>
                      {basicParameterEntries.map(([key, value]) => (
                        <Typography key={key} variant="body2" gutterBottom>
                          <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};

const ComponentList: React.FC = () => {
  const [components, setComponents] = useState<ComponentData[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [distributorFilter, setDistributorFilter] = useState('');

  const fetchComponents = async () => {
    try {
      const response = await axios.get(`${API_URL}?search=${search}`);
      setComponents(response.data);
    } catch (error) {
      console.error("Error fetching components:", error);
    }
  };

  useEffect(() => {
    fetchComponents();
  }, [search]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(components.map(c => c.category || 'Nespecifikováno').filter(c => c.trim() !== ''));
    return Array.from(cats).sort();
  }, [components]);

  const uniqueDistributors = useMemo(() => {
    const distributors = new Set(components.map(c => c.distributor || 'Neznámý').filter(c => c.trim() !== ''));
    return Array.from(distributors).sort();
  }, [components]);

  const filteredComponents = useMemo(() => {
    return components.filter(c => {
      const categoryMatches = !categoryFilter || (c.category || 'Nespecifikováno') === categoryFilter;
      const distributorMatches = !distributorFilter || (c.distributor || 'Neznámý') === distributorFilter;
      return categoryMatches && distributorMatches;
    });
  }, [components, categoryFilter, distributorFilter]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Opravdu chcete tuto komponentu trvale smazat?")) return;
    try {
      await axios.delete(`${API_URL}${id}/`);
      fetchComponents();
    } catch (err) {
      console.error(err);
      alert("Chyba při mazání komponenty.");
    }
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        flexDirection={{ xs: 'column', sm: 'row' }}
        gap={{ xs: 1, sm: 2 }}
        mb={2}
      >
        <Typography variant="h4" component="h1">
          Inventory
        </Typography>
        <Button variant="contained" color="primary" href="/add" sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
          Add Component
        </Button>
      </Box>
      <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={2} mb={2}>
        <TextField
          label="Hledat komponenty..."
          variant="outlined"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FormControl sx={{ minWidth: { sm: 200 }, width: { xs: '100%', sm: 'auto' } }}>
          <InputLabel id="category-filter-label">Kategorie</InputLabel>
          <Select
            labelId="category-filter-label"
            value={categoryFilter}
            label="Kategorie"
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <MenuItem value=""><em>Všechny kategorie</em></MenuItem>
            {uniqueCategories.map(cat => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: { sm: 200 }, width: { xs: '100%', sm: 'auto' } }}>
          <InputLabel id="distributor-filter-label">Dodavatel</InputLabel>
          <Select
            labelId="distributor-filter-label"
            value={distributorFilter}
            label="Dodavatel"
            onChange={(e) => setDistributorFilter(e.target.value)}
          >
            <MenuItem value=""><em>Všichni dodavatelé</em></MenuItem>
            {uniqueDistributors.map(distributor => (
              <MenuItem key={distributor} value={distributor}>{distributor}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          onClick={() => {
            setCategoryFilter('');
            setDistributorFilter('');
          }}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Vyčistit filtry
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ width: '100%' }}>
        <Table sx={{ width: '100%', '& .MuiTableCell-root': { px: { xs: 0.75, sm: 2 } } }}>
          <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
            <TableRow>
              <TableCell />
              <TableCell>Komponenta</TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Kategorie</TableCell>
              <TableCell>Ks</TableCell>
              <TableCell align="center">Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredComponents.map((comp) => (
              <ExpandableRow key={comp.id} comp={comp} handleDelete={handleDelete} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default ComponentList;