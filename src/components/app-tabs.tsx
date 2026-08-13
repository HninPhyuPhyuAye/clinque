import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { usePathname } from 'expo-router';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { LiveQueueScreen } from '@/features/queue/live-queue-screen';
import { ClinicOperationsScreen } from '@/features/operations/clinic-operations-screen';
import { ResetPasswordScreen } from '@/features/auth/reset-password-screen';
import { VerifyEmailScreen } from '@/features/auth/verify-email-screen';

export default function AppTabs() {
  const pathname = usePathname();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { isNurse } = useAuth();

  if (pathname === '/reset-password') {
    return <ResetPasswordScreen />;
  }

  if (pathname === '/verify-email') {
    return <VerifyEmailScreen />;
  }

  // Patients reach the queue and the demo operations board as focused detail
  // screens. For nurses, operations is a real tab, so it stays inside the shell.
  if (!isNurse) {
    if (pathname === '/queue') {
      return <LiveQueueScreen />;
    }

    if (pathname === '/operations') {
      return <ClinicOperationsScreen />;
    }
  }

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/* Booking and a personal journey belong to patients. Nurses swap them for
          the queue board they actually work from. */}
      {isNurse ? (
        <NativeTabs.Trigger name="operations">
          <NativeTabs.Trigger.Label>Queue</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person.2', selected: 'person.2.fill' }}
            md={{ default: 'groups', selected: 'groups' }}
          />
        </NativeTabs.Trigger>
      ) : (
        <NativeTabs.Trigger name="explore">
          <NativeTabs.Trigger.Label>Clinics</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/explore.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      )}

      {isNurse ? (
        <NativeTabs.Trigger hidden name="explore" />
      ) : (
        <NativeTabs.Trigger name="journey">
          <NativeTabs.Trigger.Label>Journey</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'point.bottomleft.forward.to.point.topright.scurvepath', selected: 'point.bottomleft.forward.to.point.topright.scurvepath.fill' }}
            md={{ default: 'route', selected: 'route' }}
          />
        </NativeTabs.Trigger>
      )}

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md={{ default: 'account_circle', selected: 'account_circle' }}
        />
      </NativeTabs.Trigger>

      {isNurse && <NativeTabs.Trigger hidden name="journey" />}
      {!isNurse && <NativeTabs.Trigger hidden name="operations" />}
      <NativeTabs.Trigger hidden name="queue" />
      <NativeTabs.Trigger hidden name="reset-password" />
      <NativeTabs.Trigger hidden name="verify-email" />
    </NativeTabs>
  );
}
