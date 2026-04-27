import React from 'react';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';
import { Box, Typography } from '@mui/material';

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: any) => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScanSuccess, onScanFailure }) => {
  return (
    <Box mt={2} mb={2}>
      <Typography variant="h6" align="center" gutterBottom>
        Scan Barcode/QR
      </Typography>
      <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto', overflow: 'hidden' }}>
        <BarcodeScannerComponent
          width="100%"
          height="100%"
          onUpdate={(err, result) => {
            if (result) {
              onScanSuccess(result.getText());
            } else if (err && onScanFailure) {
              onScanFailure(err);
            }
          }}
        />
      </div>
    </Box>
  );
};

export default Scanner;