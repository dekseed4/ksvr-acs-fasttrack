import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Linking, 
  Modal,
  StatusBar,
  Image,
  Alert,
  TouchableWithoutFeedback,
  TextInput,
  PanResponder,
  AppState,
  LayoutAnimation, 
  UIManager, 
  DeviceEventEmitter,
} from 'react-native';

import { useNavigation } from '@react-navigation/native'; 
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { 
  BottomSheetModal, 
  BottomSheetModalProvider, 
  BottomSheetBackdrop, 
  BottomSheetScrollView,
  BottomSheetView
} from '@gorhom/bottom-sheet';

import { 
    SlideInRight, SlideOutRight, 
    SlideInLeft, SlideOutLeft, 
    LinearTransition, FadeIn, FadeOut 
} from 'react-native-reanimated';

import MapView, { Marker, PROVIDER_GOOGLE, Circle as MapCircle } from 'react-native-maps';
import axios from 'axios';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '../components/AppText';
import { useTheme, FONT_SCALES } from '../context/ThemeContext';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';

import Svg, { Circle } from 'react-native-svg';
import {
  Heart,
  MapPin,
  Activity,
  Clock,
  AlertTriangle,
  Zap,
  User,
  ShieldCheck,
  Info,
  ChevronRight,
  ChevronLeft,
  Navigation,
  X,
  Settings,
  LogOut,
  Bell,
  UserCircle,
  FileText,
  Lock,
  Phone,
  Pill,
  FileHeart, 
  Contact,
  Menu,
  Calendar, 
  Hash, 
  Key,      
  Type,      
  Globe,     
  PhoneCall, 
  Info as InfoIcon,
  Check,
  Eye,    
  EyeOff 
} from 'lucide-react-native';

import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../config';

const { width, height } = Dimensions.get('window'); 

import { HOSPITAL_COORDS } from '../config';

// --- Component ปุ่มเมนูสไตล์ LINE (วางไว้นอก HomeScreen) ---
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

