import { StyleSheet, useColorScheme } from 'react-native';

/** Lato in three weights only (brand rule): Light for captions, Regular for body, Bold for titles and actions. */
export const fonts = {
  light: 'Lato_300Light',
  regular: 'Lato_400Regular',
  bold: 'Lato_700Bold',
};

/** Navy (#0C0048) carries the brand; green, amber and red appear only for status. */
const light = {
  brand: '#0C0048',
  primary: '#0C0048',
  primarySoft: '#ECEAF6',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#C9C5E6',
  link: '#0C0048',
  bg: '#F4F4F8',
  card: '#FFFFFF',
  input: '#FAFAFD',
  text: '#120F2B',
  textSoft: '#4A4763',
  muted: '#6B6882',
  faint: '#8A87A0',
  border: '#E3E1EE',
  segment: '#E6E4F3',
  pass: '#17692F',
  passText: '#17692F',
  passSoft: '#E5F4EA',
  fail: '#B42020',
  failText: '#B42020',
  failSoft: '#FCE8E8',
  failBorder: '#F2B8B8',
  locked: '#8E1616',
  na: '#5B5970',
  naSoft: '#EEEDF3',
  warn: '#B26A00',
  warnText: '#7A4800',
  warnSoft: '#FFF3E0',
  highlight: '#8F86FF',
};

export type Palette = typeof light;

const dark: Palette = {
  brand: '#0C0048',
  primary: '#3B2FC9',
  primarySoft: '#241E55',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#C9C5E6',
  link: '#B9B2FF',
  bg: '#07041F',
  card: '#15112F',
  input: '#0E0A27',
  text: '#F1F0F8',
  textSoft: '#C4C1DA',
  muted: '#9C98B8',
  faint: '#7D7999',
  border: '#2C2754',
  segment: '#1B1640',
  pass: '#17692F',
  passText: '#5FD38A',
  passSoft: '#0F2E1A',
  fail: '#B42020',
  failText: '#FF8A8A',
  failSoft: '#3A1218',
  failBorder: '#6B2028',
  locked: '#8E1616',
  na: '#5B5970',
  naSoft: '#221E3D',
  warn: '#B26A00',
  warnText: '#FFB547',
  warnSoft: '#33230A',
  highlight: '#8F86FF',
};

function makeStyles(c: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    pad: { padding: 20, gap: 14 },
    card: { backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border, gap: 10 },
    h1: { fontFamily: fonts.bold, fontSize: 26, color: c.text },
    h2: { fontFamily: fonts.bold, fontSize: 18, color: c.text },
    h3: { fontFamily: fonts.bold, fontSize: 16, color: c.text },
    label: { fontFamily: fonts.bold, fontSize: 12, color: c.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
    body: { fontFamily: fonts.regular, fontSize: 16, color: c.text, lineHeight: 22 },
    soft: { fontFamily: fonts.regular, fontSize: 14, color: c.textSoft, lineHeight: 20 },
    caption: { fontFamily: fonts.light, fontSize: 13, color: c.muted, lineHeight: 18 },
    fieldLabel: { fontFamily: fonts.bold, fontSize: 13, color: c.textSoft },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      fontSize: 16,
      fontFamily: fonts.regular,
      backgroundColor: c.input,
      color: c.text,
    },
    button: { borderRadius: 16, minHeight: 56, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    buttonText: { fontFamily: fonts.bold, fontSize: 17 },
    row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
    badgeText: { fontFamily: fonts.bold, fontSize: 12 },
    error: { fontFamily: fonts.bold, color: c.failText, fontSize: 14 },
    header: { backgroundColor: c.brand, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, gap: 18 },
    headerTitle: { fontFamily: fonts.bold, fontSize: 22, color: '#FFFFFF' },
    headerSub: { fontFamily: fonts.light, fontSize: 14, color: c.onPrimaryMuted },
  });
}

const themes = {
  light: { c: light, s: makeStyles(light), dark: false },
  dark: { c: dark, s: makeStyles(dark), dark: true },
};

export type Theme = (typeof themes)['light'];

/** Follows the phone's light or dark setting. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? themes.dark : themes.light;
}

export function statusStyle(c: Palette, status: string): { label: string; color: string; soft: string } {
  switch (status) {
    case 'serviceable':
      return { label: 'Serviceable', color: c.passText, soft: c.passSoft };
    case 'serviceable_with_defects':
      return { label: 'With defects', color: c.warnText, soft: c.warnSoft };
    case 'locked_out':
      return { label: 'Locked out', color: c.failText, soft: c.failSoft };
    case 'unserviceable':
      return { label: 'Unserviceable', color: c.failText, soft: c.failSoft };
    default:
      return { label: 'Out of service', color: c.muted, soft: c.naSoft };
  }
}
