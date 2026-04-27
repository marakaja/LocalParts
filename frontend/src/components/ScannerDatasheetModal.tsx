import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, CircularProgress, Box, Link } from '@mui/material';
import Scanner from './Scanner';
import axios from 'axios';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MemoryIcon from '@mui/icons-material/Memory';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';

interface ScannerModalProps {
  open: boolean;
  onClose: () => void;
}

interface ScanResultState {
  scannedCode: string;
  scannedQuantity: number;
  localComponent: any | null;
  mouserData: any | null;
}

const ScannerDatasheetModal: React.FC<ScannerModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResultState | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const parseScannedData = (decodedText: string) => {
    const gs = String.fromCharCode(29);
    const rs = String.fromCharCode(30);
    const eot = String.fromCharCode(4);

    let cleanedText = decodedText.replace(new RegExp(`[${rs}${eot}]+$`, 'g'), '');
    let parsedPartNumber = '';
    let parsedQuantity = 1;

    if (cleanedText.includes(gs)) {
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
          if (!isNaN(qVal) && qVal > 0) parsedQuantity = qVal;
        }
      });
    } else {
      parsedPartNumber = cleanedText.startsWith('1P') ? cleanedText.substring(2) : cleanedText;
    }

    return {
      cleanedText,
      parsedPartNumber: parsedPartNumber || cleanedText,
      parsedQuantity,
    };
  };

  const handleScanSuccess = async (decodedText: string) => {
    // Prevent multiple calls if already loading or resulted
    if (loading || scanResult) return;
    
    setLoading(true);
    setErrorMsg('');
    try {
      const parsed = parseScannedData(decodedText);
      let localComponent: any | null = null;
      const res = await axios.get(`/api/components/?barcode=${encodeURIComponent(decodedText)}`);
      if (res.data && res.data.length > 0) {
        localComponent = res.data[0];
      }

      let mouserData: any | null = null;
      const mouserSearchCandidates = [
        localComponent?.part_number,
        parsed.parsedPartNumber,
        parsed.cleanedText,
        decodedText,
      ].filter(Boolean) as string[];

      for (const candidate of Array.from(new Set(mouserSearchCandidates))) {
        try {
          const mouserRes = await axios.get(`/api/mouser-search/?part_number=${encodeURIComponent(candidate)}`);
          mouserData = mouserRes.data;
          break;
        } catch (mouserErr) {
          console.error(mouserErr);
        }
      }

      if (!localComponent && !mouserData) {
        setErrorMsg(`Komponenta s kódem "${decodedText}" nebyla nalezena.`);
        setTimeout(() => setErrorMsg(''), 3000);
      } else {
        setScanResult({
          scannedCode: decodedText,
          scannedQuantity: parsed.parsedQuantity,
          localComponent,
          mouserData,
        });
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Chyba při komunikaci se serverem.');
      setTimeout(() => setErrorMsg(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setErrorMsg('');
  };

  const getLocalStock = () => {
    if (scanResult?.localComponent) {
      return Number(scanResult.localComponent.quantity || 0);
    }
    if (scanResult?.mouserData) {
      return Number(scanResult.mouserData.local_stock || 0);
    }
    return 0;
  };

  const parseMouserStock = (value: string | undefined) => {
    return parseInt((value || '0').replace(/[^0-9]/g, ''), 10) || 0;
  };

  const handleAddToStock = () => {
    if (!scanResult?.mouserData) return;
    navigate('/add', {
      state: {
        prefill: {
          part_number: scanResult.mouserData.name || '',
          name: scanResult.mouserData.name || '',
          description: scanResult.mouserData.description || '',
          category: scanResult.mouserData.category || '',
          distributor: scanResult.mouserData.distributor || 'Mouser',
          datasheet_url: scanResult.mouserData.datasheet_url || '',
          barcode_data: scanResult.scannedCode,
          quantity: Math.max(1, Number(scanResult.scannedQuantity || 1)),
          parameters: scanResult.mouserData.full_specifications
            ? JSON.stringify(scanResult.mouserData.full_specifications, null, 2)
            : scanResult.mouserData.parameters
              ? JSON.stringify(scanResult.mouserData.parameters, null, 2)
              : '{}',
        },
      },
    });
    onClose();
    resetScanner();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Skenování komponenty</DialogTitle>
      <DialogContent>
        {!scanResult && !loading && (
          <>
            <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
              Namiřte kameru na čárový kód/QR kód pro zobrazení datasheetu nebo EDA modelu.
            </Typography>
            <Scanner onScanSuccess={handleScanSuccess} />
            {errorMsg && (
              <Typography color="error" align="center" variant="subtitle1" mt={2}>
                {errorMsg}
              </Typography>
            )}
          </>
        )}
        
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" p={4} flexDirection="column">
            <CircularProgress />
            <Typography mt={2}>Vyhledávám...</Typography>
          </Box>
        )}

        {scanResult && !loading && (
          <Box p={2} textAlign="center">
            <Typography variant="h6" gutterBottom>
              {scanResult.localComponent?.name || scanResult.mouserData?.name || 'Komponenta'}
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {scanResult.localComponent?.description || scanResult.mouserData?.description || '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Part number: {scanResult.localComponent?.part_number || scanResult.mouserData?.name || '-'}
            </Typography>

            <Box mt={1} display="flex" justifyContent="center" gap={1.5} flexWrap="wrap">
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Sklad u nás: {getLocalStock()} ks
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Sklad Mouser: {parseMouserStock(scanResult.mouserData?.mouser_stock)} ks
              </Typography>
            </Box>

            <Box mt={3} display="flex" gap={2} justifyContent="center" flexWrap="wrap">
              {(scanResult.localComponent?.datasheet_url || scanResult.mouserData?.datasheet_url) ? (
                <Button 
                  variant="contained" 
                  color="primary" 
                  startIcon={<PictureAsPdfIcon />}
                  href={scanResult.localComponent?.datasheet_url || scanResult.mouserData?.datasheet_url}
                  target="_blank"
                >
                  Datasheet
                </Button>
              ) : (
                <Typography color="text.secondary">Datasheet není k dispozici</Typography>
              )}

              {scanResult.localComponent?.eda_model_url ? (
                <Button 
                  component="a"
                  variant="outlined" 
                  color="secondary" 
                  startIcon={<MemoryIcon />}
                  href={scanResult.localComponent?.eda_model_url}
                  target="_blank"
                  download="EDA_model"
                >
                  EDA Model
                </Button>
              ) : (
                <Typography color="text.secondary">EDA Model není k dispozici</Typography>
              )}

              <Button
                component="a"
                variant="outlined"
                color="info"
                startIcon={<ShoppingCartIcon />}
                href={`https://cz.mouser.com/c/?q=${encodeURIComponent(scanResult.localComponent?.part_number || scanResult.mouserData?.name || '')}`}
                target="_blank"
                rel="noopener"
              >
                Mouser
              </Button>

              {scanResult.localComponent?.id && (
                <Button
                  component="a"
                  variant="contained"
                  color="secondary"
                  startIcon={<EditIcon />}
                  href={`/edit/${scanResult.localComponent?.id}`}
                >
                  Upravit komponentu
                </Button>
              )}

              {getLocalStock() <= 0 && scanResult.mouserData && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<AddIcon />}
                  onClick={handleAddToStock}
                >
                  Přidat komponentu na sklad
                </Button>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {scanResult && <Button onClick={resetScanner}>Skenovat další</Button>}
        <Button onClick={onClose} color="inherit">Zavřít</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScannerDatasheetModal;