const HomeScreen = () => {

    const { setUserData, onLogout, authState } = useAuth(); // ดึง Token และฟังก์ชัน Logout
    const user = authState?.user; // ข้อมูลโปรไฟล์ผู้ใช้

    const appState = useRef(AppState.currentState);

    const navigation = useNavigation();
    
    // --- Network Connectivity State ---
    const [isConnected, setIsConnected] = useState(true);

    // --- Notification Management ---
    const [hasUnread, setHasUnread] = useState(false);
    const [notificationList, setNotificationList] = useState([]);
    const notificationListRef = useRef([]);

    // ใช้งาน Theme Context
    const { fontScale, changeFontScale } = useTheme();

    // Navigation & UI States
    const [isCalling, setIsCalling] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // สถานะขณะส่งข้อมูลไปยัง Server
    const [showInAppMap, setShowInAppMap] = useState(false); // State สำหรับเปิด/ปิดแผนที่ในแอป
    
    // --- Settings Modal State Management ---
    const settingsSheetRef = useRef(null);
    // Snap points: 90% ของหน้าจอ
    const snapPoints = useMemo(() => ['90%'], []);
    const [settingsView, setSettingsView] = useState('main'); 

    const [secondsLeft, setSecondsLeft] = useState(0);
    const [pressProgress, setPressProgress] = useState(0);
    const [isPressing, setIsPressing] = useState(false);

    // --- Biometric Authentication State ---
    const [biometricPermission, setBiometricPermission] = useState(null);
    // ✅ [เพิ่ม] ตัวแปรเก็บเวลาที่สแกนนิ้วผ่านล่าสุด (เริ่มต้นเป็น 0)
    const lastAuthTime = useRef(0);
    // ✅ [เพิ่ม] ระยะเวลาที่จำค่า (5 นาที = 300000 ms)
    const AUTH_GRACE_PERIOD = 5 * 60 * 1000;
    // --- Image Loading State ---
    const [imageLoadError, setImageLoadError] = useState(false);

    // --- Password Change States ---
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    
    // Password Visibility States
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // --- เก็บ ID รายการฉุกเฉินปัจจุบัน ---
    const [activeEmergencyId, setActiveEmergencyId] = useState(null);

    // --- Profile & Loading States ---
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- Location States ---
    const [currentLocation, setCurrentLocation] = useState(null);
    const [address, setAddress] = useState('กำลังค้นหาพิกัด...');
    const [distance, setDistance] = useState(0);
    const [isLocationLive, setIsLocationLive] = useState(false);

    // --- Refs & Animation ---
    const mapRef = useRef(null);
    const timerRef = useRef(null);
    const countdownRef = useRef(null);
    const watchSubscription = useRef(null); 
    const pulseAnim = useRef(new Animated.Value(1)).current; 
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const blinkAnim = useRef(new Animated.Value(0.4)).current; // สำหรับสถานะ Live GPS

    const HOLD_DURATION = 1000; // 1 วินาที
    const radius = 90;
    const strokeWidth = 8;
    const circumference = 2 * Math.PI * radius;

    const changeSettingsView = (newView) => {
        // สั่งให้ Layout (ความสูง/กว้าง) เปลี่ยนแบบ Smooth (Ease In Ease Out)
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSettingsView(newView);
    };

   
    
    // ฟังก์ชันลงทะเบียนรับ Push Notifications
    async function registerForPushNotificationsAsync() {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        // ถ้ายังไม่มีสิทธิ์ ให้ขอสิทธิ์
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
            alert('Failed to get push token for push notification!');
            return;
        }

        // ดึง Token (ต้องใช้ Project ID จาก app.json / eas.json ถ้าใช้ EAS Build)
        // แต่ถ้า Test บน Expo Go ปกติไม่ต้องใส่ projectId ก็ได้
        token = (await Notifications.getExpoPushTokenAsync({
            projectId: 'YOUR_PROJECT_ID_HERE' // ใส่ Project ID ของคุณถ้ามี
        })).data;

        console.log("Expo Push Token:", token); // <-- เอา Token นี้ไปเทสยิงดูก่อนได้
        return token;
    }

   // --- [NEW] Backdrop for Bottom Sheet ---
    const renderBackdrop = useCallback(
        props => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
                pressBehavior="close"
                style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} 
            />
        ),
        []
    );

    // ฟังก์ชันคำนวณระยะทาง (Haversine Formula)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; 
        return parseFloat(d.toFixed(2)); 
    };

    // ฟังก์ชันคำนวณเวลาเดินทางโดยประมาณ (นาที)
    const calculateTravelTime = (km) => {
        const AVG_SPEED_KMH = 60; // ความเร็วเฉลี่ยรถพยาบาลในเมือง
        const PREP_TIME_MINS = 2; // เวลาเตรียมตัวออกเหตุ
        const travelTimeMins = (km / AVG_SPEED_KMH) * 60;
        const totalTimeMins = Math.max(3, travelTimeMins + PREP_TIME_MINS); // ขั้นต่ำ 3 นาที
        return Math.round(totalTimeMins * 60); // คืนค่าเป็นวินาที
    };

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const triggerHaptic = async (type) => {
        try {
            if (Platform.OS === 'web') return;
            switch (type) {
                case 'impactMedium': await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
                case 'selection': await Haptics.selectionAsync(); break;
                case 'notificationSuccess': await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
                case 'notificationError': await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); break;
                default: await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (e) {}
        // ป้องกัน Error บน Simulator หรือเครื่องที่ไม่มีระบบสั่น
    };

    // ฟังก์ชันสำหรับเปิดแผนที่เพื่อดูตำแหน่งปัจจุบัน
    const openInMaps = () => {
        if (currentLocation && currentLocation.latitude) {
        setShowInAppMap(true);
        triggerHaptic('impactMedium');
        }
    };

    const authenticateUser = async (onSuccess) => {
        try {
            const now = Date.now();
            if (lastAuthTime.current > 0 && (now - lastAuthTime.current < AUTH_GRACE_PERIOD)) {
                console.log("Grace period active: Skip biometric");
                onSuccess(); // อนุญาตทันที ไม่ต้องสแกน
                return;
            }

            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (hasHardware && isEnrolled) {
                if (biometricPermission === null) {
                    Alert.alert(
                        "ความปลอดภัย",
                        "ต้องการใช้การสแกนใบหน้า/ลายนิ้วมือ เพื่อยืนยันตัวตนก่อนเข้าดูข้อมูลส่วนตัวหรือไม่?",
                        [
                            {
                                text: "ไม่ใช้",
                                style: "cancel",
                                onPress: async () => {
                                    setBiometricPermission(false);
                                    await AsyncStorage.setItem('use_biometric', 'false'); // บันทึกค่า
                                    onSuccess(); 
                                }
                            },
                            {
                                text: "ใช้งาน",
                                onPress: async () => {
                                    const result = await LocalAuthentication.authenticateAsync({
                                        promptMessage: 'ยืนยันตัวตนเพื่อตั้งค่า',
                                        cancelLabel: 'ยกเลิก',
                                        fallbackLabel: 'ใช้รหัสผ่าน',
                                        disableDeviceFallback: false,
                                    });
                                    if (result.success) {
                                        setBiometricPermission(true);
                                        await AsyncStorage.setItem('use_biometric', 'true'); // บันทึกค่า

                                        lastAuthTime.current = Date.now();

                                        onSuccess();
                                        triggerHaptic('notificationSuccess');
                                    }
                                }
                            }
                        ]
                    );
                } else if (biometricPermission === true) {
                    const result = await LocalAuthentication.authenticateAsync({
                        promptMessage: 'ยืนยันตัวตนเพื่อเข้าถึงข้อมูล',
                        cancelLabel: 'ยกเลิก',
                        fallbackLabel: 'ใช้รหัสผ่าน',
                        disableDeviceFallback: false,
                    });
                    if (result.success) {
                        lastAuthTime.current = Date.now();
                        onSuccess();
                        triggerHaptic('notificationSuccess');
                    } else {
                        // สแกนไม่ผ่าน
                        // Alert.alert('ยืนยันตัวตนไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง');
                    }
                } else {
                    // ถ้าตั้งค่าไว้ว่าไม่ใช้ ก็ผ่านได้เลย
                    onSuccess();
                }
            } else {
                // ถ้าเครื่องไม่รองรับ ให้ผ่านได้เลย
                onSuccess();
            }
        } catch (error) {
            console.log("Biometric error:", error);
            onSuccess(); // Fallback
        }
    };

    // --- Data & Logic Functions ---
    const loadUser = async () => {
        // if (authState?.user) return; // ถ้ามีข้อมูลผู้ใช้ใน Context แล้ว ให้ข้ามการโหลดใหม่
    
        try {
            const result = await axios.get(`${API_URL}/profile`);
               
            // console.log("Current User State:", JSON.stringify(authState?.user, null, 2));
            // console.log("Profile loaded:", );
            setUserData(result.data.data);
            setImageLoadError(false);
        } catch (e) {
            console.error("Profile load failed:", e.message);
            if (e.response?.status === 401) onLogout && onLogout(); // ถ้า Token หมดอายุ ให้เตะออกหน้า Login
        }
          
    };

    // ฟังก์ชันแปลงพิกัดเป็นชื่อสถานที่ (Reverse Geocoding)
    const getAddressFromCoords = async (latitude, longitude) => {
        if (!latitude || !longitude) return;
        try {
        const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude,
            longitude
        });

         if (reverseGeocode && reverseGeocode.length > 0) {
            const place = reverseGeocode[0];
            // จัดรูปแบบที่อยู่: ถนน, แขวง/ตำบล, เขต/อำเภอ, จังหวัด
            const formattedAddress = [
            place.street,
            place.district,
            place.city || place.region,
            ].filter(Boolean).join(', ');
            
            setAddress(formattedAddress || 'ไม่สามารถระบุที่อยู่ได้');
        }
        } catch (error) {
        console.log("Geocoding error:", error);
        }
    };

    // ฟังก์ชันอัปเดต UI เมื่อพิกัดเปลี่ยน
    const updateUIWithLocation = useCallback(async (coords) => {
        if (!coords || typeof coords !== 'object') return;
            const { latitude, longitude } = coords;
            setCurrentLocation({ latitude, longitude });
            getAddressFromCoords(latitude, longitude);
            setDistance(calculateDistance(latitude, longitude, HOSPITAL_COORDS.latitude, HOSPITAL_COORDS.longitude));
            setIsLocationLive(true);
    }, []);

    // ฟังก์ชันเริ่มต้นการติดตามตำแหน่งแบบเรียลไทม์
    const startLocationTracking = async (mode = 'normal') => {
        try {
            // เคลียร์ watcher เก่าก่อนเสมอ เพื่อไม่ให้ทำงานซ้อนกัน
            if (watchSubscription.current) {
                watchSubscription.current.remove();
                watchSubscription.current = null;
            }

            // ตั้งค่าความละเอียดตามโหมด
            const options = mode === 'emergency' 
                ? { 
                    accuracy: Location.Accuracy.BestForNavigation, 
                    distanceInterval: 5, // ทุก 5 เมตร (กินแบตฯ)
                    timeInterval: 2000   // หรือทุก 2 วินาที
                }
                : { 
                    accuracy: Location.Accuracy.Balanced, 
                    distanceInterval: 100, // ทุก 100 เมตร (ประหยัดแบตฯ)
                    timeInterval: 60000    // หรือทุก 1 นาที
                };

            // เริ่มติดตาม
            watchSubscription.current = await Location.watchPositionAsync(
                options,
                (newLocation) => {
                    if (newLocation && newLocation.coords) {
                        updateUIWithLocation(newLocation.coords);
                        
                        // ถ้าอยู่ในโหมดฉุกเฉิน ให้ส่งพิกัดขึ้น Server ตลอดเวลาด้วย (ถ้ามี API รองรับ)
                        // if (mode === 'emergency') { sendLocationToServer(newLocation.coords); }
                    }
                }
            );
        } catch (err) {
            console.log("Tracking error:", err.message);
        }
    };

    // --- Location Logic สำหรับ Expo ---
    const requestLocationPermission = async () => {
        try {
        // ขอสิทธิ์การเข้าถึงตำแหน่ง
       let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setAddress('กรุณาอนุญาตการเข้าถึงตำแหน่ง');
                return false;
            }
            startLocationTracking();
            return true;
        } catch (error) {
            console.log("Permission error:", error);
            return false;
        }
    };

    // ฟังก์ชันรีเฟรชข้อมูล (Pull to Refresh)
    const onRefresh = useCallback(async () => {
            setRefreshing(true);
        
            try {
            // ดึงข้อมูลโปรไฟล์และตำแหน่งใหม่ไปพร้อมกัน
                await triggerHaptic('impactMedium');
                await loadUser();
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status === 'granted') {
                    let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
                    if (loc && loc.coords) updateUIWithLocation(loc.coords);
                } else {
                    await requestLocationPermission();
                }
            } finally {
                setRefreshing(false);
            }
    }, [updateUIWithLocation]);
    
    // --- [NEW] Change Password Logic ---
    const handleChangePassword = async () => {
        // 1. Validation พื้นฐาน
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }

        // 2. เช็คความยาว (แนะนำ 8 ตัวขึ้นไปตามมาตรฐานใหม่ แต่ 6 ก็พอใช้ได้)
        if (newPassword.length < 6) {
            Alert.alert('แจ้งเตือน', 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
            return;
        }

        // 3. เช็ครหัสใหม่กับยืนยัน
        if (newPassword !== confirmPassword) {
            Alert.alert('แจ้งเตือน', 'รหัสผ่านใหม่ไม่ตรงกัน');
            return;
        }

        // 4. (เพิ่ม) เช็คว่ารหัสใหม่ซ้ำกับรหัสเดิมหรือไม่
        if (currentPassword === newPassword) {
            Alert.alert('แจ้งเตือน', 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
            return;
        }

        setIsChangingPassword(true);

        try {
            // เรียก API
            const response = await axios.post(`${API_URL}/change-password`, {
                old_password: currentPassword,
                new_password: newPassword,
                new_password_confirmation: confirmPassword,
            });

            if (response.status === 200) {
                Alert.alert('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
                
                // เคลียร์ค่า
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                
                // กลับไปหน้าหลักทันที
                setSettingsView('main'); 
            }

        } catch (error) {
            console.error("Change password error:", error);
            
            // จัดการข้อความ Error ให้ครอบคลุม
            let msg = "ไม่สามารถเปลี่ยนรหัสผ่านได้";
            
            if (error.response) {
                // Server ตอบกลับมา (4xx, 5xx)
                msg = error.response.data?.message || msg;
            } else if (error.request) {
                // เชื่อมต่อไม่ได้
                msg = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต";
            } else {
                // Error อื่นๆ ของ JS
                msg = error.message;
            }

            Alert.alert('เกิดข้อผิดพลาด', msg);

        } finally {
            setIsChangingPassword(false);
        }
    };

    // ฟังก์ชันเริ่มต้นการขอความช่วยเหลือฉุกเฉิน
    // --- SOS Submission Logic (หัวใจสำคัญ) ---
    const startSOS = async () => {
        if (isSubmitting || !authState?.token) return;

        // 1. เช็คเน็ตก่อนเลย
        if (!isConnected) {
            triggerHaptic('notificationError');
            Alert.alert(
                "ไม่มีการเชื่อมต่อ",
                "โทรศัพท์ของคุณไม่ได้เชื่อมต่ออินเทอร์เน็ต ระบบจะเปลี่ยนเป็นการโทรออก 1669 แทน",
                [
                    { text: "ยกเลิก", style: "cancel" },
                    { text: "โทร 1669", onPress: () => Linking.openURL('tel:1669') }
                ]
            );
            return; // หยุดการทำงาน ไม่ส่ง axios
        }

        setIsSubmitting(true);
        triggerHaptic('impactMedium');

        const source = axios.CancelToken.source();
        const timeout = setTimeout(() => {
            source.cancel('Timeout');
            Alert.alert(
                "การเชื่อมต่อล่าช้า", 
                "ไม่สามารถส่งพิกัดผ่านอินเทอร์เน็ตได้ในขณะนี้ กรุณาโทร 1669 ทันที",
                [{ text: "โทรเลย", onPress: () => Linking.openURL('tel:1669') }]
            );
        }, 8000); // ถ้า 8 วิยังส่งไม่ได้ ให้ตัดไปโทรเลย

        try {
            // เตรียมข้อมูล Payload ที่จะส่ง
            const emergencyPayload = {
                latitude: currentLocation?.latitude,
                longitude: currentLocation?.longitude,
                current_address: address,
                distance_to_hospital: distance,
                patient_name: user?.name,
                emergency_type: 'ACS_FAST_TRACK',
            };
          
            // ส่งข้อมูลผ่าน Axios ไปยัง Laravel Server
            const response = await axios.post(`${API_URL}/user_location`, emergencyPayload, {
                cancelToken: source.token
            });
            clearTimeout(timeout);
                
            if (response.status === 200 || response.status === 201) {
                // เมื่อส่งสำเร็จ เปลี่ยนสถานะหน้าจอเพื่อเริ่มนับถอยหลัง
                const emergencyId = response.data?.data?.patient_id || response.data?.patient_id;
                console.log("Emergency request created with ID:", emergencyId);
                setActiveEmergencyId(emergencyId);
                
                setIsCalling(true);
                setSecondsLeft(calculateTravelTime(distance));
                triggerHaptic('notificationSuccess');
            }
      
        } catch (error) {
        clearTimeout(timeout);
        if (axios.isCancel(error)) return; // กรณีถูกยกเลิกด้วย Timeout
        triggerHaptic('notificationError');
        console.error("Emergency call failed:", error.response?.data || error.message);
        Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถส่งพิกัดได้ กรุณาโทร 1669 ทันที");
        // แจ้งเตือนผู้ใช้กรณีส่งพิกัดไม่สำเร็จ
        } finally {
        setIsSubmitting(false);
        setPressProgress(0);
        setIsPressing(false);
        }
    };

     // --- [NEW] Cancel SOS Logic ---
    const handleCancelSOS = async () => {
        Alert.alert(
            "ยืนยันการยกเลิก",
            "คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการขอความช่วยเหลือ? ทีมกู้ชีพอาจกำลังเดินทางมาหาคุณ",
            [
                { text: "ไม่ยกเลิก", style: "cancel" },
                {
                    text: "ยืนยันยกเลิก",
                    style: "destructive",
                    onPress: async () => {
                        // กรณีไม่มี ID รายการฉุกเฉิน (เช่น เน็ตช้าตอนส่งครั้งแรก หรือแอปยังโหลด ID ไม่เสร็จ)
                        if (!activeEmergencyId) {
                            setIsCalling(false);
                            setSecondsLeft(0);
                            Alert.alert("รีเซ็ตสถานะ", "ไม่พบข้อมูลรายการเรียกในเครื่อง ระบบได้ทำการล้างหน้าจอให้คุณแล้ว หากคุณยังต้องการความช่วยเหลือกรุณาโทร 1669");
                            return;
                        }

                        setIsSubmitting(true);
                        try {
                            const emergency_id = activeEmergencyId;
                            console.log("Cancelling emergency ID:", emergency_id);
                            // ส่งข้อมูลยกเลิกไปยัง Laravel (ปรับ Endpoint ตาม API ของคุณ)
                            await axios.post(`${API_URL}/emergency-requests/cancel`, {
                                emergency_id: activeEmergencyId
                            }, {
                                headers: { 'Authorization': `Bearer ${authState?.token}` }
                            });
                            
                            // ล้างสถานะเมื่อสำเร็จ
                            setActiveEmergencyId(null);
                            setIsCalling(false);
                            setSecondsLeft(0);
                            triggerHaptic('notificationSuccess');
                            Alert.alert("ยกเลิกสำเร็จ", "รายการขอความช่วยเหลือของคุณถูกยกเลิกแล้ว");
                        } catch (error) {
                            console.error("Cancel SOS error:", error.response?.status, error.response?.data);
                            
                            // UX Fallback: แม้ Server จะผิดพลาด (เช่น 404) แต่ควรให้ผู้ป่วยออกจากหน้านี้ได้
                            Alert.alert(
                                "แจ้งเตือน", 
                                "ไม่สามารถแจ้งยกเลิกไปยังศูนย์ระบบได้ (อาจเนื่องจากรายการถูกปิดไปแล้ว) ระบบจะทำการรีเซ็ตหน้าจอให้คุณ",
                                [{ text: "ตกลง", onPress: () => {
                                    setIsCalling(false);
                                    setSecondsLeft(0);
                                    setActiveEmergencyId(null);
                                }}]
                            );
                        } finally {
                            setIsSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    // --- Haptic & Animation Logic ---

    const handlePressIn = () => {
        if (isCalling) return;
            setIsPressing(true);
            triggerHaptic('impactMedium'); 
            Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start();
        const start = Date.now();
        timerRef.current = setInterval(() => {
        const elapsed = Date.now() - start;
        const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
        setPressProgress(progress);
        if (Math.floor(progress) % 25 === 0 && progress > 0 && progress < 100) triggerHaptic('selection');
        if (progress >= 100) {
            clearInterval(timerRef.current);
            startSOS();
        }
        }, 16);
    };

    const handlePressOut = () => {
        setIsPressing(false);
        clearInterval(timerRef.current);
        Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();
        if (pressProgress < 100) setPressProgress(0);
    };

    // --- Effects --- 
    // แอนิเมชันจุดเขียวกระพริบ (Live Status)
    // [FIX] เพิ่ม token ลงใน dependency array เพื่อให้ทำงานทันทีที่ Token โหลดมาเสร็จ
    useEffect(() => {
        const initData = async () => {
            setLoading(true);
            if (authState?.token) {
                await loadUser();
            }
            // await requestLocationPermission();
            setLoading(false);
        };
        initData();
        return () => { if (watchSubscription.current) watchSubscription.current.remove(); };
    }, [authState?.token]);

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        );
        if (!isPressing && !isCalling && !isSubmitting) pulse.start();
        else { pulse.stop(); pulseAnim.setValue(1); }
        return () => pulse.stop();
    }, [isPressing, isCalling, isSubmitting]);

    useEffect(() => {
        if (isCalling && secondsLeft > 0) {
        countdownRef.current = setInterval(() => setSecondsLeft(p => p - 1), 1000);
        }
        return () => clearInterval(countdownRef.current);
    }, [isCalling, secondsLeft]);

    // ป้องกัน Error ตอนคำนวณ Region ของแผนที่
    const mapRegion = useMemo(() => {
        if (!currentLocation || !currentLocation.latitude) return null;
        return {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        };
    }, [currentLocation]);

    // Auto Fit Map
    useEffect(() => {
        if (showInAppMap && currentLocation && mapRef.current) {
            mapRef.current.fitToCoordinates(
                [
                    { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
                    { latitude: HOSPITAL_COORDS.latitude, longitude: HOSPITAL_COORDS.longitude }
                ],
                {
                    edgePadding: { top: 100, right: 50, bottom: 100, left: 50 }, // เว้นระยะขอบเพื่อให้เห็น Marker ชัดเจน
                    animated: true,
                }   
            );
        }
    }, [currentLocation, showInAppMap]);

    // Biometric Logic with AsyncStorage ---
    useEffect(() => {
        const loadBiometricPreference = async () => {
            try {
                const savedPreference = await AsyncStorage.getItem('use_biometric');
                if (savedPreference !== null) {
                    setBiometricPermission(savedPreference === 'true');
                }
            } catch (error) {
                console.log('Error loading biometric preference:', error);
            }
        };
        loadBiometricPreference();
    }, []);

    // Notification Listeners & Handlers
    useEffect(() => {
        notificationListRef.current = notificationList;
    }, [notificationList]);

    useEffect(() => {
        // 1. ฟังก์ชันจัดการเมื่อได้รับ Notification
        const handleNewNotification = (notification) => {
            const content = notification.request.content;
            const identifier = notification.request.identifier; // ✅ ใช้ ID จริงจากระบบ (แก้ตรงนี้)

            // เช็คก่อนว่ามี ID นี้ใน list หรือยัง? ถ้ามีแล้ว "ไม่เพิ่มซ้ำ"
            const isDuplicate = notificationListRef.current.some(n => n.id === identifier);
            if (isDuplicate) return; 

            const now = new Date();
            const timeString = now.toLocaleDateString('th-TH', {
                year: '2-digit', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            }) + ' น.';

            const newNotif = {
                id: identifier, // ✅ ใช้ ID จริงแทน Date.now()
                type: content.data?.type || 'info',
                title: content.title || 'การแจ้งเตือนใหม่',
                body: content.body || '',
                time: timeString,
                read: false
            };
            
            setNotificationList(prev => [newNotif, ...prev]);
            setHasUnread(true);
        };

        // 2. Listener ตอนแอปเปิดอยู่ (Foreground)
        const receivedSub = Notifications.addNotificationReceivedListener(notification => {
            handleNewNotification(notification);
        });

        // 3. Listener ตอนกด Notification (Response)
        const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
            const content = response.notification.request.content;
            const identifier = response.notification.request.identifier; // ✅ ใช้ ID จริง

            const currentList = notificationListRef.current;
            
            // หาว่ามีรายการนี้อยู่แล้วไหม
            const existingIndex = currentList.findIndex(n => n.id === identifier);
            
            let newList;

            if (existingIndex !== -1) {
                // A. ถ้ามีอยู่แล้ว -> แค่อัปเดตสถานะเป็น "อ่านแล้ว" (ไม่เพิ่มใหม่)
                newList = [...currentList];
                newList[existingIndex] = { ...newList[existingIndex], read: true };
            } else {
                // B. ถ้ายังไม่มี (เช่น มาจากตอนปิดแอป) -> สร้างใหม่โดยใช้ ID จริง
                const now = new Date();
                const timeString = now.toLocaleDateString('th-TH', {
                    year: '2-digit', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: false
                }) + ' น.';

                const tappedNotif = {
                    id: identifier, // ✅ ใช้ ID จริง
                    type: content.data?.type || 'info',
                    title: content.title || 'การแจ้งเตือนใหม่',
                    body: content.body || '',
                    time: timeString,
                    read: true 
                };
                newList = [tappedNotif, ...currentList];
            }

            // อัปเดต State และส่งไปหน้าถัดไป
            setNotificationList(newList);
            setHasUnread(false);
            
            navigation.navigate('Notifications', { 
                notifications: newList,
                initialId: identifier // ส่ง ID ของตัวที่ถูกกดไป
            });
        });

        return () => {
            receivedSub.remove();
            responseSub.remove();
        };
    }, []);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('notificationRead', (readId) => {
            console.log("Receive Read Signal ID:", readId);

            setNotificationList(prevList => {
                // 1. สร้างลิสต์ใหม่ที่อัปเดตสถานะอ่านแล้ว
                const newList = prevList.map(n => n.id === readId ? { ...n, read: true } : n);
                
                // อัปเดต Ref ให้ตรงกัน
                notificationListRef.current = newList; 
                
                // 2. เช็คจาก newList (ข้อมูลล่าสุด)
                // เช็คว่ามีตัวไหนที่ยังไม่อ่านเหลืออยู่ไหม
                const stillHasUnread = newList.some(n => !n.read);
                
                // อัปเดตจุดแดง: จะขึ้นแดงก็ต่อเมื่อ (มีข้อมูล และ มีตัวที่ยังไม่อ่าน)
                setHasUnread(newList.length > 0 && stillHasUnread);
                
                return newList;
            });
        });

        return () => {
            subscription.remove();
        };
    }, []);

    // ตรวจสอบสถานะการเชื่อมต่อเครือข่าย
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected && state.isInternetReachable);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const manageLocationTracking = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setAddress('กรุณาอนุญาตการเข้าถึงตำแหน่ง');
                return;
            }

            // สลับโหมดการติดตาม
            if (isCalling) {
                console.log("📍 Switch to Emergency Tracking Mode (High Accuracy)");
                await startLocationTracking('emergency');
            } else {
                console.log("🍃 Switch to Normal Tracking Mode (Battery Saving)");
                await startLocationTracking('normal');
            }
        };

        manageLocationTracking();

        // Cleanup: เมื่อ component ถูกทำลาย (ปิดหน้า) ให้หยุดติดตาม
        return () => {
            if (watchSubscription.current) {
                watchSubscription.current.remove();
            }
        };
    }, [isCalling]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (
                appState.current.match(/inactive|background/) && 
                nextAppState === 'active'
            ) {
                // แอปกลับมาทำงาน (Foreground) -> เริ่มติดตามใหม่
                console.log('App has come to the foreground!');
                startLocationTracking(isCalling ? 'emergency' : 'normal');
            } else if (nextAppState.match(/inactive|background/)) {
                // แอปถูกพับจอ -> ถ้าไม่ฉุกเฉิน ให้หยุดติดตามเพื่อประหยัดแบต
                if (!isCalling && watchSubscription.current) {
                    console.log('App going to background -> Stop GPS');
                    watchSubscription.current.remove();
                    watchSubscription.current = null;
                }
            }

            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [isCalling]);

    const strokeDashoffset = circumference - (pressProgress / 100) * circumference;

    //  Helper เลือกไอคอนและสีตามประเภท
    const getNotifIcon = (type) => {
        switch (type) {
            case 'emergency': return { icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2' };
            case 'appointment': return { icon: Calendar, color: '#3B82F6', bg: '#EFF6FF' };
            case 'manual_announcement': return { icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB' }; // เพิ่มสีส้มสำหรับประกาศ
            case 'info': 
            default: return { icon: FileHeart, color: '#10B981', bg: '#F0FDF4' };
        }
    };

     const renderPasswordSettings = () => (
                    <>
                        <View style={styles.formGroup}>
                            <AppText style={styles.inputLabel}>รหัสผ่านปัจจุบัน</AppText>
                            <View style={styles.passwordContainer}>
                                <TextInput 
                                    style={styles.passwordInput} 
                                    secureTextEntry={!showCurrentPassword}
                                    placeholder="กรอกรหัสผ่านปัจจุบัน" 
                                    placeholderTextColor="#94A3B8" 
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                />
                                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeIcon}>
                                    {showCurrentPassword ? <EyeOff size={20} color="#94A3B8" /> : <Eye size={20} color="#94A3B8" />}
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.formGroup}>
                            <AppText style={styles.inputLabel}>รหัสผ่านใหม่</AppText>
                            <View style={styles.passwordContainer}>
                                <TextInput 
                                    style={styles.passwordInput} 
                                    secureTextEntry={!showNewPassword}
                                    placeholder="กรอกรหัสผ่านใหม่" 
                                    placeholderTextColor="#94A3B8" 
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                />
                                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeIcon}>
                                    {showNewPassword ? <EyeOff size={20} color="#94A3B8" /> : <Eye size={20} color="#94A3B8" />}
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.formGroup}>
                            <AppText style={styles.inputLabel}>ยืนยันรหัสผ่านใหม่</AppText>
                            <View style={styles.passwordContainer}>
                                <TextInput 
                                    style={styles.passwordInput} 
                                    secureTextEntry={!showConfirmPassword}
                                    placeholder="กรอกรหัสผ่านใหม่ซ้ำอีกครั้ง" 
                                    placeholderTextColor="#94A3B8" 
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                                    {showConfirmPassword ? <EyeOff size={20} color="#94A3B8" /> : <Eye size={20} color="#94A3B8" />}
                                </TouchableOpacity>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={[styles.saveButton, isChangingPassword && { opacity: 0.7 }]} 
                            onPress={handleChangePassword}
                            disabled={isChangingPassword}
                        >
                             {isChangingPassword ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <AppText style={styles.saveButtonText}>บันทึกการเปลี่ยนแปลง</AppText>
                            )}
                        </TouchableOpacity>
                    </>
        );
       
    // SettingsNavigation
    const SettingsNavigation = ({ 
        currentView, 
        onChangeView, 
        onClose, 
        user, 
        authenticateUser, 
        navigation, 
        onLogout, 
        fontScale = 1,
        changeFontScale,
        renderPasswordForm
    }) => {
        
            // Animation Config
            const isMain = currentView === 'main';
            const mainEntering = SlideInLeft.duration(350);
            const mainExiting = SlideOutLeft.duration(350);
            const subEntering = SlideInRight.duration(350);
            const subExiting = SlideOutRight.duration(350);

            // กำหนดความสูง Header เพื่อใช้คำนวณ Padding
            const HEADER_HEIGHT = 80;

            // --- Header Component (ใช้ Absolute Position) ---
            const Header = ({ title, showBack }) => (
                <View style={{
                    position: 'absolute', // ✅ ตรึงตำแหน่ง
                    top: 0,
                    left: 0,
                    right: 0,
                    height: HEADER_HEIGHT,
                    zIndex: 999,          // ✅ ลอยอยู่ชั้นบนสุด
                    backgroundColor: 'white', 
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 20,
                    paddingVertical: 15,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F1F5F9',
                }}>
                    <View style={{ width: 40, alignItems: 'flex-start' }}>
                        {showBack && (
                            <TouchableOpacity onPress={() => onChangeView('main')} style={styles.headerBackButton} hitSlop={{top:15, bottom:15, left:15, right:15}}>
                                <ChevronLeft size={24 * fontScale} color="#1E293B" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <AppText style={[styles.modalTitle, { fontSize: 20 * fontScale }]}>{title}</AppText>
                    </View>
                    <View style={{ width: 40, alignItems: 'flex-end' }}>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseIcon} hitSlop={{top:15, bottom:15, left:15, right:15}}>
                            <X size={24 * fontScale} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>
            );

            // 1. หน้าหลัก (Main Menu)
            if (currentView === 'main') {
                return (
                    <Animated.View key="main" entering={mainEntering} exiting={mainExiting} style={{ flex: 1, position: 'relative' }}>
                        {/* ScrollView อยู่ด้านหลัง */}
                        <BottomSheetScrollView 
                            contentContainerStyle={{ 
                                paddingHorizontal: 20, 
                                paddingTop: HEADER_HEIGHT + 10, 
                                paddingBottom: 30, // เผื่อพื้นที่ให้ปุ่ม Logout ด้านล่าง
                                flexGrow: 1
                            }}
                        >
                            <AppText style={[styles.menuGroupTitle, { fontSize: 12 * fontScale }]}>บัญชีของฉัน</AppText>
                            <View style={styles.menuGroupContainer}>
                                <LineMenuItem fontScale={fontScale} icon={UserCircle} color="#3B82F6" label="ข้อมูลส่วนตัว" onPress={() => authenticateUser(() => { onClose(); navigation.navigate('Profile'); })} />
                                <View style={styles.separator} />
                                <LineMenuItem fontScale={fontScale} icon={Key} color="#F59E0B" label="เปลี่ยนรหัสผ่าน" onPress={() => onChangeView('password')} />
                            </View>

                            <AppText style={[styles.menuGroupTitle, { fontSize: 12 * fontScale }]}>การตั้งค่าแอป</AppText>
                            <View style={styles.menuGroupContainer}>
                                <LineMenuItem fontScale={fontScale} icon={Type} color="#8B5CF6" label="ขนาดตัวอักษร" onPress={() => onChangeView('font')} />
                                <View style={styles.separator} />
                            </View>

                            <AppText style={[styles.menuGroupTitle, { fontSize: 12 * fontScale }]}>ความช่วยเหลือ</AppText>
                            <View style={styles.menuGroupContainer}>
                                <LineMenuItem fontScale={fontScale} icon={PhoneCall} color="#EF4444" label="ติดต่อโรงพยาบาล" onPress={() => onChangeView('contact')} />
                                <View style={styles.separator} />
                                <LineMenuItem fontScale={fontScale} icon={FileText} color="#64748B" label="นโยบายความเป็นส่วนตัว" onPress={() => onChangeView('privacy')} />
                                <View style={styles.separator} />
                                <LineMenuItem fontScale={fontScale} icon={InfoIcon} color="#64748B" label="เกี่ยวกับแอป" onPress={() => onChangeView('about')} />
                            </View>

                            <TouchableOpacity style={[styles.lineLogoutButton, { marginBottom: 40 }]} onPress={() => { onClose(); onLogout(); }}>
                                <AppText style={[styles.lineLogoutText, { fontSize: 15 * fontScale }]}>ออกจากระบบ</AppText>
                            </TouchableOpacity>
                        </BottomSheetScrollView>

                        {/* Header วางทับอยู่ด้านหน้า */}
                        <Header title="ตั้งค่า" showBack={false} />
                    </Animated.View>
                );
            }

            // 2. หน้าเปลี่ยนรหัสผ่าน
            if (currentView === 'password') {
                return (
                    <Animated.View key="password" entering={subEntering} exiting={subExiting} style={{ flex: 1, position: 'relative' }}>
                        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, paddingTop: HEADER_HEIGHT + 20 }}>
                            {renderPasswordForm()}
                        </BottomSheetScrollView>
                        <Header title="เปลี่ยนรหัสผ่าน" showBack={true} />
                    </Animated.View>
                );
            }

            // 3. หน้าขนาดตัวอักษร
            if (currentView === 'font') {
                return (
                    <Animated.View key="font" entering={subEntering} exiting={subExiting} style={{ flex: 1, position: 'relative' }}>
                        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, paddingTop: HEADER_HEIGHT + 20, flexGrow: 1 }}>
                            <View style={{ padding: 20, backgroundColor: '#F8FAFC', borderRadius: 16, marginBottom: 30, alignItems: 'center', minHeight: 120, justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}>
                                <AppText style={{ fontSize: 16 * fontScale }}>ตัวอย่างข้อความ</AppText>
                                <AppText style={{ fontSize: 14 * fontScale, color: '#64748B', marginTop: 8 }}>ขนาดปัจจุบัน</AppText>
                            </View>
                            <View style={{ gap: 12 }}>
                                {[
                                    { l: 'เล็ก (16)', s: 1, i: 'A', fs: 16 },
                                    { l: 'กลาง (20)', s: 1.25, i: 'A', fs: 20, b: true },
                                    { l: 'ใหญ่ (24)', s: 1.5, i: 'A', fs: 24, b: true, w: '900' }
                                ].map((opt, idx) => (
                                    <TouchableOpacity 
                                        key={idx}
                                        style={[styles.fontSizeOption, fontScale === opt.s && styles.fontSizeOptionActive]}
                                        onPress={() => changeFontScale(opt.s)}
                                    >
                                        <AppText style={{ fontSize: opt.fs, fontWeight: opt.w || 'normal', color: fontScale === opt.s ? 'white' : '#1E293B' }}>{opt.i}</AppText>
                                        <AppText style={[styles.fontSizeLabel, { color: fontScale === opt.s ? 'white' : '#1E293B', fontSize: 16 * fontScale }]}>{opt.l}</AppText>
                                        {fontScale === opt.s && <Check size={20} color="white" />}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </BottomSheetScrollView>
                        <Header title="ขนาดตัวอักษร" showBack={true} />
                    </Animated.View>
                );
            }

            // 4. หน้าติดต่อเรา
            if (currentView === 'contact') {
                return (
                    <Animated.View key="contact" entering={subEntering} exiting={subExiting} style={{ flex: 1, position: 'relative' }}>
                        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, paddingTop: HEADER_HEIGHT + 20 }}>
                            <View style={styles.contactCard}>
                                <PhoneCall size={32 * fontScale} color="#EF4444" style={{marginBottom: 10}} />
                                <AppText style={[styles.contactTitle, { fontSize: 18 * fontScale }]}>รพ.ค่ายกฤษณ์สีวะรา</AppText>
                                <AppText style={[styles.contactSubtitle, { fontSize: 14 * fontScale }]}>แผนกฉุกเฉิน 24 ชั่วโมง</AppText>
                                <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL('tel:0647906014')}>
                                    <AppText style={[styles.callButtonText, { fontSize: 15 * fontScale }]}>โทร 064-7906014</AppText>
                                </TouchableOpacity>
                                
                            </View>
                        </BottomSheetScrollView>
                        <Header title="ติดต่อโรงพยาบาล" showBack={true} />
                    </Animated.View>
                );
            }

            // ค้นหาส่วนนี้ใน HomeScreen.tsx แล้วแทนที่ด้วยโค้ดด้านล่างนี้ครับ
            if (currentView === 'privacy') {
                return (
                    <Animated.View 
                        key="privacy" 
                        entering={subEntering} 
                        exiting={subExiting} 
                        style={{ flex: 1 }} // ลบ position: 'relative' ออกเพื่อให้จัดการง่ายขึ้น
                    >
                        {/* ✅ 1. ย้าย Header มาไว้บรรทัดแรก เพื่อไม่ให้ทับซ้อนเลเยอร์การสัมผัส */}
                        <Header title="นโยบายความเป็นส่วนตัว" showBack={true} />

                        {/* ✅ 2. ใช้ BottomSheetScrollView โดยกำหนดสไตล์ให้ชัดเจน */}
                    <BottomSheetScrollView 
                            // ✅ สำหรับ Android: ระบุ flex: 1 ให้ชัดเจนที่สไตล์หลัก
                            style={{ flex: 1 }} 
                            contentContainerStyle={{ 
                                paddingHorizontal: 20, 
                                // ✅ ใช้ค่าคงที่ HEADER_HEIGHT + พื้นที่เว้นว่าง
                                paddingTop: HEADER_HEIGHT + 20, 
                                paddingBottom: 30, 
                                flexGrow: 1 
                            }}
                            // ✅ สำหรับ Android: ป้องกันไม่ให้ BottomSheet แย่งคำสั่งเลื่อนนิ้วแนวตั้ง
                            nestedScrollEnabled={true} 
                            // ✅ สำหรับ Android: ปรับค่าการสัมผัสให้ไวขึ้น
                            activeOffsetY={[-5, 5]} 
                        >
                            {/* ส่วนหัวเนื้อหา */}
                            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                <ShieldCheck size={48 * fontScale} color="#10B981" />
                                <AppText style={[styles.contactTitle, { fontSize: 20 * fontScale, marginTop: 10 }]}>
                                    นโยบายความเป็นส่วนตัว
                                </AppText>
                                <AppText style={[styles.contactSubtitle, { fontSize: 13 * fontScale }]}>
                                    ปรับปรุงล่าสุด: 15 มกราคม 2569
                                </AppText>
                            </View>

                            {/* ส่วนกล่องเนื้อหา (ตรวจสอบ styles.privacyContentBox ว่าไม่มีการใส่ height ตายตัว) */}
                            <View style={styles.privacyContentBox}>
                                <AppText style={[styles.privacySectionTitle, { fontSize: 16 * fontScale }]}>1. การเก็บรวบรวมข้อมูล</AppText>
                                <AppText style={[styles.privacyBody, { fontSize: 14 * fontScale }]}>
                                    แอปพลิเคชันจะจัดเก็บข้อมูลที่จำเป็นต่อการช่วยชีวิต ได้แก่ ชื่อ-นามสกุล, หมายเลขโทรศัพท์, ข้อมูลสิทธิการรักษา (HN) และข้อมูลสุขภาพเบื้องต้นที่เกี่ยวข้องกับโรคหลอดเลือดหัวใจ
                                </AppText>

                                <AppText style={[styles.privacySectionTitle, { fontSize: 16 * fontScale, marginTop: 15 }]}>2. ข้อมูลตำแหน่ง (Location Data)</AppText>
                                <AppText style={[styles.privacyBody, { fontSize: 14 * fontScale }]}>
                                    ในกรณีฉุกเฉิน แอปพลิเคชันจะเข้าถึงข้อมูลพิกัดดาวเทียม (GPS) ของคุณเพื่อส่งให้ทีมแพทย์ทราบตำแหน่งที่ชัดเจนสำหรับการเข้าช่วยเหลืออย่างเร่งด่วน แม้ในขณะที่แอปพลิเคชันทำงานอยู่เบื้องหลัง
                                </AppText>

                                <AppText style={[styles.privacySectionTitle, { fontSize: 16 * fontScale, marginTop: 15 }]}>3. การรักษาความปลอดภัย</AppText>
                                <AppText style={[styles.privacyBody, { fontSize: 14 * fontScale }]}>
                                    ข้อมูลของคุณจะถูกจัดเก็บตามมาตรฐานความปลอดภัยทางคอมพิวเตอร์ และจำกัดการเข้าถึงเฉพาะเจ้าหน้าที่ทางการแพทย์ที่เกี่ยวข้องของ รพ.ค่ายกฤษณ์สีวะรา เท่านั้น
                                </AppText>

                                <AppText style={[styles.privacySectionTitle, { fontSize: 16 * fontScale, marginTop: 15 }]}>4. การเปิดเผยข้อมูล</AppText>
                                <AppText style={[styles.privacyBody, { fontSize: 14 * fontScale }]}>
                                    เราจะไม่มีการนำข้อมูลส่วนบุคคลของคุณไปจำหน่ายหรือเผยแพร่แก่บุคคลภายนอก เว้นแต่จะเป็นการส่งต่อข้อมูลเพื่อส่งต่อการรักษา (Refer) ระหว่างสถานพยาบาลตามระเบียบของกระทรวงสาธารณสุข
                                </AppText>
                                
                                {/* เพิ่มข้อความเพื่อทดสอบความยาว */}
                                <AppText style={[styles.privacySectionTitle, { fontSize: 16 * fontScale, marginTop: 15 }]}>5. การติดต่อ</AppText>
                                <AppText style={[styles.privacyBody, { fontSize: 14 * fontScale }]}>
                                    หากท่านมีข้อสงสัยเกี่ยวกับนโยบายความเป็นส่วนตัวนี้ ท่านสามารถติดต่อเจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคลของโรงพยาบาลได้ตามช่องทางที่ระบุในหน้าติดต่อ
                                </AppText>
                            </View>
                        </BottomSheetScrollView>
                    </Animated.View>
                );
            }

            if (currentView === 'about') {
                return (
                    <Animated.View key="about" entering={subEntering} exiting={subExiting} style={{ flex: 1, position: 'relative' }}>
                        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, paddingTop: HEADER_HEIGHT + 20 }}>
                            <View style={styles.aboutContainer}>
                                <View style={styles.logoCircle}><Heart size={24} color="white" fill="white" /></View>
                                <AppText style={styles.aboutAppName}>KSVR ACS Fasttrack</AppText>
                                <AppText style={styles.aboutVersion}>Version 1.0.0</AppText>
                                <AppText style={styles.aboutDesc}>แอปพลิเคชันสำหรับแจ้งเหตุฉุกเฉินผู้ป่วยโรคหัวใจและหลอดเลือด โรงพยาบาลค่ายกฤษณ์สีวะรา จังหวัดสกลนคร</AppText>
                            </View>
                        </BottomSheetScrollView>
                        <Header title="เกี่ยวกับแอปพลิเคชัน" showBack={true} />
                    </Animated.View>
                );
            }

    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <View style={styles.loadingIconContainer}>
                    <Heart size={80} color="#EF4444" fill="#FEF2F2" strokeWidth={1.5} />
                </View>
                <ActivityIndicator size="large" color="#EF4444" style={{ marginBottom: 20 }} />
                <AppText style={styles.loadingTitle}>KSVR ACS</AppText>
                <AppText style={styles.loadingText}>กำลังเตรียมระบบ...</AppText>
            </View>
        );
    }
 
    

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <StatusBar barStyle="dark-content" />
                
                {/* ... (Header ส่วนเดิม) ... */}
                <View style={styles.headerBar}>
                    {/* (คงเดิมไว้) */}
                    <View style={styles.logoContainer}>
                        <View style={styles.logoCircle}><Heart size={16} color="white" fill="white" /></View>
                        <AppText style={styles.appNameText}>KSVR <AppText style={styles.appNameLight}>ACS FAST TRACK</AppText></AppText>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                         <TouchableOpacity
                            style={styles.settingsIconButton}
                            onPress={() => {navigation.navigate('Notifications', {notifications: notificationList});
                                setHasUnread(false);
                            }}
                        >
                            <Bell size={20} color="#94A3B8" />
                            {hasUnread && <View style={styles.notificationBadge} />}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.settingsIconButton} onPress={() => { setSettingsView('main'); settingsSheetRef.current?.present(); }}>
                            <Settings size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EF4444']} />}
                >
                    <View style={{ flex: 1, paddingBottom: 10 }}>
                        
                        {/* --- Redesigned Main Card --- */}
                        <View style={styles.unifiedCard}>
                            {/* Profile Section */}
                            <TouchableOpacity 
                                style={styles.profileHeaderSection}
                                onPress={() => authenticateUser(() => navigation.navigate('Profile'))}
                                activeOpacity={0.8}
                            >
                                {/* Row 1: Avatar, Name, HN */}
                                <View style={styles.profileRow}>
                                        <View style={styles.avatarContainerMain}>
                                        <View style={styles.avatarCircleMain}>
                                            {user?.picture_profile && !imageLoadError ? (
                                                <Image 
                                                    source={{ uri: `https://ksvrhospital.go.th/krit-siwara_smart_heart/files/avatars/${user.picture_profile}` }}
                                                    style={{ width: '100%', height: '100%', borderRadius: 30 }}
                                                    resizeMode="cover"
                                                    onError={() => setImageLoadError(true)}
                                                />
                                            ) : (
                                                <User size={30} color="#FFFFFF" />
                                            )}
                                        </View>
                                        <View style={styles.onlineBadgeMain} />
                                        </View>
                                        <View style={styles.greetingContainer}>
                                            <AppText style={styles.greetingText}>สวัสดี,</AppText>
                                            <AppText style={styles.patientNameMain} numberOfLines={1}>{user?.name || 'ผู้ใช้งาน'}</AppText>
                                            <View style={styles.hnTag}>
                                            <AppText style={styles.hnTagLabel}>HN</AppText>
                                            <AppText style={styles.hnTagValue}>{user?.hn || user?.username || '-'}</AppText>
                                            </View>
                                        </View>
                                        <View style={styles.profileChevron}>
                                            <ChevronRight size={20} color="#94A3B8" />
                                        </View>
                                </View>
                            </TouchableOpacity>
                            <View style={styles.sectionDivider} />
                            <TouchableOpacity 
                                onPress={openInMaps} 
                                activeOpacity={0.9} 
                                style={styles.locationBoxMain}
                            >
                                <View style={styles.locationContentContainer}>
                                    <View style={{ flexDirection: 'row' }}>
                                        <View style={styles.mapIconBadge}>
                                            <MapPin size={20} color="#FFFFFF" />
                                        </View>
                                        <View style={{ flex: 1, justifyContent: 'center' }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                                <AppText style={styles.locationLabelMain}>ตำแหน่งของคุณ</AppText>
                                                {isLocationLive && (
                                                    <View style={styles.liveBadgeSmall}>
                                                        <Animated.View style={[styles.liveDotSmall, { opacity: blinkAnim }]} />
                                                        <AppText style={styles.liveTextSmall}>LIVE</AppText>
                                                    </View>
                                                )}
                                            </View>
                                            <AppText style={styles.addressTextMain} numberOfLines={2}>{address}</AppText>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Interactive Area (SOS) */}
                        <View style={styles.mainInteractiveArea}>
                            {!isCalling ? (
                                <>
                                    <View style={styles.headerTextContainer}>
                                        <AppText style={styles.title}>ขอความช่วยเหลือ</AppText>
                                        
                                        {/* --- [แก้ไขจุดที่ 3] เพิ่มข้อความ รพ. + ระยะทาง + เวลา --- */}
                                        <View style={styles.hospitalInfoBox}>
                                            <AppText style={styles.hospitalNameText}>{HOSPITAL_COORDS.name}</AppText>
                                            <View style={styles.tripInfoRow}>
                                                <View style={styles.tripInfoTag}>
                                                    <MapPin size={12} color="#64748B" />
                                                    <AppText style={styles.tripInfoText}> ห่าง {distance} กม.</AppText>
                                                </View>
                                                <View style={styles.tripInfoDivider} />
                                                <View style={styles.tripInfoTag}>
                                                    {/* ใช้ icon Zap หรือ Clock สื่อถึงเวลา */}
                                                    <Zap size={12} color="#F59E0B" fill="#F59E0B" /> 
                                                    <AppText style={[styles.tripInfoText, { color: '#D97706' }]}>
                                                        {/* คำนวณเวลาเดินทาง (สมมติ speed 60km/h หรือ logic เดิม) */}
                                                        {' '}ถึงใน ~{Math.ceil(calculateTravelTime(distance)/60)} นาที
                                                    </AppText>
                                                </View>
                                            </View>
                                        </View>
                                        {/* --------------------------------------------------- */}

                                    </View>

                                    <View style={styles.sosWrapper}>
                                        {/* ... (SVG และปุ่ม SOS คงเดิม) ... */}
                                        <Svg width={240} height={240} style={styles.svg}>
                                            <Circle cx="120" cy="120" r="110" stroke="#FEE2E2" strokeWidth={4} fill="transparent" />
                                            <Circle cx="120" cy="120" r="110" stroke="#EF4444" strokeWidth={4} fill="transparent" strokeDasharray={2 * Math.PI * 110} strokeDashoffset={2 * Math.PI * 110 - (pressProgress / 100) * (2 * Math.PI * 110)} strokeLinecap="round" />
                                        </Svg>
                                        <Animated.View style={{ transform: [{ scale: isPressing ? scaleAnim : pulseAnim }] }}>
                                            <TouchableOpacity 
                                                activeOpacity={1} 
                                                onPressIn={handlePressIn} 
                                                onPressOut={handlePressOut} 
                                                disabled={isSubmitting}
                                                style={[styles.sosButton, isPressing && styles.sosButtonActive, isSubmitting && styles.sosButtonDisabled]}
                                            >
                                                {isSubmitting ? <ActivityIndicator size="large" color="white" /> : (
                                                    <><Heart size={56} color="white" fill="white" /><Text style={styles.sosText}>ฉุกเฉิน</Text></>
                                                )}
                                            </TouchableOpacity>
                                        </Animated.View>
                                    </View>
                                    <AppText style={styles.holdText}>กดค้าง 1 วินาที เพื่อขอความช่วยเหลือ</AppText>

                                    <TouchableOpacity 
                                        style={styles.directCallButton} 
                                        onPress={() => Linking.openURL('tel:1669')}
                                        activeOpacity={0.7}
                                    >
                                        <Phone size={16} color="#EF4444" style={{ marginRight: 6 }} />
                                        <AppText style={styles.directCallText}>โทร 1669 ทันที</AppText>
                                    </TouchableOpacity>

                                    {!isConnected && (
                                        <View style={styles.offlineWarning}>
                                            <AlertTriangle size={14} color="#B45309" />
                                            <AppText style={styles.offlineText}>ไม่มีสัญญาณอินเทอร์เน็ต กรุณาใช้วิธีโทร</AppText>
                                        </View>
                                    )}
                                </>
                            ) : (
                                /* ... (ส่วน isCalling = true คงเดิม) ... */
                                <View style={styles.statusContainer}>
                                    <View style={styles.activeCard}>
                                        <View style={styles.activeCardHeader}>
                                            <View><View style={styles.liveIndicator}><View style={styles.redDot} /><AppText style={styles.liveText}>GPS Active</AppText></View><AppText style={styles.cardTitle}>กำลังมาหาคุณ</AppText></View>
                                            <View style={styles.timerBadge}><AppText style={styles.timerText}>{formatTime(secondsLeft)}</AppText><AppText style={styles.timerUnit}>นาที</AppText></View>
                                        </View>
                                        <View style={styles.cardDivider} />
                                        <View style={styles.dispatchedInfo}><Zap size={24} color="#FACC15" /><View style={{ marginLeft: 15 }}><AppText style={styles.unitTitle}>{HOSPITAL_COORDS.name}</AppText><AppText style={styles.unitSub}>เจ้าหน้าที่กำลังเดินทาง</AppText></View></View>
                                    </View>
                                    <View style={styles.checklistContainer}><AppText style={styles.checklistHeader}>ข้อปฏิบัติระหว่างรอ:</AppText>{[{ text: 'นั่งนิ่งๆ หายใจช้าๆ', bold: true }, { text: 'อมยาใต้ลิ้นทันที (ถ้ามี)', bold: true }, { text: 'ปลดกระดุมเสื้อให้หายใจสะดวก', bold: false }].map((item, i) => (<View key={i} style={styles.checkItem}><View style={[styles.checkCircle, item.bold && {borderColor: '#EF4444'}]} /><AppText style={[styles.checkText, item.bold && {fontWeight: 'bold'}]}>{item.text}</AppText></View>))}</View>
                                    <TouchableOpacity onPress={handleCancelSOS} style={styles.cancelButton} hitSlop={{ top: 20, bottom: 20, left: 50, right: 50 }} activeOpacity={0.6} disabled={isSubmitting}>
                                        {isSubmitting ? <ActivityIndicator size="small" color="#94A3B8" /> : <AppText style={styles.cancelButtonText}>ยกเลิกรายการเรียก</AppText>}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </ScrollView>
                {/* ... (Modals ส่วนที่เหลือคงเดิม) ... */}
                <BottomSheetModal
                    ref={settingsSheetRef}
                    enableContentPanningGesture={false}
                    index={0}
                    snapPoints={snapPoints}
                    enableDynamicSizing={false} 
                    backdropComponent={renderBackdrop}
                    enablePanDownToClose={true}
                    handleIndicatorStyle={{ backgroundColor: '#E2E8F0', width: 40 }}
                    backgroundStyle={{ borderRadius: 24, backgroundColor: 'white' }} 
                    onDismiss={() => setSettingsView('main')}
                >
                    {/* ✅ 2. ใส่ height: '100%' เพื่อให้เนื้อหาข้างในยืดเต็มพื้นที่ 90% นั้นเสมอ */}
                    <View style={{ flex: 1, height: '100%' }}> 
                        <SettingsNavigation 
                            currentView={settingsView}
                            onChangeView={setSettingsView}
                            onClose={() => settingsSheetRef.current?.dismiss()}
                            user={user}
                            authenticateUser={authenticateUser}
                            navigation={navigation}
                            onLogout={onLogout}
                            fontScale={fontScale}
                            changeFontScale={changeFontScale}
                            renderPasswordForm={renderPasswordSettings}
                        />
                    </View>
                </BottomSheetModal>
                <Modal animationType="slide" transparent={false} visible={showInAppMap} onRequestClose={() => setShowInAppMap(false)}>
                        <View style={styles.mapModalContainer}>
                            <View style={styles.mapHeader}>
                                <View style={{ flex: 1 }}><AppText style={styles.mapHeaderTitle}>ตำแหน่งของคุณ</AppText><AppText style={styles.mapHeaderSub} numberOfLines={1}>{address}</AppText></View>
                                <TouchableOpacity onPress={() => setShowInAppMap(false)} hitSlop={{top:20, bottom:20, left:20, right:20}}><X size={26} color="#1E293B" /></TouchableOpacity>
                            </View>
                            {mapRegion ? (
                                <MapView provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined} style={{flex: 1}} initialRegion={mapRegion} showsUserLocation={true} ref={mapRef}>
                                    <Marker coordinate={currentLocation} title="คุณอยู่ที่นี่" />
                                    <Marker coordinate={HOSPITAL_COORDS} title={HOSPITAL_COORDS.name} pinColor="#3B82F6" />
                                </MapView>
                            ) : <ActivityIndicator size="large" style={{flex:1}} />}
                        </View>
                </Modal>            
            </SafeAreaView>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({

    container: { flex: 1, backgroundColor: '#F8FAFC' },
    headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 15, backgroundColor: '#F8FAFC' },
    logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
    appNameText: { fontSize: 16, fontWeight: '900', color: '#1E293B' },
    appNameLight: { fontWeight: '400', color: '#64748B' },
    settingsIconButton: { padding: 8, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    notificationBadge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#FFFFFF' },
    
    // Unified Card
    unifiedCard: { backgroundColor: 'white', marginHorizontal: 20, marginTop: 10, borderRadius: 24, padding: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' },
    profileHeaderSection: {
        padding: 20,
        paddingBottom: 15, // ลด padding ด้านล่างเล็กน้อยเพื่อให้เข้ากับ Medical Stats
        backgroundColor: '#FFFFFF',
    },
    profileMedicalStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16, // เว้นระยะห่างจากชื่อ
        backgroundColor: '#F8FAFC', // พื้นหลังสีเทาอ่อน
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    medicalStatItem: {
        flex: 1,
        alignItems: 'center', // จัดกึ่งกลาง
    },
    profileRow: { flexDirection: 'row', alignItems: 'center' },
    avatarContainerMain: { position: 'relative', marginRight: 16 },
    avatarCircleMain: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    onlineBadgeMain: { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: '#22C55E', borderWidth: 3, borderColor: '#FFFFFF' },
    greetingContainer: { flex: 1, justifyContent: 'center' },
    greetingText: { fontSize: 13, color: '#64748B', marginBottom: 2, fontWeight: '500' },
    patientNameMain: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 6 },
    hnTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    hnTagLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', marginRight: 4 },
    hnTagValue: { fontSize: 11, fontWeight: 'bold', color: '#475569' },
    profileChevron: { padding: 10 },
    sectionDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 20 },
    locationBoxMain: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 15,
        backgroundColor: '#FFFFFF', 
    },
    locationContentContainer: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    mapIconBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    locationLabelMain: { fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 2 },
    liveBadgeSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 'auto' },
    liveDotSmall: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 4 },
    liveTextSmall: { fontSize: 9, fontWeight: '900', color: '#166534' },
    addressTextMain: { fontSize: 14, fontWeight: '600', color: '#1E293B', lineHeight: 20 },

    // Mini Stats
    miniStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    miniStatItem: { flex: 1, alignItems: 'center' },
    miniStatLabel: { 
        fontSize: 10, 
        color: '#94A3B8', 
        marginBottom: 2, 
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    miniStatValue: { 
        fontSize: 13, // ปรับขนาดให้อ่านง่ายในพื้นที่จำกัด
        color: '#1E293B', 
        fontWeight: 'bold',
        textAlign: 'center' 
    },
    miniStatDivider: { 
        width: 1, 
        height: 25, 
        backgroundColor: '#E2E8F0',
        marginHorizontal: 10
    },

    // SOS Area (Updated)
    mainInteractiveArea: { 
        flex: 1, 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginVertical: 10, // ✅ ลดจาก 30 เหลือ 10 เพื่อดึงพื้นที่คืน
    },
    headerTextContainer: { alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 32, fontWeight: '900', color: '#1E293B' },
    
    // [New Styles for Hospital Info]
    hospitalInfoBox: { alignItems: 'center', marginTop: 5 },
    hospitalNameText: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
    tripInfoRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#FEF3C7' },
    tripInfoTag: { flexDirection: 'row', alignItems: 'center' },
    tripInfoText: { fontSize: 12, fontWeight: '600', color: '#64748B', marginLeft: 4 },
    tripInfoDivider: { width: 1, height: 12, backgroundColor: '#D97706', marginHorizontal: 8, opacity: 0.3 },

    sosWrapper: { width: 240, height: 240, justifyContent: 'center', alignItems: 'center' },
    svg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
    sosButton: { width: 190, height: 190, borderRadius: 95, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', borderWidth: 8, borderColor: 'white', elevation: 20, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.4, shadowRadius: 20 },
    sosButtonActive: { backgroundColor: '#991B1B', transform: [{ scale: 0.95 }] },
    sosButtonDisabled: { backgroundColor: '#FCA5A5' },
    sosText: { color: 'white', fontSize: 36, fontWeight: '900', marginTop: 4, letterSpacing: 1 },
    holdText: { marginTop: 25, fontSize: 14, color: '#64748B', fontWeight: '500' },
    directCallButton: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#FEF2F2', borderRadius: 20, borderWidth: 1, borderColor: '#FECACA' },
    directCallText: { fontSize: 14, fontWeight: 'bold', color: '#EF4444' },
    offlineWarning: { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#FFFBEB', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
    offlineText: { fontSize: 12, color: '#B45309', marginLeft: 6 },
    
    // Active State
    statusContainer: { width: '100%', paddingHorizontal: 24 },
    activeCard: { backgroundColor: '#0F172A', borderRadius: 30, padding: 25 },
    activeCardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    liveIndicator: { flexDirection: 'row', alignItems: 'center' },
    redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 8 },
    liveText: { color: '#F87171', fontSize: 11, fontWeight: 'bold' },
    cardTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', marginTop: 5 },
    timerBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, alignItems: 'center' },
    timerText: { color: 'white', fontSize: 20, fontWeight: '900' },
    timerUnit: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 'bold' },
    cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 20 },
    dispatchedInfo: { flexDirection: 'row', alignItems: 'center' },
    unitTitle: { color: 'white', fontSize: 15, fontWeight: 'bold' },
    unitSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
    checklistContainer: { marginTop: 25 },
    checklistHeader: { fontSize: 14, fontWeight: '900', color: '#1E293B', marginBottom: 15 },
    checkItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    checkCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBD5E1', marginRight: 10 },
    checkText: { fontSize: 13, color: '#475569', fontWeight: '500' },
    cancelButton: { marginTop: 20, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    cancelButtonText: { color: '#64748B', fontSize: 14, fontWeight: '600' },

    // Terms Styles
    termsContainer: { flex: 1, backgroundColor: 'white' },
    termsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, paddingTop: Platform.OS === 'ios' ? 60 : 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: 'white', zIndex: 10 },
    termsTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    termsContent: { padding: 20 },
    termsHeading: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginTop: 15, marginBottom: 8 },
    termsText: { fontSize: 14, color: '#64748B', lineHeight: 22, textAlign: 'justify' },
    headerBackButton: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 14, zIndex: 20 },

    // Modal Styles | Settings Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    settingsModalContent: { backgroundColor: 'white', padding: 25, borderTopLeftRadius: 35, borderTopRightRadius: 35, maxHeight: '85%' },
    modalHandle: { width: 50, height: 5, backgroundColor: '#E2E8F0', alignSelf: 'center', borderRadius: 5, marginBottom: 20 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 20, paddingHorizontal: 20 }, // [FIX] Added paddingTop
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
    modalCloseIcon: { padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12 },
    
    // Menu Styles for Card Look |  Settings Menu
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingHorizontal: 20 },
    menuGroupTitle: { fontSize: 12, fontWeight: 'bold', color: '#94A3B8', marginBottom: 10, marginLeft: 5, textTransform: 'uppercase' },
    menuIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    // [UPDATED] MenuItem as Card
    lineMenuItem: { // เปลี่ยนชื่อจาก menuItem ให้ตรงกับ Component
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 16, 
        backgroundColor: '#FFFFFF', // พื้นหลังขาว
        borderRadius: 16, // ขอบมน
        marginBottom: 10, // เว้นระยะห่างระหว่างรายการ
        borderWidth: 1, 
        borderColor: '#F1F5F9',
        // Shadow Effect
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2
    },
    lineMenuIconBox: { // เปลี่ยนชื่อจาก menuIconBox
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    lineMenuTextBox: {
        flex: 1,
    },
    lineMenuText: { // เปลี่ยนชื่อจาก menuItemText
        fontSize: 15, // ลดขนาดลงนิดนึงให้ดู Modern
        fontWeight: 'bold', 
        color: '#334155' 
    },
    lineLogoutButton: { // เปลี่ยนชื่อจาก logoutButton
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#FEF2F2', 
        paddingVertical: 16, 
        borderRadius: 20, 
        marginTop: 20, 
        gap: 10 
    },
    lineLogoutText: { // เปลี่ยนชื่อจาก logoutText
        fontSize: 15, 
        fontWeight: 'bold', 
        color: '#EF4444' 
    },
    separator: { // สำหรับเส้นคั่นถ้าต้องการใช้ แต่ในแบบ Card ไม่จำเป็นต้องใช้
        height: 1,
        backgroundColor: '#F1F5F9',
        marginLeft: 64, // เว้นให้พ้นไอคอน
        marginRight: 10,
        display: 'none' // ซ่อนไว้เพราะใช้แบบ Card แล้ว
    },

    // Settings Subviews Styles
    subviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    backButton: { padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12, marginRight: 15 },
    fontSizeOption: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'white' },
    fontSizeOptionActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    fontSizeLabel: { marginLeft: 15, flex: 1, fontSize: 16, fontWeight: '600' },
    fontSizeRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
    fontSizeRadioActive: { borderColor: '#EF4444' },
    fontSizeRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'white' },
    

    // Input Fields | Settings Subviews password
    formGroup: { marginBottom: 20 },
    inputLabel: { 
        fontSize: 13, 
        fontWeight: 'bold', 
        color: '#475569', // ✅ เข้มขึ้น (เดิม #475569 ดีอยู่แล้ว หรือถ้าเดิมเป็น #94A3B8 ให้แก้)
        marginBottom: 8 
    },
    inputField: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, fontSize: 15, color: '#1E293B' },
    passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14 },
    passwordInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#1E293B' },
    eyeIcon: { padding: 4 },
    saveButton: { backgroundColor: '#EF4444', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 10 },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    // Contact
    contactCard: { alignItems: 'center', padding: 20, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    contactTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 5 },
    contactSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },
    callButton: { backgroundColor: '#3B82F6', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 12, width: '100%', alignItems: 'center' },
    callButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
    
    // About
    aboutContainer: { alignItems: 'center', padding: 20 },
    aboutAppName: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginTop: 15, marginBottom: 5 },
    aboutVersion: { fontSize: 13, color: '#94A3B8', marginBottom: 20 },
    aboutDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },
    placeholderContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
    placeholderText: { marginTop: 15, fontSize: 14, color: '#94A3B8' },
    
    // Modals & Popovers (คงเดิม)
    mapModalContainer: { flex: 1, backgroundColor: 'white' },
    mapHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    mapHeaderTitle: { fontSize: 18, fontWeight: 'bold' },
    mapHeaderSub: { fontSize: 12, color: '#94A3B8' },
    popoverOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
    popoverContainer: { 
        position: 'absolute', 
        top: 100,          // 1. เพิ่มค่า top (จาก 65) ให้ลงมาต่ำอีกนิด ไม่ทับ Header เกินไป
        right: 20, 
        width: 300, 
        backgroundColor: 'white', 
        borderRadius: 16, 
        zIndex: 9999,
        // เพิ่มเงาให้ชัดขึ้น
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },

    popoverArrow: { 
        position: 'absolute', 
        top: -10, 
        
        // ใส่ค่าที่คุณปรับแล้วว่าตรงเป๊ะๆ (เช่น 110 หรือ 112)
        right: 50, 
        
        width: 20, 
        height: 20, 
        
        // ✅ เปลี่ยนกลับเป็นสีขาว
        backgroundColor: 'white', 
        
        transform: [{ rotate: '45deg' }], 
        zIndex: 1,
        
        // (เสริม) ใส่เงาเล็กน้อยเพื่อให้กลืนกับกล่องหลัก (ถ้าต้องการ)
        shadowColor: "#000",
        shadowOffset: { width: -2, height: -2 }, // เงาขึ้นด้านบนซ้าย
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    popoverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    popoverTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    popoverCloseText: { fontSize: 14, color: '#64748B' },
    popoverItem: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    popoverIconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    popoverItemTitle: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
    popoverItemDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
    popoverItemTime: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
    loadingIconContainer: { marginBottom: 30, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    loadingTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', letterSpacing: 1 },

    // --- [เพิ่ม Styles ใหม่] ---
    detailModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)', // พื้นหลังสีดำจางๆ
        justifyContent: 'center',          // จัดกึ่งกลางแนวตั้ง
        alignItems: 'center',              // จัดกึ่งกลางแนวนอน
        padding: 20,
    },
    detailModalContainer: {
        width: '100%',
        maxWidth: 340,                     // ความกว้างสูงสุดของกล่อง
        backgroundColor: 'white',
        borderRadius: 24,                  // ขอบมน
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    detailModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',   // ไอคอนซ้าย ปุ่มปิดขวา
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    detailIconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeDetailButton: {
        padding: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
    },
    detailTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 6,
    },
    detailTime: {
        fontSize: 13,
        color: '#94A3B8',
        marginBottom: 15,
    },
    detailDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',        // เส้นคั่นสีเทาอ่อน
        marginBottom: 15,
    },
    detailBody: {
        fontSize: 15,
        color: '#334155',
        lineHeight: 24,                    // ระยะห่างบรรทัดให้อ่านสบายตา
    },
    detailOkButton: {
        marginTop: 25,
        backgroundColor: '#F1F5F9',        // ปุ่มสีเทาอ่อน
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    detailOkText: {
        color: '#475569',
        fontWeight: 'bold',
        fontSize: 15,
    },
    privacyContentBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    // ห้ามใส่ height เด็ดขาด!
    // ห้ามใส่ flex: 1 เด็ดขาด!
},
privacySectionTitle: {
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 5,
},
privacyBody: {
    color: '#475569',
    lineHeight: 22,
    textAlign: 'justify',
},
});

