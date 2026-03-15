import { Dimensions } from 'react-native';
import React from 'react';
import { View, Text, StyleSheet, Linking, Alert, TouchableOpacity } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, { 
    SlideInRight, SlideOutRight, runOnJS, 
    FadeInRight, FadeOutRight,
    useSharedValue, useAnimatedStyle, withTiming 
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { 
  ChevronRight, ChevronLeft, X, UserCircle, Key, Type, PhoneCall, 
  InfoIcon, ShieldCheck, Heart, Check, MapPin, LogOut 
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { AppText } from './AppText'; 
import { Image } from 'expo-image';

const SCREEN_WIDTH = Dimensions.get('window').width;

// 🌟 1. ย้าย SwipeBackView ออกมาไว้นอกสุดตรงนี้ครับ! 🌟
// พออยู่นอกสุดแล้ว ต่อให้ fontScale เปลี่ยน หน้าต่างนี้ก็จะไม่ถูกทำลายและไม่เล่นแอนิเมชันซ้ำครับ
const SwipeBackView = ({ children, viewKey, customStyle, onChangeView, entering = SlideInRight.duration(300), exiting = SlideOutRight.duration(300) }: any) => {
    const translateX = useSharedValue(0);

    const panGesture = Gesture.Pan()
        .activeOffsetX(15)
        .failOffsetY([-15, 15])
        .onUpdate((event) => {
            translateX.value = Math.max(0, event.translationX);
        })
        .onEnd((event) => {
            'worklet';
            if (event.translationX > SCREEN_WIDTH / 3 || event.velocityX > 500) {
                translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 }, () => {
                    runOnJS(onChangeView)('main');
                });
            } else {
                translateX.value = withTiming(0, { duration: 200 });
            }
        });

    const animatedStyle = useAnimatedStyle(() => {
        return { transform: [{ translateX: translateX.value }] };
    });

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View 
                key={viewKey} 
                entering={entering} 
                exiting={exiting} 
                style={[
                    StyleSheet.absoluteFillObject, 
                    { zIndex: 10, backgroundColor: '#FFFFFF', elevation: 10 }, 
                    customStyle,
                    animatedStyle 
                ]}
            >
                {children}
            </Animated.View>
        </GestureDetector>
    );
};

// 🎨 Component แถวเมนู
const MenuItem = ({ icon: Icon, title, rightText, onPress, isDestructive = false, fontScale = 1 }: any) => {
    return (
        <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7} containerStyle={{ overflow: 'visible' }}>
            <View style={styles.menuItemLeft}>
                <Icon size={24 * fontScale} color={isDestructive ? "#EF4444" : "#1E293B"} />
                <Text style={[
                    styles.menuItemTitle, 
                    { fontSize: 16 * fontScale, color: isDestructive ? "#EF4444" : "#1E293B" }
                ]}>
                    {title}
                </Text>
            </View>
            <View style={styles.menuItemRight}>
                {rightText && (
                    <Text style={[styles.menuItemRightText, { fontSize: 14 * fontScale }]}>
                        {rightText}
                    </Text>
                )}
                <ChevronRight size={20 * fontScale} color="#CBD5E1" />
            </View>
        </TouchableOpacity>
    );
};

interface SettingsMenuProps {
    currentView: string;
    onChangeView: (view: string) => void;
    onClose: () => void;
    authenticateUser: (callback: () => void) => void;
    navigation: any;
    onLogout: () => void;
    renderPasswordForm: () => React.ReactNode; 
}

