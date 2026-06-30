import React from 'react';
import { GidoApp } from './screens/GidoApp';
import { ContextMenu } from './components/ContextMenu';
import { ScreenSleep } from './components/ScreenSleep';
import { useHeartbeat } from './hooks/useHeartbeat';

const App: React.FC = () => {
  useHeartbeat();

  return (
    <ContextMenu>
      <GidoApp />
      <ScreenSleep />
    </ContextMenu>
  );
};

export default App;
