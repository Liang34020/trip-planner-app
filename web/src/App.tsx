// src/App.tsx

import { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { useAppStore } from './store/appStore';

function App() {
  const loadMockData = useAppStore((state:any) => state.loadMockData);

  // 組件掛載時載入 Mock Data
  useEffect(() => {
    loadMockData();
  }, [loadMockData]);

  return <AppLayout />;
}

export default App;