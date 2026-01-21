/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Brand = {
  canvas: '#F4F6F2',
  ink: '#0B1D14',
  clay: '#0B5A2A',
  moss: '#0F4B25',
  gold: '#C3B16A',
  sage: '#E1E8E0',
  rose: '#EEF2ED',
  night: '#08100C',
  mist: '#FFFFFF',
};

const tintColorLight = Brand.clay;
const tintColorDark = Brand.gold;

export const Colors = {
  light: {
    text: Brand.ink,
    background: Brand.canvas,
    tint: tintColorLight,
    icon: '#6E6A61',
    tabIconDefault: '#6E6A61',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: Brand.mist,
    background: Brand.night,
    tint: tintColorDark,
    icon: '#A49E90',
    tabIconDefault: '#A49E90',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'AvenirNext-Regular',
    serif: 'Palatino',
    rounded: 'AvenirNext-DemiBold',
    mono: 'Menlo',
  },
  default: {
    sans: 'serif',
    serif: 'serif',
    rounded: 'serif',
    mono: 'monospace',
  },
  web: {
    sans: "'Source Sans 3', 'Gill Sans', 'Trebuchet MS', sans-serif",
    serif: "'Playfair Display', 'Palatino', 'Georgia', serif",
    rounded: "'Source Sans 3', 'Trebuchet MS', sans-serif",
    mono: "'IBM Plex Mono', 'Courier New', monospace",
  },
});
