const fs = require('fs');
let code = fs.readFileSync('src/components/OrderBuilder.tsx', 'utf8');

code = code.replace(
  'const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);',
  'const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);\n  const [isSaving, setIsSaving] = useState(false);\n  const [needsSave, setNeedsSave] = useState(false);'
);

code = code.replace(
  '  useEffect(() => {\n    if (id && id !== \'new\') {\n      loadOrder(id);\n    }\n  }, [id]);',
  \  useEffect(() => {
    if (id && id !== 'new') {
      loadOrder(id);
    }
  }, [id]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSaving || needsSave) {
        e.preventDefault();
        e.returnValue = 'Máte neuložené zmìny, opravdu chcete odejít?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaving, needsSave]);

  useEffect(() => {
    if (!orderLoading && !isCompleted && needsSave) {
      const delaySave = setTimeout(() => {
        autoSaveOrder(false);
      }, 1500); // 1.5s debounce
      return () => clearTimeout(delaySave);
    }
  }, [orderName, orderItems, needsSave, isCompleted]);
\
);

code = code.replace(
  /const updateQuantity = \[\\s\\S\]*?setOrderItems\\(newItems\\);\\s*};/,
  \const updateQuantity = (index: number, newQty: number) => {
    if (isCompleted) return;
    const newItems = [...orderItems];
    newItems[index].quantity = newQty;
    newItems[index].currentPrice = calculatePrice(newQty, newItems[index].priceBreaks);
    setOrderItems(newItems);
    setNeedsSave(true);
  };\);

code = code.replace(
  /const removeRow = \[\\s\\S\]*?setOrderItems\\(orderItems\\.filter[\\s\\S]*?\\};/,
  \const removeRow = (index: number) => {
    if (isCompleted) return;
    setOrderItems(orderItems.filter((_, i) => i !== index));
    setNeedsSave(true);
  };\
);

code = code.replace(
  /setOrderItems\\(prev => \\[\.\.\.prev, newItem\\]\\);\\s*setSearchInput\\('\'\\);/g,
  \setOrderItems(prev => [...prev, newItem]);
      setSearchInput('');
      setNeedsSave(true);\
);

code = code.replace(
  /const handleSaveOrder = async \\(markCompleted: boolean = false\\) => \\{[\\s\\S]*?catch \\(err\\) \\{[\\s\\S]*?\\}\\s*\\};/,
  \const autoSaveOrder = async (markCompleted: boolean = false) => {
    if (!orderName.trim()) {
      return; // Do not auto-save without a name
    }
    
    setIsSaving(true);
    try {
      const payload = {
        name: orderName,
        is_completed: isCompleted || markCompleted,
        items: orderItems.map(i => ({
          part_number: i.mfgPart,
          quantity: i.quantity
        }))
      };
      
      if (id && id !== 'new') {
        await axios.put(\\\/api/orders/\\\/\\\, payload);
      } else {
        const res = await axios.post('/api/orders/', payload);
        navigate(\/order/\\\\, { replace: true });
      }
      
      if (markCompleted) setIsCompleted(true);
      setNeedsSave(false);
      setSavedStatus({ open: true, message: 'Automaticky uloženo.', severity: 'success' });
    } catch (err) {
      console.error(err);
      setSavedStatus({ open: true, message: 'Chyba pøi ukládání objednávky.', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Re-map handleSaveOrder for the explicit completion button
  const handleSaveOrder = async (markCompleted: boolean = false) => {
    if (!orderName.trim()) {
      alert('Zadejte prosím název objednávky pøed uložením.');
      return;
    }
    await autoSaveOrder(markCompleted);
  };
\
);

code = code.replace(
  'onChange={(e) => setOrderName(e.target.value)}',
  'onChange={(e) => { setOrderName(e.target.value); setNeedsSave(true); }}'
);

code = code.replace(
  '<Button variant="outlined" color="secondary" startIcon={<SaveIcon />} onClick={() => handleSaveOrder(false)}>\n                   Uložit do DB\n                 </Button>',
  '{isSaving && <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>Ukládám...</Typography>}'
);

fs.writeFileSync('src/components/OrderBuilder.tsx', code, 'utf8');
