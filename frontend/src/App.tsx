import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { 
  ThemeProvider, createTheme, CssBaseline, AppBar, Toolbar, 
  Typography, Container, IconButton, Drawer, List, 
  ListItem, ListItemIcon, ListItemText, ListItemButton, Box 
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LogoutIcon from '@mui/icons-material/Logout';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

import ComponentList from './components/ComponentList';
import ComponentForm from './components/ComponentForm';
import OrderBuilder from './components/OrderBuilder';
import OrdersList from './components/OrdersList';
import Login from './components/Login';
import ScannerDatasheetModal from './components/ScannerDatasheetModal';
import AdminAccessPage from './components/AdminAccessPage';
import { AuthProvider, useAuth } from './context/AuthContext';

const theme = createTheme({
  palette: {
    primary: { main: '#0d47a1', contrastText: '#fff' },
    secondary: { main: '#ff9100' },
    background: { default: '#f4f6f8' },
  },
  typography: { fontFamily: 'Roboto, sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiContainer: {
      styleOverrides: {
        root: {
          paddingLeft: 16,
          paddingRight: 16,
          '@media (max-width:600px)': {
            paddingLeft: 0,
            paddingRight: 0,
          },
        },
      },
    }
  }
});

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const NavigationLayout = ({ children }: { children: JSX.Element }) => {
  const { logout, user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' || (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    setDrawerOpen(open);
  };

  const DrawerList = (
    <Box sx={{ width: 250 }} role="presentation" onClick={toggleDrawer(false)} onKeyDown={toggleDrawer(false)}>
      <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <Typography variant="h6" noWrap component="div">
          LAB Menu
        </Typography>
      </Box>
      <List>
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/">
            <ListItemIcon><Inventory2Icon /></ListItemIcon>
            <ListItemText primary="Sklad" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/orders">
            <ListItemIcon><ShoppingCartIcon /></ListItemIcon>
            <ListItemText primary="Objednávky" />
          </ListItemButton>
        </ListItem>
        {user?.is_staff && (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/admin-access">
              <ListItemIcon><AdminPanelSettingsIcon /></ListItemIcon>
              <ListItemText primary="Správa účtů" />
            </ListItemButton>
          </ListItem>
        )}
        <ListItem disablePadding>
          <ListItemButton onClick={(e) => { toggleDrawer(false)(e); setScannerOpen(true); }}>
            <ListItemIcon><QrCodeScannerIcon /></ListItemIcon>
            <ListItemText primary="Skenovat datasheet" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={logout}>
            <ListItemIcon><LogoutIcon color="error" /></ListItemIcon>
            <ListItemText primary="Odhlásit se" sx={{ color: 'error.main' }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="sticky" color="primary" sx={{ mb: 2 }}>
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
            onClick={toggleDrawer(true)}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            LAB Inventář
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer(false)}>
        {DrawerList}
      </Drawer>

      <ScannerDatasheetModal open={scannerOpen} onClose={() => setScannerOpen(false)} />

      <Container disableGutters maxWidth="xl">
        {children}
      </Container>
    </>
  );
};

function AppRoutes() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!token ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <NavigationLayout>
            <Routes>
              <Route path='/' element={<ComponentList />} />
              <Route path='/add' element={<ComponentForm />} />
              <Route path='/edit/:id' element={<ComponentForm />} />
              <Route path='/orders' element={<OrdersList />} />
              <Route path='/admin-access' element={<AdminAccessPage />} />
              <Route path='/order/new' element={<OrderBuilder />} />
              <Route path='/order/:id' element={<OrderBuilder />} />
            </Routes>
          </NavigationLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
