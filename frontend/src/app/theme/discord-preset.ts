import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const DiscordPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '#5865f2',
      600: '#4752c4',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}'
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#1f3460',
          800: '#16213e',
          900: '#1a1a2e',
          950: '#0f0f1a'
        },
        primary: {
          color: '#5865f2',
          contrastColor: '#ffffff',
          hoverColor: '#4752c4',
          activeColor: '#3c45a5'
        }
      }
    }
  }
});

export default DiscordPreset;
