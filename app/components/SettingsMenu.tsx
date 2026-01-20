import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Linking, LayoutAnimation } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, { SlideInRight, SlideOutRight, SlideInLeft, SlideOutLeft } from 'react-native-reanimated';
import { 
  ChevronRight, ChevronLeft, X, UserCircle, Key, Type, PhoneCall, 
  FileText, InfoIcon, ShieldCheck, Heart, Check 
} from 'lucide-react-native';

// Import Component ของคุณ (ปรับ path ให้ตรงกับโปรเจกต์จริง)
import { AppText } from './AppText'; 

// --- ส่วนประกอบย่อย (LineMenuItem) ---
// ย้ายมาไว้ที่นี่ หรือแยกไฟล์ก็ได้ แต่ถ้ารวมไว้ที่นี่จะจัดการง่ายกว่า
const LineMenuItem = ({ icon: Icon, color, label, onPress, isDestructive = false, fontScale = 1 }) => (
  <TouchableOpacity
    style={styles.lineMenuItem}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.lineMenuIconBox, { backgroundColor: isDestructive ? '#FEF2F2' : '#F1F5F9' }]}>
      <Icon size={20 * fontScale} color={isDestructive ? '#EF4444' : (color || '#64748B')} />
    </View>
    <View style={styles.lineMenuTextBox}>
      {/* นำ fontScale มาคูณที่นี่ */}
      <Text style={[styles.lineMenuText, isDestructive && { color: '#EF4444' }, { fontSize: 15 * fontScale }]}>
        {label}
      </Text>
    </View>
    {!isDestructive && <ChevronRight size={18 * fontScale} color="#CBD5E1" />}
  </TouchableOpacity>
);

// --- Component หลักที่จะ Export ---
interface SettingsMenuProps {
    currentView: string;
    onChangeView: (view: string) => void;
    onClose: () => void;
    authenticateUser: (callback: () => void) => void;
    navigation: any;
    onLogout: () => void;
    fontScale: number;
    changeFontScale: (scale: number) => void;
    renderPasswordForm: () => React.ReactNode; // รับฟอร์มเปลี่ยนรหัสผ่านเข้ามาแสดงผล
}