export default HomeScreen;

//สิ่งที่ปรับปรุงในเวอร์ชันนี้:
// 1. Dynamic ETA Logic: คำนวณเวลาเริ่มต้นของตัวนับถอยหลังโดยอ้างอิงจากระยะทาง (สมมติความเร็วเฉลี่ยรถพยาบาลที่ 60 กม./ชม. รวมเวลาเตรียมตัวออกเหตุ)

// 2. Minimum Response Time: กำหนดเวลาขั้นต่ำไว้ที่ 3 นาที (180 วินาที) เพราะแม้ระยะทางจะใกล้มาก แต่ทีมกู้ชีพต้องใช้เวลาในการเตรียมอุปกรณ์และเคลื่อนที่

// 3. Real-time Tracking: ยืนยันการทำงานของระบบ Watcher ที่จะอัปเดตพิกัดทุกๆ การเคลื่อนที่ (กำหนดไว้ที่ 5-10 เมตร)

// 4. Live Indicator: เพิ่มสัญลักษณ์จุดสีเขียวกระพริบหน้า "ตำแหน่งปัจจุบัน" เพื่อบอกสถานะว่า GPS กำลังทำงานแบบเรียลไทม์

// 5. Dynamic Distance & ETA: ระยะทางและเวลาเดินทางจะถูกคำนวณใหม่โดยอัตโนมัติทันทีที่ผู้ป่วยขยับตัวครับ

