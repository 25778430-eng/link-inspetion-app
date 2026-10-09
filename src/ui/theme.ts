import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#0C0048',
  primarySoft: '#ECEAF6',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#B9B4DA',
  bg: '#F4F4F8',
  card: '#FFFFFF',
  text: '#120F2B',
  muted: '#6B6882',
  border: '#E3E1EE',
  pass: '#1B7F3B',
  passSoft: '#E5F4EA',
  fail: '#C62828',
  failSoft: '#FCE8E8',
  na: '#6B7280',
  naSoft: '#EEF0F3',
  warn: '#B26A00',
  warnSoft: '#FFF3E0',
};

export const STATUS_LABEL: Record<string, { label: string; color: string; soft: string }> = {
  serviceable: { label: 'Serviceable', color: colors.pass, soft: colors.passSoft },
  serviceable_with_defects: { label: 'With defects', color: colors.warn, soft: colors.warnSoft },
  locked_out: { label: 'Locked out', color: colors.fail, soft: colors.failSoft },
  out_of_service: { label: 'Out of service', color: colors.na, soft: colors.naSoft },
  unserviceable: { label: 'Unserviceable', color: colors.fail, soft: colors.failSoft },
};

const shadow = {
  shadowColor: '#0C0048',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 20, gap: 14 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 10, ...shadow },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '700', color: colors.text },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  body: { fontSize: 16, color: colors.text, lineHeight: 22 },
  muted: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, fontSize: 16, backgroundColor: '#FAFAFD', color: colors.text },
  button: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 17, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  error: { color: colors.fail, fontSize: 14, fontWeight: '600' },
});