const SettingsMenu = ({ 
    currentView, onChangeView, onClose, authenticateUser, navigation, onLogout, renderPasswordForm
}: SettingsMenuProps) => {
    const { fontScale, changeFontScale } = useTheme();
    const HEADER_HEIGHT = 80;

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

    return (
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            
            {/* 1. หน้าหลัก */}
            <View 
                style={[StyleSheet.absoluteFillObject, { backgroundColor: '#F8FAFC', zIndex: 0 }]} 
                pointerEvents={currentView === 'main' ? 'auto' : 'none'} 
            >
                <Header title="ตั้งค่า" showBack={false} />
                <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                    
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { fontSize: 13 * fontScale }]}>ข้อมูลส่วนตัว</Text>
                        <View style={styles.sectionBlock}>
                            <MenuItem icon={UserCircle} title="บัญชีผู้ใช้" onPress={() => {
                                onClose();
                                setTimeout(() => {
                                    authenticateUser(() => {
                                        navigation.navigate('Profile');
                                    });
                                }, 200);}} 
                                fontScale={fontScale} />  
                            <View style={styles.divider} />
                            <MenuItem icon={Key} title="เปลี่ยนรหัสผ่าน" onPress={() => onChangeView('password')} fontScale={fontScale} />
                        </View>
                    </View>

                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { fontSize: 13 * fontScale }]}>การแสดงผล</Text>
                        <View style={styles.sectionBlock}>
                            <MenuItem icon={Type} title="ขนาดตัวอักษร" rightText="มาตรฐาน" onPress={() => onChangeView('font')} fontScale={fontScale} />
                        </View>
                    </View>

                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { fontSize: 13 * fontScale }]}>ความช่วยเหลือ</Text>
                        <View style={styles.sectionBlock}>
                            <MenuItem icon={PhoneCall} title="ติดต่อโรงพยาบาล" onPress={() => onChangeView('contact')} fontScale={fontScale} />
                            <View style={styles.divider} />
                            <MenuItem icon={ShieldCheck} title="ความเป็นส่วนตัว" onPress={() => onChangeView('privacy')} fontScale={fontScale} />
                            <View style={styles.divider} />
                            <MenuItem icon={InfoIcon} title="เกี่ยวกับแอป" onPress={() => onChangeView('about')} fontScale={fontScale} />
                        </View>
                    </View>

                    <View style={[styles.sectionContainer, { marginTop: 10, marginBottom: 20 }]}>
                        <View style={styles.sectionBlock}>
                            <MenuItem 
                                icon={LogOut} 
                                title="ออกจากระบบ" 
                                isDestructive={true}
                                onPress={() => {
                                    Alert.alert(
                                        "ยืนยัน",
                                        "ต้องการออกจากระบบใช่หรือไม่?",
                                        [
                                            { text: "ยกเลิก", style: "cancel" },
                                            { text: "ออกจากระบบ", style: "destructive", onPress: () => { onClose(); onLogout(); } }
                                        ]
                                    );
                                }} 
                                fontScale={fontScale} 
                            />
                        </View>
                    </View>
                </BottomSheetScrollView>
            </View>

            {/* 2. หน้าเปลี่ยนรหัสผ่าน */}
            {currentView === 'password' && (
                <SwipeBackView key="password" onChangeView={onChangeView}>
                    <Header title="เปลี่ยนรหัสผ่าน" showBack={true} />
                    <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50, paddingTop: 20 }}>
                        {renderPasswordForm()}
                    </BottomSheetScrollView>
                </SwipeBackView>
            )}

            {/* 3. หน้าขนาดตัวอักษร */}
            {currentView === 'font' && (
                <SwipeBackView 
                    key="font" 
                    onChangeView={onChangeView}
                    style={{ elevation: 10 }}
                >
                    <Header title="ขนาดตัวอักษร" showBack={true} />
                    <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}>
                        <View style={styles.fontPreviewBox}>
                            <AppText style={{ fontSize: 16 * fontScale }}>ตัวอย่างข้อความ</AppText>
                            <AppText style={{ fontSize: 14 * fontScale, color: '#64748B', marginTop: 8 }}>ขนาดปัจจุบัน</AppText>
                        </View>
                        
                        <View style={{ gap: 12 }} onStartShouldSetResponder={() => true}>
                            {[
                                { l: 'เล็ก (16)', s: 0.85, i: 'A', fs: 16 },
                                { l: 'ปกติ (20)', s: 1, i: 'A', fs: 20, b: true },
                                { l: 'ใหญ่ (24)', s: 1.2, i: 'A', fs: 24, b: true, w: '900' }
                            ].map((opt, idx) => {
                                const currentScale = Number(fontScale) || 1; 
                                const isActive = currentScale === opt.s;

                                return (
                                    <TouchableOpacity 
                                        key={idx}
                                        activeOpacity={0.6}
                                        style={[styles.fontSizeOption, isActive && styles.fontSizeOptionActive]}
                                        onPress={() => {
                                            changeFontScale(opt.s);
                                        }} 
                                    >
                                        <AppText style={{ fontSize: opt.fs, fontWeight: opt.w || 'normal' as any, color: isActive ? 'white' : '#1E293B' }}>{opt.i}</AppText>
                                        <AppText style={[styles.fontSizeLabel, { color: isActive ? 'white' : '#1E293B', fontSize: 16 * currentScale }]}>{opt.l}</AppText>
                                        {isActive && <Check size={20} color="white" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </BottomSheetScrollView>
                </SwipeBackView>
            )}

            {/* 4. หน้าติดต่อโรงพยาบาล */}
            {currentView === 'contact' && (
                <SwipeBackView key="contact" onChangeView={onChangeView}>
                    <Header title="ติดต่อโรงพยาบาล" showBack={true} />
                    <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}>
                        <View style={[styles.infoCard, { alignItems: 'center', marginBottom: 20, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                            <View style={{ width: 80, height: 80, marginBottom: 15 }}>
                                <Image source={require('../../assets/ksvr-logo.png')} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                            </View>
                            <AppText style={{ fontWeight: '900', fontSize: 18 * fontScale, color: '#1E293B', textAlign: 'center' }}>โรงพยาบาลค่ายกฤษณ์สีวะรา</AppText>
                            <AppText style={{ color: '#64748B', fontSize: 13 * fontScale, textAlign: 'center', marginTop: 5 }}>สังกัด กองทัพบก</AppText>
                            <View style={{ height: 1, width: '80%', backgroundColor: '#E2E8F0', marginVertical: 15 }} />
                            <AppText style={{ color: '#475569', fontSize: 14 * fontScale, textAlign: 'center' }}>"พร้อมดูแลเคียงข้างคุณทุกนาทีวิกฤต"</AppText>
                        </View>
                        <View style={styles.infoCard}>
                            <View style={styles.infoRow}>
                                <PhoneCall size={24 * fontScale} color="#EF4444" />
                                <View style={{ marginLeft: 15, flex: 1 }}>
                                    <AppText style={{ fontWeight: 'bold', fontSize: 16 * fontScale, color: '#1E293B' }}>สายด่วนฉุกเฉิน</AppText>
                                    <AppText style={{ color: '#64748B', marginTop: 4, fontSize: 13 * fontScale }}>1669</AppText>
                                </View>
                                <TouchableOpacity onPress={() => Linking.openURL('tel:1669')} style={styles.callButton}>
                                    <AppText style={[styles.callButtonText, { fontSize: 14 * fontScale }]}>โทรออก</AppText>
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.infoRow, { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}>
                                <PhoneCall size={24 * fontScale} color="#3B82F6" />
                                <View style={{ marginLeft: 15, flex: 1 }}>
                                    <AppText style={{ fontWeight: 'bold', fontSize: 16 * fontScale, color: '#1E293B' }}>ติดต่อสอบถาม รพ.</AppText>
                                    <AppText style={{ color: '#64748B', marginTop: 4, fontSize: 13 * fontScale }}>064-790-6014</AppText>
                                </View>
                                <TouchableOpacity onPress={() => Linking.openURL('tel:0647906014')} style={[styles.callButton, { backgroundColor: '#EFF6FF' }]}>
                                    <AppText style={[styles.callButtonText, { color: '#3B82F6', fontSize: 14 * fontScale }]}>โทรออก</AppText>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </BottomSheetScrollView>
                </SwipeBackView>
            )}

            {/* 5. หน้า Privacy */}
            {currentView === 'privacy' && (
                <SwipeBackView key="privacy" onChangeView={onChangeView}>
                    <Header title="นโยบายความเป็นส่วนตัว" showBack={true} />
                    <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}>
                        <View style={styles.infoCard}>
                            <ShieldCheck size={40 * fontScale} color="#059669" style={{ alignSelf: 'center', marginBottom: 15 }} />
                            <AppText style={{ fontWeight: 'bold', fontSize: 18 * fontScale, marginBottom: 15, textAlign: 'center', color: '#1E293B' }}>
                                การคุ้มครองข้อมูลส่วนบุคคล
                            </AppText>
                            <AppText style={{ color: '#475569', lineHeight: 24 * fontScale, fontSize: 14 * fontScale, marginBottom: 15 }}>
                                แอปพลิเคชัน KSVR ACS Fast Track ให้ความสำคัญอย่างยิ่งกับการคุ้มครองข้อมูลส่วนบุคคล...
                            </AppText>
                        </View>
                    </BottomSheetScrollView>
                </SwipeBackView>
            )}

            {/* 6. หน้า About */}
            {currentView === 'about' && (
                <SwipeBackView key="about" onChangeView={onChangeView}>
                    <Header title="เกี่ยวกับแอป" showBack={true} />
                    <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40, alignItems: 'center' }}>
                        <View style={styles.logoPlaceholder}>
                            <Heart size={48 * fontScale} color="#EF4444" fill="#FEF2F2" />
                        </View>
                        <AppText style={{ fontWeight: '900', fontSize: 22 * fontScale, marginTop: 20, color: '#1E293B' }}>
                            KSVR ACS Fast Track
                        </AppText>
                        <AppText style={{ color: '#64748B', marginTop: 8, fontSize: 15 * fontScale }}>
                            เวอร์ชัน 1.0.0
                        </AppText>
                    </BottomSheetScrollView>
                </SwipeBackView>
            )}

        </View>
    );
};

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
    sectionContainer: { marginTop: 20 },
    sectionTitle: { color: '#64748B', fontWeight: 'bold', marginLeft: 20, marginBottom: 8 },
    sectionBlock: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E2E8F0' },
    menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, backgroundColor: '#FFFFFF' },
    menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
    menuItemTitle: { marginLeft: 15, fontWeight: '500' },
    menuItemRight: { flexDirection: 'row', alignItems: 'center' },
    menuItemRightText: { color: '#94A3B8', marginRight: 8 },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 60 },
    fontPreviewBox: { padding: 20, backgroundColor: '#F8FAFC', borderRadius: 16, marginBottom: 30, alignItems: 'center', minHeight: 120, justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    fontSizeOption: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'white' },
    fontSizeOptionActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    fontSizeLabel: { marginLeft: 15, flex: 1, fontWeight: '600' },
    infoCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 2 },
    infoRow: { flexDirection: 'row', alignItems: 'center' },
    callButton: { backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    callButtonText: { color: '#EF4444', fontWeight: 'bold' },
    logoPlaceholder: { width: 100, height: 100, backgroundColor: '#FFFFFF', borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 10 },
});

export default SettingsMenu;