// 6. Enhanced Error Handling: ปรับปรุงการจัดการข้อผิดพลาดในการดึงพิกัดและแสดงข้อความที่ชัดเจนยิ่งขึ้น

// 7. เพิ่ม การเปลี่ยนรหัสผ่าน (Change Password) ในหน้าตั้งค่า 

// 8. เพิ่ม ข้อกำหนดการใช้บริการ (Terms of Service) ในหน้าตั้งค่า

// 9. เพิ่ม นโยบายความเป็นส่วนตัว (Privacy Policy) ในหน้าตั้งค่า

// 10. การทำให้แผนที่ใน Modal ขยับตามพิกัดผู้ใช้แบบอัตโนมัติ (Live Map Camera) และ ปรับมุมกล้องให้เห็นทั้ง "เรา" และ "รพ." พร้อมกัน เพื่อให้เห็นระยะห่างจริง

// 11. เพิ่มปุ่ม ยอมรับนโยบายความเป็นส่วนตัว (Accept Privacy Policy) ในหน้าลงชื่อเข้าใช้

// 12. มีการเข้าสู่ระบบจากอุปกรณ์อื่น ๆ จะแจ้งเตือนผู้ใช้ในแอปทันที และบังคับให้ลงชื่อออก (Logout) เพื่อความปลอดภัยของบัญชีผู้ใช้

