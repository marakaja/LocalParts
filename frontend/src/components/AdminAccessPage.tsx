import React from 'react';
import { Container, Typography } from '@mui/material';
import { Navigate } from 'react-router-dom';
import AdminAccessCard from './AdminAccessCard';
import { useAuth } from '../context/AuthContext';

const AdminAccessPage: React.FC = () => {
  const { user } = useAuth();

  if (!user?.is_staff) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth={false} disableGutters sx={{ px: { xs: 1, sm: 2, md: 3 }, width: '100%' }}>
      <Typography variant="h4" component="h1" mb={2}>
        Správa účtů
      </Typography>
      <AdminAccessCard />
    </Container>
  );
};

export default AdminAccessPage;
