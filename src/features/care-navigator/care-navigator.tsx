import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ClinicFilter } from '@/features/clinics/clinic-data';
import { clinqueColors as colors } from '@/features/clinics/clinque-theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type ConcernId = 'general' | 'dental' | 'preventive';
type DurationId = 'today' | 'few-days' | 'week-plus';
type Stage = 'concern' | 'details' | 'result';

const concerns: Array<{ id: ConcernId; title: string; caption: string; icon: SymbolName }> = [
  {
    id: 'general',
    title: 'General symptoms',
    caption: 'Fever, cough, headache, stomach discomfort, or feeling unwell',
    icon: { ios: 'stethoscope', android: 'medical_information', web: 'medical_information' },
  },
  {
    id: 'dental',
    title: 'Dental concern',
    caption: 'Tooth pain, gum swelling, sensitivity, or a dental check-up',
    icon: { ios: 'mouth.fill', android: 'dentistry', web: 'dentistry' },
  },
  {
    id: 'preventive',
    title: 'Preventive care',
    caption: 'Health screening, vaccination, or a routine consultation',
    icon: { ios: 'heart.text.square.fill', android: 'health_and_safety', web: 'health_and_safety' },
  },
];

const durations: Array<{ id: DurationId; label: string }> = [
  { id: 'today', label: 'Started today' },
  { id: 'few-days', label: '2–6 days' },
  { id: 'week-plus', label: 'A week or longer' },
];

