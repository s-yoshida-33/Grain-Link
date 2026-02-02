import React from 'react';

const App: React.FC = () => {
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Grain Link</h1>
      <p>Status: Running</p>
      <div style={{ marginTop: 20, border: '1px solid #ccc', padding: 10 }}>
        <h2>Features</h2>
        <ul>
          <li>Local Media Loop Playback (TODO)</li>
          <li>Shop API Integration (TODO)</li>
        </ul>
      </div>
    </div>
  );
};

export default App;
