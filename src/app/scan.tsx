import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { findAssetByCode } from '../db/local';
import { Button } from '../ui/components';
import { s } from '../ui/theme';

/** Asset QR codes hold the fleet number (or asset id). Manual entry covers damaged labels. */
export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  function open(value: string) {
    const asset = findAssetByCode(value);
    if (!asset) {
      setError(`No asset found for "${value}"`);
      handled.current = false;
      return;
    }
    router.replace(`/inspect/${asset.id}`);
  }

  return (
    <View style={s.screen}>
      {permission?.granted ? (
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128'] }}
          onBarcodeScanned={({ data }) => {
            if (handled.current) return;
            handled.current = true;
            open(data);
          }}
        />
      ) : (
        <View style={[s.pad, { flex: 1, justifyContent: 'center' }]}>
          <Text style={s.body}>Allow the camera to scan the asset's QR code.</Text>
          <Button title="Allow camera" onPress={requestPermission} />
        </View>
      )}
      <View style={s.pad}>
        <TextInput style={s.input} placeholder="Or type the fleet number" autoCapitalize="characters" value={code} onChangeText={setCode} />
        {error && <Text style={s.error}>{error}</Text>}
        <Button title="Open asset" onPress={() => open(code)} disabled={!code.trim()} />
      </View>
    </View>
  );
}