function Icon({ name, color = colors.teal, size = 22 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

export function CareNavigator({
  onClose,
  onFindClinics,
  visible,
}: {
  onClose: () => void;
  onFindClinics: (filter: ClinicFilter) => void;
  visible: boolean;
}) {
  const [stage, setStage] = useState<Stage>('concern');
  const [concern, setConcern] = useState<ConcernId | null>(null);
  const [duration, setDuration] = useState<DurationId | null>(null);
  const [urgentWarning, setUrgentWarning] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStage('concern');
    setConcern(null);
    setDuration(null);
    setUrgentWarning(false);
  }, [visible]);

  const recommendedFilter: ClinicFilter = concern === 'dental' ? 'Dental' : 'GP';

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.sheet}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel={stage === 'concern' ? 'Close care navigator' : 'Previous care navigator step'}
              onPress={stage === 'concern' ? onClose : () => setStage(stage === 'result' ? 'details' : 'concern')}
              style={styles.headerButton}>
              <Icon
                name={stage === 'concern'
                  ? { ios: 'xmark', android: 'close', web: 'close' }
                  : { ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }}
                color={colors.ink}
                size={19}
              />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>CARE NAVIGATOR</Text>
              <Text style={styles.title}>Find the right next step</Text>
            </View>
            <Text style={styles.stepText}>{stage === 'concern' ? '1/3' : stage === 'details' ? '2/3' : '3/3'}</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: stage === 'concern' ? '33%' : stage === 'details' ? '66%' : '100%' }]} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {stage === 'concern' && (
              <>
                <Text style={styles.question}>What best describes your concern?</Text>
                <Text style={styles.questionCaption}>Choose the closest option. You can still discuss everything with the clinician.</Text>
                <View style={styles.optionList}>
                  {concerns.map((item) => {
                    const selected = concern === item.id;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        key={item.id}
                        onPress={() => setConcern(item.id)}
                        style={[styles.concernOption, selected && styles.optionSelected]}>
                        <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                          <Icon name={item.icon} color={selected ? '#FFFFFF' : colors.teal} size={21} />
                        </View>
                        <View style={styles.optionCopy}>
                          <Text style={styles.optionTitle}>{item.title}</Text>
                          <Text style={styles.optionCaption}>{item.caption}</Text>
                        </View>
                        <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={!concern}
                  onPress={() => setStage('details')}
                  style={[styles.primaryButton, !concern && styles.buttonDisabled]}>
                  <Text style={styles.primaryButtonText}>Continue</Text>
                  <Icon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} color="#FFFFFF" size={18} />
                </Pressable>
              </>
            )}

            {stage === 'details' && (
              <>
                <Text style={styles.question}>A few safety checks</Text>
                <Text style={styles.questionCaption}>These answers help choose an appropriate care setting. They are not used to diagnose you.</Text>

                <Text style={styles.sectionLabel}>HOW LONG HAS THIS BEEN PRESENT?</Text>
                <View style={styles.durationRow}>
                  {durations.map((item) => {
                    const selected = duration === item.id;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        key={item.id}
                        onPress={() => setDuration(item.id)}
                        style={[styles.durationOption, selected && styles.durationSelected]}>
                        <Text style={[styles.durationText, selected && styles.durationTextSelected]}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.sectionLabel}>URGENT WARNING SIGNS</Text>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: urgentWarning }}
                  onPress={() => setUrgentWarning((current) => !current)}
                  style={[styles.warningOption, urgentWarning && styles.warningOptionSelected]}>
                  <View style={[styles.checkbox, urgentWarning && styles.checkboxSelected]}>
                    {urgentWarning && <Icon name={{ ios: 'checkmark', android: 'check', web: 'check' }} color="#FFFFFF" size={14} />}
                  </View>
                  <View style={styles.warningCopy}>
                    <Text style={styles.warningTitle}>I have an urgent warning sign</Text>
                    <Text style={styles.warningCaption}>Severe trouble breathing, chest pain, fainting, confusion, uncontrolled bleeding, or another life-threatening concern.</Text>
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  disabled={!duration}
                  onPress={() => setStage('result')}
                  style={[styles.primaryButton, !duration && styles.buttonDisabled]}>
                  <Text style={styles.primaryButtonText}>See guidance</Text>
                  <Icon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} color="#FFFFFF" size={18} />
                </Pressable>
              </>
            )}

            {stage === 'result' && urgentWarning && (
              <View style={styles.resultContent}>
                <View style={styles.urgentIcon}>
                  <Icon name={{ ios: 'cross.case.fill', android: 'emergency', web: 'emergency' }} color="#FFFFFF" size={29} />
                </View>
                <Text style={styles.resultEyebrowUrgent}>URGENT ACTION</Text>
                <Text style={styles.resultTitle}>Seek emergency help now</Text>
                <Text style={styles.resultCaption}>Call Singapore emergency services at 995 or go to the nearest Emergency Department. Do not wait for a routine clinic booking.</Text>
                <View style={styles.emergencyCard}>
                  <Text style={styles.emergencyNumber}>995</Text>
                  <Text style={styles.emergencyLabel}>Singapore ambulance & fire emergency</Text>
                </View>
                <Text style={styles.disclaimer}>Clinque does not diagnose conditions or replace emergency services.</Text>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Close navigator</Text>
                </Pressable>
              </View>
            )}

            {stage === 'result' && !urgentWarning && (
              <View style={styles.resultContent}>
                <View style={styles.resultIcon}>
                  <Icon
                    name={concern === 'dental'
                      ? { ios: 'mouth.fill', android: 'dentistry', web: 'dentistry' }
                      : { ios: 'cross.case.fill', android: 'medical_services', web: 'medical_services' }}
                    color="#FFFFFF"
                    size={28}
                  />
                </View>
                <Text style={styles.resultEyebrow}>RECOMMENDED NEXT STEP</Text>
                <Text style={styles.resultTitle}>{concern === 'dental' ? 'Book a dental clinic' : 'Book a GP consultation'}</Text>
                <Text style={styles.resultCaption}>
                  {concern === 'dental'
                    ? 'A dental clinician is the most suitable starting point for this type of concern.'
                    : 'A general practitioner can assess your concern and refer you if specialist care is needed.'}
                </Text>
                <View style={styles.guidanceCard}>
                  <Icon name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={19} />
                  <Text style={styles.guidanceText}>If symptoms become severe or you develop urgent warning signs, seek emergency help instead.</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => onFindClinics(recommendedFilter)} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>View recommended clinics</Text>
                  <Icon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} color="#FFFFFF" size={18} />
                </Pressable>
                <Text style={styles.disclaimer}>Guidance only—not a medical diagnosis.</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,29,33,0.46)' },
  sheet: { width: '100%', maxWidth: 720, maxHeight: '94%', alignSelf: 'center', borderTopLeftRadius: 31, borderTopRightRadius: 31, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 18 },
  headerButton: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: colors.card },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.teal, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 3, color: colors.ink, fontSize: 18, fontWeight: '800' },
  stepText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  progressTrack: { overflow: 'hidden', height: 4, marginHorizontal: 20, marginTop: 16, borderRadius: 2, backgroundColor: '#DDE9E7' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.teal },
  content: { padding: 20, paddingBottom: 34 },
  question: { color: colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
  questionCaption: { marginTop: 7, color: colors.muted, fontSize: 10, lineHeight: 16 },
  optionList: { gap: 11, marginTop: 20 },
  concernOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.card },
  optionSelected: { borderColor: colors.teal, backgroundColor: '#F8FEFC' },
  optionIcon: { width: 47, height: 47, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.tealSoft },
  optionIconSelected: { backgroundColor: colors.teal },
  optionCopy: { flex: 1 },
  optionTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  optionCaption: { marginTop: 4, color: colors.muted, fontSize: 8, lineHeight: 12 },
  radio: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#B8C7C5', borderRadius: 11 },
  radioSelected: { borderColor: colors.teal },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.teal },
  primaryButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, borderRadius: 16, backgroundColor: colors.teal },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  buttonDisabled: { backgroundColor: '#A8B9B7' },
  sectionLabel: { marginTop: 23, marginBottom: 10, color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.9 },
  durationRow: { flexDirection: 'row', gap: 8 },
  durationOption: { flex: 1, minHeight: 51, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: colors.card },
  durationSelected: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  durationText: { color: colors.muted, fontSize: 8, fontWeight: '700', textAlign: 'center' },
  durationTextSelected: { color: colors.teal, fontWeight: '900' },
  warningOption: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 15, borderWidth: 1, borderColor: '#ECDCD7', borderRadius: 19, backgroundColor: '#FFF9F7' },
  warningOptionSelected: { borderColor: '#C85F52', backgroundColor: '#FFF2EF' },
  checkbox: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D3A59E', borderRadius: 9, backgroundColor: '#FFFFFF' },
  checkboxSelected: { borderColor: '#C85F52', backgroundColor: '#C85F52' },
  warningCopy: { flex: 1 },
  warningTitle: { color: '#6E3731', fontSize: 10, fontWeight: '800' },
  warningCaption: { marginTop: 4, color: '#91645E', fontSize: 8, lineHeight: 13 },
  resultContent: { alignItems: 'center', paddingTop: 10 },
  resultIcon: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.teal },
  urgentIcon: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#C7564C' },
  resultEyebrow: { marginTop: 18, color: colors.teal, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  resultEyebrowUrgent: { marginTop: 18, color: '#B94B43', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  resultTitle: { marginTop: 6, color: colors.ink, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  resultCaption: { maxWidth: 430, marginTop: 9, color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' },
  guidanceCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 20, padding: 13, borderRadius: 17, backgroundColor: colors.blueSoft },
  guidanceText: { flex: 1, color: '#526B8D', fontSize: 8, lineHeight: 13 },
  emergencyCard: { width: '100%', alignItems: 'center', marginTop: 20, padding: 18, borderRadius: 20, backgroundColor: '#FFF0ED' },
  emergencyNumber: { color: '#B8463E', fontSize: 31, fontWeight: '900' },
  emergencyLabel: { marginTop: 3, color: '#7B4C47', fontSize: 8, fontWeight: '700' },
  disclaimer: { marginTop: 14, color: colors.muted, fontSize: 7, textAlign: 'center' },
  secondaryButton: { minHeight: 49, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 20, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.card },
  secondaryButtonText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
});
