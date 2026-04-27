import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Container, Typography, TextField, Button, Box, Grid
} from '@mui/material';
import Scanner from './Scanner';

const API_URL = '/api/components/';

const ComponentForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScanning, setIsScanning] = useState(false);
  const [formData, setFormData] = useState<{
    part_number: string;
    name: string;
    description: string;
    category: string;
    quantity: number;
    location: string;
    distributor: string;
    barcode_data: string;
    datasheet_url: string;
    eda_model_url: string;
    parameters: string; // Keep as string for JSON editing text area
  }>({
    part_number: '',
    name: '',
    description: '',
    category: '',
    quantity: 0,
    location: '',
    distributor: '',
    barcode_data: '',
    datasheet_url: '',
    eda_model_url: '',
    parameters: '{}'
  });

  useEffect(() => {
    if (id) {
      axios.get(`${API_URL}${id}/`).then(response => {
        const data = response.data;
        setFormData({
          ...data,
          parameters: typeof data.parameters === 'object' ? JSON.stringify(data.parameters, null, 2) : (data.parameters || '{}')
        });
      }).catch(error => {
        console.error("Error fetching component details:", error);
      });
      return;
    }

    const prefill = (location.state as any)?.prefill;
    if (prefill) {
      setFormData((prev) => ({
        ...prev,
        ...prefill,
        parameters: typeof prefill.parameters === 'string'
          ? prefill.parameters
          : JSON.stringify(prefill.parameters || {}, null, 2),
      }));
    }
  }, [id, location.state]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let parametersParsed = {};
    try {
      parametersParsed = JSON.parse(formData.parameters || '{}');
    } catch {
      alert("Parametry musí být platný JSON (např. { \"tolerance\": \"5%\" }).");
      return;
    }

    try {
      const payload = { ...formData, parameters: parametersParsed };
      if (id) {
        await axios.put(`${API_URL}${id}/`, payload);
      } else {
        await axios.post(API_URL, payload);
      }
      navigate('/');
    } catch (error) {
      console.error("Error saving component:", error);
      alert("Chyba při ukládání komponenty.");
    }
  };

  const fetchMouserDataForPart = async (partNumber: string) => {
    if (!partNumber) return;
    try {
      const response = await axios.get(`/api/mouser-search/?part_number=${encodeURIComponent(partNumber)}`);
      setFormData(prev => ({
        ...prev,
        name: response.data.name || prev.name,
        description: response.data.description || prev.description,
        category: response.data.category || prev.category,
        distributor: response.data.distributor || prev.distributor,
        datasheet_url: response.data.datasheet_url || prev.datasheet_url,
        parameters: response.data.full_specifications
          ? JSON.stringify(response.data.full_specifications, null, 2)
          : response.data.parameters
            ? JSON.stringify(response.data.parameters, null, 2)
            : prev.parameters
      }));
    } catch (error) {
      console.error("Failed to fetch from Mouser", error);
      alert("Part not found on Mouser or API error.");
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    let parsedPartNumber = '';
    let parsedQuantity = formData.quantity;
    
    // Standard delimiters in 2D barcodes
    const gs = String.fromCharCode(29); // Group Separator
    const rs = String.fromCharCode(30); // Record Separator
    const eot = String.fromCharCode(4); // End of Transmission
    
    // Remove trailing control characters
    let cleanedText = decodedText.replace(new RegExp(`[${rs}${eot}]+$`, 'g'), '');

    // Check if it has GS delimiters marking multiple fields
    if (cleanedText.includes(gs)) {
      // Optional: Handle macro PDF417 header [)>RS06GS
      if (cleanedText.startsWith('[)>')) {
        const headerIndex = cleanedText.indexOf(gs);
        if (headerIndex !== -1) cleanedText = cleanedText.substring(headerIndex + 1);
      }
      
      const segments = cleanedText.split(gs);
      segments.forEach(segment => {
        if (segment.startsWith('1P')) {
          parsedPartNumber = segment.substring(2);
        } else if (segment.startsWith('P') && !parsedPartNumber) {
          parsedPartNumber = segment.substring(1);
        } else if (segment.startsWith('Q')) {
          const qVal = parseInt(segment.substring(1), 10);
          if (!isNaN(qVal)) parsedQuantity = qVal;
        }
      });
    } else {
      // Fallback for simple 1D barcodes
      if (cleanedText.startsWith('1P')) {
        parsedPartNumber = cleanedText.substring(2);
      } else {
        parsedPartNumber = cleanedText;
      }
    }

    setFormData(prev => ({
      ...prev,
      part_number: parsedPartNumber || prev.part_number,
      quantity: parsedQuantity,
      barcode_data: decodedText
    }));
    const partToLookup = parsedPartNumber || decodedText;
    await fetchMouserDataForPart(partToLookup);
    setIsScanning(false);
  };

  const fetchMouserData = async () => {
    if (!formData.part_number) {
      alert("Please enter a part number first.");
      return;
    }
    await fetchMouserDataForPart(formData.part_number);
  };

  return (
    <Container>
      <Typography variant="h4" component="h1" gutterBottom>
        {id ? 'Edit Component' : 'Add Component'}
      </Typography>

      <Box display="flex" gap={2} mb={2}>
        <Button variant="outlined" color="secondary" onClick={() => setIsScanning(!isScanning)}>
          {isScanning ? 'Close Scanner' : 'Scan Barcode'}
        </Button>
        <Button variant="outlined" color="info" onClick={fetchMouserData}>
          Autofill from Mouser
        </Button>
      </Box>

      {isScanning && (
        <Scanner onScanSuccess={handleScanSuccess} />
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField label="Part Number" name="part_number" value={formData.part_number} onChange={handleChange} fullWidth required />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Name" name="name" value={formData.name} onChange={handleChange} fullWidth required />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Kategorie" name="category" value={formData.category} onChange={handleChange} fullWidth placeholder="Např. kondenzátor..." />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Popis" name="description" value={formData.description} onChange={handleChange} fullWidth multiline rows={2} />
          </Grid>
          <Grid item xs={12} sm={12}>
            <TextField
              label="Parametry (JSON)"
              name="parameters"
              value={formData.parameters}
              onChange={handleChange}
              fullWidth
              multiline
              rows={10}
              placeholder='{ "Value": "10k", "Tolerance": "5%" }'
              helperText="Musí být validní JSON formát. Při načtení z Mouseru se ukládají kompletní specifikace."
              InputProps={{ sx: { fontFamily: 'monospace' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Množství" name="quantity" type="number" value={formData.quantity} onChange={handleChange} fullWidth required />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Lokace" name="location" value={formData.location} onChange={handleChange} fullWidth />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Distributor" name="distributor" value={formData.distributor} onChange={handleChange} fullWidth />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Kód (Barcode)" name="barcode_data" value={formData.barcode_data} onChange={handleChange} fullWidth />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Datasheet URL" name="datasheet_url" type="url" value={formData.datasheet_url} onChange={handleChange} fullWidth />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="EDA Odkaz URL (CAD models)" name="eda_model_url" type="url" value={formData.eda_model_url} onChange={handleChange} fullWidth />
          </Grid>
        </Grid>
        <Box mt={3} display="flex" justifyContent="space-between">
          <Button variant="contained" color="primary" type="submit">
            Save
          </Button>
          <Button variant="text" color="inherit" onClick={() => navigate('/')}>
            Cancel
          </Button>
        </Box>
      </form>
    </Container>
  );
};

export default ComponentForm;