// 13. เพิ่ม biometric authentication (ลายนิ้วมือ/Face ID) ในการเข้าดูข้อมูลส่วนตัวเพื่อความปลอดภัยยิ่งขึ้น

// 14. เปลี่ยนขนาดตัวอักษรในแอปเป็นแบบไดนามิกตามที่ผู้ใช้เลือกในหน้าตั้งค่า (ขนาดเล็ก, ปกติ, ใหญ่)

// 15. UI/UX Improvements: ปรับปรุงดีไซน์บางส่วนให้ใช้งานง่ายและดูทันสมัยยิ่งขึ้น

// 16. ระบบแจ้งเตือน (Push Notifications): เพิ่มระบบแจ้งเตือนแบบพุชเพื่อแจ้งเตือนเหตุฉุกเฉินใหม่ ๆ หรือการอัปเดตสถานะการช่วยเหลือผู้ป่วย 

// 17. เพิ่มปุ่ม "โทรด่วน" (Direct Call) ในหน้าหลัก เพื่อให้ผู้ใช้สามารถโทรหาสายด่วนได้ทันทีในกรณีฉุกเฉิน

// 18. เพิ่มข้อความแจ้งเตือนเมื่ออุปกรณ์อยู่ในสถานะออฟไลน์ (Offline Warning) เพื่อเตือนให้ผู้ใช้ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต

// 19. เพิ่มหน้าการแจ้งเตือน (Notifications) เพื่อให้ผู้ใช้สามารถดูประวัติการแจ้งเตือนทั้งหมดได้