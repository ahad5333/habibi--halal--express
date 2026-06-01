import { useWindowDimensions } from 'react-native';

export function useLayout() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isPhone:    width < 768,
    isTablet:   width >= 768,
    isLandscape: width > height,
  };
}
