// src/App.tsx

import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from './components/layout/AppLayout';
import { useAppStore } from './store/appStore';

function App() {
  const loadMockData = useAppStore(state => state.loadMockData);

  // 組件掛載時載入 Mock Data
  useEffect(() => {
    loadMockData();
  }, [loadMockData]);

  return (
    <>
      <AppLayout />
      <Toaster />
    </>
  );
}

export default App;