import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Grid,
  IconButton,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from '../context/AuthContext';

interface UserAccount {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

const AdminAccessCard: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createData, setCreateData] = useState({
    username: '',
    email: '',
    password: '',
    is_staff: false,
    is_active: true,
  });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiConfigured, setApiConfigured] = useState(false);
  const [apiUpdatedAt, setApiUpdatedAt] = useState<string>('');

  const isAdmin = useMemo(() => !!user?.is_staff, [user]);

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/users/');
      setUsers(response.data);
    } catch {
      setError('Nepodařilo se načíst uživatelské účty.');
    } finally {
      setLoading(false);
    }
  };

  const fetchApiKeyStatus = async () => {
    if (!isAdmin) return;
    try {
      const response = await axios.get('/api/mouser-api-key/');
      setApiConfigured(Boolean(response.data?.configured));
      setApiUpdatedAt(response.data?.updated_at || '');
    } catch {
      setError('Nepodařilo se načíst stav API klíče.');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchApiKeyStatus();
  }, [isAdmin]);

  const handleSaveApiKey = async () => {
    try {
      await axios.put('/api/mouser-api-key/', { api_key: apiKeyInput.trim() });
      setApiKeyInput('');
      fetchApiKeyStatus();
    } catch {
      setError('Uložení API klíče se nepodařilo.');
    }
  };

  const handleCreateUser = async () => {
    if (!createData.username.trim() || !createData.password.trim()) {
      setError('U nového účtu je povinné uživatelské jméno i heslo.');
      return;
    }

    try {
      await axios.post('/api/users/', createData);
      setCreateData({ username: '', email: '', password: '', is_staff: false, is_active: true });
      fetchUsers();
    } catch {
      setError('Vytvoření účtu selhalo. Zkontrolujte unikátnost uživatelského jména.');
    }
  };

  const handleToggle = async (account: UserAccount, field: 'is_staff' | 'is_active') => {
    try {
      await axios.patch(`/api/users/${account.id}/`, {
        [field]: !account[field],
      });
      fetchUsers();
    } catch {
      setError('Aktualizace přístupů selhala.');
    }
  };

  const handleDelete = async (account: UserAccount) => {
    if (account.username === user?.username) {
      setError('Nelze smazat právě přihlášený účet.');
      return;
    }
    if (!window.confirm(`Opravdu smazat účet ${account.username}?`)) return;

    try {
      await axios.delete(`/api/users/${account.id}/`);
      fetchUsers();
    } catch {
      setError('Smazání účtu se nepodařilo.');
    }
  };

  if (!isAdmin) return null;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Správa účtů a přístupů
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Tato karta je viditelná jen pro admin účet. Můžete vytvářet uživatele a měnit jejich oprávnění.
        </Typography>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 1.5,
            mb: 2,
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Mouser API klíč
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={1}>
            Klíč se ukládá pouze na backendu a ve frontendu se nikdy nezobrazuje celý.
          </Typography>
          <Box display="flex" gap={1} flexDirection={{ xs: 'column', md: 'row' }}>
            <TextField
              type="password"
              size="small"
              fullWidth
              label="Nový API klíč"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
            />
            <Button variant="contained" onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()}>
              Uložit klíč
            </Button>
          </Box>
          <Box mt={1} display="flex" gap={1} flexWrap="wrap">
            <Chip size="small" color={apiConfigured ? 'success' : 'default'} label={apiConfigured ? 'Klíč nastaven' : 'Klíč nenastaven'} />
            {apiUpdatedAt && (
              <Chip size="small" variant="outlined" label={`Aktualizace: ${new Date(apiUpdatedAt).toLocaleString('cs-CZ')}`} />
            )}
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={1.5} mb={2}>
          <Grid item xs={12} md={3}>
            <TextField
              label="Uživatelské jméno"
              fullWidth
              size="small"
              value={createData.username}
              onChange={(e) => setCreateData((prev) => ({ ...prev, username: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Email"
              fullWidth
              size="small"
              value={createData.email}
              onChange={(e) => setCreateData((prev) => ({ ...prev, email: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Heslo"
              type="password"
              fullWidth
              size="small"
              value={createData.password}
              onChange={(e) => setCreateData((prev) => ({ ...prev, password: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Box display="flex" alignItems="center" height="100%" gap={1}>
              <FormControlLabel
                control={<Switch checked={createData.is_staff} onChange={(e) => setCreateData((prev) => ({ ...prev, is_staff: e.target.checked }))} />}
                label="Admin"
              />
              <Button variant="contained" onClick={handleCreateUser}>Vytvořit</Button>
            </Box>
          </Grid>
        </Grid>

        <Box display="flex" flexDirection="column" gap={1}>
          {users.map((account) => (
            <Box
              key={account.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: { xs: 'flex-start', md: 'center' },
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Box>
                <Typography fontWeight={700}>{account.username}</Typography>
                <Typography variant="body2" color="text.secondary">{account.email || 'bez emailu'}</Typography>
                <Box mt={0.5} display="flex" gap={0.5}>
                  <Chip size="small" label={account.is_active ? 'Aktivní' : 'Neaktivní'} color={account.is_active ? 'success' : 'default'} />
                  <Chip size="small" label={account.is_staff ? 'Admin' : 'Uživatel'} color={account.is_staff ? 'warning' : 'info'} />
                </Box>
              </Box>

              <Box display="flex" alignItems="center" gap={1}>
                <FormControlLabel
                  control={<Switch checked={account.is_active} onChange={() => handleToggle(account, 'is_active')} />}
                  label="Aktivní"
                />
                <FormControlLabel
                  control={<Switch checked={account.is_staff} onChange={() => handleToggle(account, 'is_staff')} />}
                  label="Admin"
                />
                <IconButton color="error" onClick={() => handleDelete(account)}>
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>

        {loading && <Typography variant="body2" color="text.secondary" mt={1}>Načítám účty...</Typography>}
      </CardContent>
    </Card>
  );
};

export default AdminAccessCard;
