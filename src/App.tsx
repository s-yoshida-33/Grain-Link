import React, { useState } from 'react';
import { GidoApp } from './screens/GidoApp';
import { ContextMenu } from './components/ContextMenu';
import { UpdateDialog } from './components/UpdateDialog';
import { useAutoUpdate } from './hooks/useAutoUpdate';

const App: React.FC = () => {
  const { updateStatus, installUpdate, isUpdateAvailable, isUpdateReady } = useAutoUpdate();
  const [showDialog, setShowDialog] = useState(false);

  // アップデート状態が変更されたら、ダイアログを表示
  React.useEffect(() => {
    if (isUpdateAvailable || isUpdateReady || updateStatus.status === 'downloading' || updateStatus.status === 'error') {
      setShowDialog(true);
    }
  }, [isUpdateAvailable, isUpdateReady, updateStatus.status]);

  return (
    <ContextMenu>
      <GidoApp />
      <UpdateDialog
        isOpen={showDialog}
        status={updateStatus.status}
        progress={updateStatus.progress}
        message={updateStatus.message}
        onInstall={installUpdate}
        onDismiss={() => setShowDialog(false)}
      />
    </ContextMenu>
  );
};

export default App;
