import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AppointmentProvider } from '@/features/appointments/appointment-context';
import { NotificationProvider } from '@/features/notifications/notification-context';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppointmentProvider>
        <NotificationProvider>
          <AnimatedSplashOverlay />
          <AppTabs />
        </NotificationProvider>
      </AppointmentProvider>
    </ThemeProvider>
  );
}
