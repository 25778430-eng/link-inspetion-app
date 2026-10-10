import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Image, Pressable, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const logo = require('../../assets/logo.png');

export function Button(props: {
  title: string;
  onPress: () => void;
  color?: string;
  variant?: 'solid' | 'outline' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const { c, s } = useTheme();
  const color = props.color ?? c.primary;
  const variant = props.variant ?? 'solid';
  const fg = variant === 'solid' ? c.onPrimary : variant === 'outline' && !props.color ? c.link : color;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [
        s.button,
        variant === 'solid' && { backgroundColor: color },
        variant === 'outline' && { backgroundColor: c.card, borderWidth: 1.5, borderColor: fg },
        variant === 'ghost' && { minHeight: 44 },
        { opacity: props.disabled ? 0.4 : pressed ? 0.85 : 1 },
        props.style,
      ]}
    >
      {props.icon && <Ionicons name={props.icon} size={20} color={fg} />}
      <Text style={[s.buttonText, { color: fg }, variant === 'ghost' && { fontSize: 15 }]}>{props.title}</Text>
    </Pressable>
  );
}

/** Soft pill: tinted background with coloured text. */
export function Badge({ label, color, soft }: { label: string; color: string; soft: string }) {
  const { s } = useTheme();
  return (
    <View style={[s.badge, { backgroundColor: soft }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | (ViewStyle | false | undefined)[] }) {
  const { s } = useTheme();
  return <View style={[s.card, style]}>{children}</View>;
}

/** The rounded navy header that tops every main screen. */
export function ScreenHeader({ children, color, style }: { children: ReactNode; color?: string; style?: ViewStyle }) {
  const { s, c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 16 }, color && { backgroundColor: color }, dark && !color && { borderBottomWidth: 1, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

/** Round outlined icon button used inside the navy header (back, settings). */
export function HeaderIcon({ name, onPress, label }: { name: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
      })}
    >
      <Ionicons name={name} size={22} color="#FFFFFF" />
    </Pressable>
  );
}

export function Logo({ size = 44 }: { size?: number }) {
  return <Image source={logo} accessibilityLabel="Airlink" style={{ width: size, height: size, borderRadius: size * 0.22 }} />;
}

/** Stat tile on the navy header. */
export function Stat({ value, label, color, suffix }: { value: number | string; label: string; color?: string; suffix?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, gap: 2 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: color ?? '#FFFFFF' }}>
        {value}
        {suffix && <Text style={{ fontFamily: fonts.light, fontSize: 16, color: c.onPrimaryMuted }}>{suffix}</Text>}
      </Text>
      <Text style={{ fontFamily: fonts.light, fontSize: 13, color: c.onPrimaryMuted }}>{label}</Text>
    </View>
  );
}

/** Segmented control. `onNavy` styles it for the header. */
export function Segmented<T extends string>({ options, value, onChange, onNavy }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; onNavy?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: onNavy ? 'rgba(255,255,255,0.1)' : c.segment, borderRadius: 14, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        const bg = on ? (onNavy ? '#FFFFFF' : c.primary) : 'transparent';
        const fg = on ? (onNavy ? '#0C0048' : c.onPrimary) : onNavy ? '#FFFFFF' : c.link;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: fg }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Square photo placeholder or thumbnail. */
export function Thumb({ uri, size = 64 }: { uri?: string; size?: number }) {
  const { c } = useTheme();
  if (uri && /^(file|https?):/.test(uri)) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 12 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="image-outline" size={22} color={c.link} />
    </View>
  );
}
