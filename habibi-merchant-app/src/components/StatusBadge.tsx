import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusColor } from '../theme/colors';
import { FontSize, FontWeight } from '../theme/typography';

interface Props {
  status: string;
  small?: boolean;
}

export default function StatusBadge({ status, small }: Props) {
  const s     = status || 'unknown';
  const color = StatusColor[s.toLowerCase()] ?? '#6B6B76';
  const label = s.replace(/_/g, ' ').toUpperCase();

  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}20` }, small && styles.small]}>
      <Text style={[styles.text, { color }, small && styles.smallText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  smallText: {
    fontSize: 10,
  },
});
