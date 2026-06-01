import { Platform } from 'react-native';

export const FontFamily = {
  serif: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  mono:  Platform.OS === 'ios' ? 'Courier New' : 'monospace',
} as const;

export const FontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  30,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
  black:   '900' as const,
};
