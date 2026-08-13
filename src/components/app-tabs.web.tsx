import {
  Tabs,
  TabList,
  TabSlot,
  TabTrigger,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { usePathname } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-context';
import { ResetPasswordScreen } from '@/features/auth/reset-password-screen';
import { VerifyEmailScreen } from '@/features/auth/verify-email-screen';

export default function AppTabs() {
  const pathname = usePathname();
  const { isNurse } = useAuth();

  if (pathname === '/reset-password') {
    return <ResetPasswordScreen />;
  }

  if (pathname === '/verify-email') {
    return <VerifyEmailScreen />;
  }

  // The queue, and the patient-side operations board, are focused detail screens
  // that hide the tab bar. They still render INSIDE the navigator. Returning
  // them from here instead unmounted the navigator mid-navigation, which is why
  // router.push('/queue') from Home silently did nothing.
  const hideTabBar =
    pathname === '/queue' || (!isNurse && pathname === '/operations');

  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <ClinqueTabBar hidden={hideTabBar}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton label="Home" icon={{ ios: 'house.fill', android: 'home', web: 'home' }} />
          </TabTrigger>

          {/* Booking and a personal journey belong to patients. Nurses swap them
              for the queue board they actually work from. Both trigger sets stay
              mounted so every route keeps a target. */}
          {isNurse ? (
            <>
              <TabTrigger name="operations" href="/operations" asChild>
                <TabButton
                  label="Queue"
                  icon={{ ios: 'person.2.fill', android: 'groups', web: 'groups' }}
                />
              </TabTrigger>
              <TabTrigger name="clinics" href="/explore" style={styles.hiddenTab} />
              <TabTrigger name="journey" href="/journey" style={styles.hiddenTab} />
            </>
          ) : (
            <>
              <TabTrigger name="clinics" href="/explore" asChild>
                <TabButton
                  label="Clinics"
                  icon={{ ios: 'cross.case', android: 'local_hospital', web: 'local_hospital' }}
                />
              </TabTrigger>
              <TabTrigger name="journey" href="/journey" asChild>
                <TabButton
                  label="Journey"
                  icon={{
                    ios: 'point.bottomleft.forward.to.point.topright.scurvepath',
                    android: 'route',
                    web: 'route',
                  }}
                />
              </TabTrigger>
              <TabTrigger name="operations" href="/operations" style={styles.hiddenTab} />
            </>
          )}

          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton
              label="Profile"
              icon={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
            />
          </TabTrigger>
          <TabTrigger name="queue" href="/queue" style={styles.hiddenTab} />
          <TabTrigger name="reset-password" href="/reset-password" style={styles.hiddenTab} />
          <TabTrigger name="verify-email" href="/verify-email" style={styles.hiddenTab} />
        </ClinqueTabBar>
      </TabList>
    </Tabs>
  );
}

function ClinqueTabBar({ hidden, ...props }: TabListProps & { hidden?: boolean }) {
  return (
    <View {...props} style={[styles.tabPositioner, hidden && styles.hiddenTab]}>
      <View style={styles.tabBar}>
        <View style={styles.brandMark}>
          <Text style={styles.brandLetter}>C</Text>
        </View>

        {props.children}
      </View>
    </View>
  );
}

function TabButton({
  label,
  icon,
  isFocused,
  ...props
}: TabTriggerSlotProps & {
  label: string;
  icon: ComponentProps<typeof SymbolView>['name'];
}) {
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <SymbolView name={icon} tintColor={isFocused ? '#0E746A' : '#8BA09F'} size={20} />
      <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: '100%',
  },
  tabPositioner: {
    position: 'absolute',
    right: 0,
    bottom: 18,
    left: 0,
    alignItems: 'center',
    paddingHorizontal: 14,
    pointerEvents: 'box-none',
  },
  tabBar: {
    width: '100%',
    maxWidth: 520,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#DCE9E7',
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    shadowColor: '#174E4B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  brandMark: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#0E746A',
  },
  brandLetter: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  tabButton: {
    minWidth: 62,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  pressed: {
    opacity: 0.65,
  },
  tabLabel: {
    color: '#8BA09F',
    fontSize: 10,
    fontWeight: '700',
  },
  tabLabelFocused: {
    color: '#0E746A',
  },
  hiddenTab: {
    display: 'none',
  },
});
