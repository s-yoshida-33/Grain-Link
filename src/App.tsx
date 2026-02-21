import React from 'react';
import { GidoApp } from './screens/GidoApp';
import { ContextMenu } from './components/ContextMenu';
import { useHeartbeat } from './hooks/useHeartbeat';

const App: React.FC = () => {
  useHeartbeat();

  return (
    <ContextMenu>
      <GidoApp />
    </ContextMenu>
  );
};

export default App;
