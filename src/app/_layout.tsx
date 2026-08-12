import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AppointmentProvider } from '@/features/appointments/appointment-context';
import { AuthProvider } from '@/features/auth/auth-context';
import { AuthGate } from '@/features/auth/auth-gate';
import { NotificationProvider } from '@/features/notifications/notification-context';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AuthGate>
          <AppointmentProvider>
            <NotificationProvider>
              <AnimatedSplashOverlay />
              <AppTabs />
            </NotificationProvider>
          </AppointmentProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