const SettingsMenu = ({ 
    currentView, 
    onChangeView, 
    onClose, 
    authenticateUser, 
    navigation, 
    onLogout, 
    fontScale = 1,
    changeFontScale,
    renderPasswordForm
}: SettingsMenuProps) => {

    const HEADER_HEIGHT = 80;

    // Header ย่อย (Internal Component)
    const Header = ({ title, showBack }: { title: string, showBack: boolean }) => (
        <View style={[styles.headerContainer, { height: HEADER_HEIGHT }]}>
            <View style={{ width: 40, alignItems: 'flex-start' }}>
                {showBack && (
                    <TouchableOpacity onPress={() => onChangeView('main')} style={styles.headerBackButton}>
                        <ChevronLeft size={24 * fontScale} color="#1E293B" />
                    </TouchableOpacity>
                )}
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
                <AppText style={[styles.modalTitle, { fontSize: 20 * fontScale }]}>{title}</AppText>
            </View>
            <View style={{ width: 40, alignItems: 'flex-end' }}>
                <TouchableOpacity onPress={onClose} style={styles.modalCloseIcon}>
                    <X size={24 * fontScale} color="#94A3B8" />
                </TouchableOpacity>
            </View>
        </View>
    );

    // Animation Config
    const mainEntering = SlideInLeft.duration(350);
    const mainExiting = SlideOutLeft.duration(350);
    const subEntering = SlideInRight.duration(350);
    const subExiting = SlideOutRight.duration(350);

    // 1. หน้าหลัก (Main Menu)
    if (currentView === 'main') {
        return (
            <Animated.View key="main" exiting={mainExiting} style={{ flex: 1 }}>
                <Header title="ตั้งค่า" showBack={false} />
                <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 }}>
                    
                    <AppText style={[styles.menuGroupTitle, { fontSize: 12 * fontScale }]}>บัญชีของฉัน</AppText>
                    <View style={styles.menuGroupContainer}>
                        <LineMenuItem fontScale={fontScale} icon={UserCircle} color="#3B82F6" label="ข้อมูลส่วนตัว" onPress={() => authenticateUser(() => { onClose(); navigation.navigate('Profile'); })} />
                        <LineMenuItem fontScale={fontScale} icon={Key} color="#F59E0B" label="เปลี่ยนรหัสผ่าน" onPress={() => onChangeView('password')} />
                    </View>

                    <AppText style={[styles.menuGroupTitle, { fontSize: 12 * fontScale, marginTop: 20 }]}>การตั้งค่าแอป</AppText>
                    <View style={styles.menuGroupContainer}>
                        <LineMenuItem fontScale={fontScale} icon={Type} color="#8B5CF6" label="ขนาดตัวอักษร" onPress={() => onChangeView('font')} />
                    </View>

                    <AppText style={[styles.menuGroupTitle, { fontSize: 12 * fontScale, marginTop: 20 }]}>ความช่วยเหลือ</AppText>
                    <View style={styles.menuGroupContainer}>
                        <LineMenuItem fontScale={fontScale} icon={PhoneCall} color="#EF4444" label="ติดต่อโรงพยาบาล" onPress={() => onChangeView('contact')} />
                        <LineMenuItem fontScale={fontScale} icon={FileText} color="#64748B" label="นโยบายความเป็นส่วนตัว" onPress={() => onChangeView('privacy')} />
                        <LineMenuItem fontScale={fontScale} icon={InfoIcon} color="#64748B" label="เกี่ยวกับแอป" onPress={() => onChangeView('about')} />
                    </View>

                    <TouchableOpacity style={styles.lineLogoutButton} onPress={() => { onClose(); onLogout(); }}>
                        <AppText style={[styles.lineLogoutText, { fontSize: 15 * fontScale }]}>ออกจากระบบ</AppText>
                    </TouchableOpacity>
                </BottomSheetScrollView>
            </Animated.View>
        );
    }

    // 2. หน้าเปลี่ยนรหัสผ่าน (รับ UI มาจาก Props renderPasswordForm)
    if (currentView === 'password') {
        return (
            <Animated.View key="password" entering={subEntering} exiting={subExiting} style={{ flex: 1 }}>
                <Header title="เปลี่ยนรหัสผ่าน" showBack={true} />
                <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50, paddingTop: 20 }}>
                    {renderPasswordForm()}
                </BottomSheetScrollView>
            </Animated.View>
        );
    }

    // 3. หน้าขนาดตัวอักษร
    if (currentView === 'font') {
        return (
            <Animated.View key="font" entering={subEntering} exiting={subExiting} style={{ flex: 1 }}>
                <Header title="ขนาดตัวอักษร" showBack={true} />
                <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}>
                    <View style={styles.fontPreviewBox}>
                        <AppText style={{ fontSize: 16 * fontScale }}>ตัวอย่างข้อความ</AppText>
                        <AppText style={{ fontSize: 14 * fontScale, color: '#64748B', marginTop: 8 }}>ขนาดปัจจุบัน</AppText>
                    </View>
                    <View style={{ gap: 12 }}>
                        {[
                            { l: 'เล็ก (16)', s: 0.85, i: 'A', fs: 16 },
                            { l: 'ปกติ (20)', s: 1, i: 'A', fs: 20, b: true },
                            { l: 'ใหญ่ (24)', s: 1.2, i: 'A', fs: 24, b: true, w: '900' }
                        ].map((opt, idx) => (
                            <TouchableOpacity 
                                key={idx}
                                style={[styles.fontSizeOption, fontScale === opt.s && styles.fontSizeOptionActive]}
                                onPress={() => changeFontScale(opt.s)}
                            >
                                <AppText style={{ fontSize: opt.fs, fontWeight: opt.w || 'normal' as any, color: fontScale === opt.s ? 'white' : '#1E293B' }}>{opt.i}</AppText>
                                <AppText style={[styles.fontSizeLabel, { color: fontScale === opt.s ? 'white' : '#1E293B', fontSize: 16 * fontScale }]}>{opt.l}</AppText>
                                {fontScale === opt.s && <Check size={20} color="white" />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </BottomSheetScrollView>
            </Animated.View>
        );
    }

    // ... (ส่วน Contact, Privacy, About ก็ใส่ในนี้ได้เลยครับ ตาม Pattern เดิม) ...
    // เพื่อความกระชับ ผมละไว้ในฐานที่เข้าใจนะครับ สามารถ Copy โค้ดเดิมมาวางต่อได้เลย

    return null;
};

// Styles ที่ย้ายมาจาก HomeScreen (เฉพาะส่วนที่ใช้ใน Settings)
const styles = StyleSheet.create({
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: 'white',
    },
    headerBackButton: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 14 },
    modalTitle: { fontWeight: '900', color: '#1E293B' },
    modalCloseIcon: { padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12 },
    menuGroupTitle: { fontWeight: 'bold', color: '#94A3B8', marginBottom: 10, marginLeft: 5 },
    menuGroupContainer: { gap: 10 },
    lineMenuItem: { 
        flexDirection: 'row', alignItems: 'center', padding: 16, 
        backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 8, 
        borderWidth: 1, borderColor: '#F1F5F9',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 2
    },
    lineMenuIconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    lineMenuTextBox: { flex: 1 },
    lineMenuText: { fontWeight: 'bold', color: '#334155' },
    lineLogoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', paddingVertical: 16, borderRadius: 20, marginTop: 30, marginBottom: 40 },
    lineLogoutText: { fontWeight: 'bold', color: '#EF4444' },
    fontPreviewBox: { padding: 20, backgroundColor: '#F8FAFC', borderRadius: 16, marginBottom: 30, alignItems: 'center', minHeight: 120, justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    fontSizeOption: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'white' },
    fontSizeOptionActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    fontSizeLabel: { marginLeft: 15, flex: 1, fontWeight: '600' },
});

export default SettingsMenu;