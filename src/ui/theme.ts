import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#14202B',
  muted: '#5B6B78',
  border: '#D5DCE2',
  primary: '#0B4F8A',
  pass: '#1E7B34',
  fail: '#C62828',
  na: '#6B7280',
  warn: '#B26A00',
};

export const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  serviceable: { label: 'Serviceable', color: colors.pass },
  serviceable_with_defects: { label: 'Serviceable with defects', color: colors.warn },
  locked_out: { label: 'LOCKED OUT', color: colors.fail },
  out_of_service: { label: 'Out of service', color: colors.na },
  unserviceable: { label: 'Unserviceable', color: colors.fail },
};

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 16, gap: 12 },
  card: { backgroundColor: colors.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 },
  h1: { fontSize: 22, fontWeight: '700', color: colors.text },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff', color: colors.text },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 16, paddingHorizontal: 18, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  error: { color: colors.fail, fontSize: 14 },
});
