import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { colors, s } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Button(props: {
  title: string;
  onPress: () => void;
  color?: string;
  variant?: 'solid' | 'outline';
  icon?: IconName;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const color = props.color ?? colors.primary;
  const outline = props.variant === 'outline';
  const fg = outline ? color : colors.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [
        s.button,
        outline ? { backgroundColor: colors.card, borderWidth: 1.5, borderColor: color } : { backgroundColor: color },
        { opacity: props.disabled ? 0.4 : pressed ? 0.85 : 1 },
        props.style,
      ]}
    >
      {props.icon && <Ionicons name={props.icon} size={20} color={fg} />}
      <Text style={[s.buttonText, { color: fg }]}>{props.title}</Text>
    </Pressable>
  );
}

/** Soft pill: tinted background with coloured text. */
export function Badge({ label, color, soft }: { label: string; color: string; soft?: string }) {
  return (
    <View style={[s.badge, { backgroundColor: soft ?? color }]}>
      <Text style={[s.badgeText, { color: soft ? color : '#fff' }]}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** Round icon button for the navy header, like the settings gear. */
export function HeaderIcon({ name, onPress, label }: { name: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
      })}
    >
      <Ionicons name={name} size={22} color={colors.onPrimary} />
    </Pressable>
  );
}

export function Stat({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: color ?? colors.onPrimary }}>{value}</Text>
      <Text style={{ fontSize: 13, color: colors.onPrimaryMuted }}>{label}</Text>
    </View>
  );
}
