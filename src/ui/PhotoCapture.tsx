import { CameraView, useCameraPermissions } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { Button } from './components';
import { useTheme } from './theme';

/**
 * In-app camera only: evidence photos cannot be picked from the gallery.
 * Photos are moved into the app's document folder so they survive until uploaded.
 */
export function PhotoCapture({ visible, onClose, onCaptured }: { visible: boolean; onClose: () => void; onCaptured: (uri: string) => void }) {
  const { c, s } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  async function take() {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.5, exif: true });
      const dir = new Directory(Paths.document, 'photos');
      if (!dir.exists) dir.create({ intermediates: true });
      const dest = new File(dir, `${randomUUID()}.jpg`);
      new File(pic.uri).moveSync(dest);
      onCaptured(dest.uri);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {!permission?.granted ? (
          <View style={[s.pad, { flex: 1, justifyContent: 'center' }]}>
            <Text style={[s.body, { color: '#fff' }]}>Camera access is needed to photograph the fault.</Text>
            <Button title="Allow camera" onPress={requestPermission} />
            <Button title="Cancel" color={c.na} onPress={onClose} />
          </View>
        ) : (
          <>
            <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
            <View style={[s.pad, s.row, { justifyContent: 'space-between' }]}>
              <Button title="Cancel" color={c.na} onPress={onClose} style={{ flex: 1 }} />
              <Button title={busy ? 'Saving…' : 'Take photo'} onPress={take} disabled={busy} style={{ flex: 2 }} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
