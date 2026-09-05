import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export function ModalShell({ visible, title, subtitle, onClose, children }: { visible: boolean; title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  const colors = useColors();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}><View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.handleRow}><View style={[styles.handle, { backgroundColor: colors.border }]} /><Pressable onPress={onClose} hitSlop={12}><Ionicons name="close" size={22} color={colors.mutedForeground} /></Pressable></View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      {children}
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 22, paddingBottom: 34 },
  handleRow: { height: 24, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' },
  handle: { width: 42, height: 4, borderRadius: 4, alignSelf: 'center', marginLeft: '45%' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8 },
});
