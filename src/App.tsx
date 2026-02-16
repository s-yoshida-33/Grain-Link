import React from 'react';
import { GidoApp } from './screens/GidoApp';
import { ContextMenu } from './components/ContextMenu';

const App: React.FC = () => {
  return (
    <ContextMenu>
      <GidoApp />
    </ContextMenu>
  );
};

export default App;
