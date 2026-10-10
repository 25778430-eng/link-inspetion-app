import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { findAssetByCode } from '../../db/local';
import { Button, ScreenHeader } from '../../ui/components';
import { useTheme } from '../../ui/theme';

/** Asset QR codes hold the asset ID (or fleet number). Typing the fleet number covers damaged labels. */
export default function Scan() {
  const { c, s } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const handled = useRef(false);

  // Only run the camera while this tab is on screen.
  useFocusEffect(
    useCallback(() => {
      handled.current = false;
      setActive(true);
      return () => setActive(false);
    }, []),
  );

  function open(value: string) {
    // Labels may carry a prefix, e.g. "LNKA:<asset id>".
    const asset = findAssetByCode(value.replace(/^LNKA:/, '')) ?? findAssetByCode(value);
    if (!asset) {
      setError(`No asset found for "${value}"`);
      handled.current = false;
      return;
    }
    setError(null);
    setCode('');
    router.push(`/inspect/${asset.id}`);
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader>
        <Text style={s.headerTitle}>Scan asset</Text>
        <Text style={s.headerSub}>Point the camera at the QR label on the equipment</Text>
      </ScreenHeader>
      <View style={{ flex: 1, margin: 20, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000' }}>
        {permission?.granted ? (
          active && (
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128'] }}
              onBarcodeScanned={({ data }) => {
                if (handled.current) return;
                handled.current = true;
                open(data);
              }}
            />
          )
        ) : (
          <View style={[s.pad, { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.card }]}>
            <Ionicons name="camera-outline" size={40} color={c.link} />
            <Text style={[s.body, { textAlign: 'center' }]}>Allow the camera to scan the asset's QR label.</Text>
            <Button title="Allow camera" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
          </View>
        )}
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 10 }}>
        <Text style={s.fieldLabel}>No label or no signal? Type the fleet number</Text>
        <View style={s.row}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="e.g. TT-014"
            placeholderTextColor={c.faint}
            autoCapitalize="characters"
            value={code}
            onChangeText={setCode}
            onSubmitEditing={() => code.trim() && open(code)}
          />
          <Button title="Open" onPress={() => open(code)} disabled={!code.trim()} style={{ minHeight: 52 }} />
        </View>
        {error && <Text style={s.error}>{error}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}
