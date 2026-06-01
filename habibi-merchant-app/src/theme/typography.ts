import { Platform } from 'react-native';

export const Font = {
  regular: Platform.OS === 'ios' ? 'System' : 'Roboto',
  mono:    Platform.OS === 'ios' ? 'Courier' : 'monospace',
};

export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  hero: 30,
};

export const FontWeight = {
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
};
