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
const LineMenuItem = ({ icon: Icon, color, label, onPress, isDestructive = false }) => (
  <TouchableOpacity 
    style={styles.lineMenuItem} 
    onPress={onPress}
    activeOpacity={0.7}
  >
    {/* ไอคอนด้านซ้าย */}
    <View style={[styles.lineMenuIconBox, { backgroundColor: isDestructive ? '#FEF2F2' : '#F1F5F9' }]}>
      <Icon size={22} color={isDestructive ? '#EF4444' : (color || '#334155')} />
    </View>

    {/* ข้อความ */}
    <View style={styles.lineMenuTextBox}>
      <AppText style={[styles.lineMenuText, isDestructive && { color: '#EF4444' }]}>
        {label}
      </AppText>
    </View>

    {/* ลูกศรขวา (แสดงเฉพาะเมนูปกติ) */}
    {!isDestructive && <ChevronRight size={20} color="#CBD5E1" />}
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
    const [hasUnread, setHasUnread] = useState(true);
    const [showPopover, setShowPopover] = useState(false);
    const [notificationList, setNotificationList] = useState([]);
    const [refreshNotif, setRefreshNotif] = useState(false);

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
        // 1. ฟังก์ชันจัดการเมื่อได้รับ Notification (ใช้ร่วมกันทั้งตอนเปิดแอปและกดเข้ามา)
        const handleNewNotification = (notification) => {
            const content = notification.request.content;
            
            // สร้าง Object แจ้งเตือน
            const newNotif = {
                id: Date.now(),
                type: content.data?.type || 'info',
                title: content.title || 'การแจ้งเตือนใหม่',
                body: content.body || '',
                time: 'ตอนนี้',
                read: false
            };
            
            // อัปเดต State
            setNotificationList(prev => [newNotif, ...prev]);
            setHasUnread(true);
        };

        // 2. Listener ตอนแอปเปิดอยู่ (Foreground) -> รับแล้วโชว์จุดแดง แต่ไม่เด้ง Popover
        const receivedSub = Notifications.addNotificationReceivedListener(notification => {
            handleNewNotification(notification);
        });

        // 3. Listener ตอน User "กด" ที่แจ้งเตือน (Tap) -> รับแล้วเด้ง Popover ทันที
        const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
            const content = response.notification.request.content;
            
            // เพิ่มลง List
            handleNewNotification(response.notification);
            
            // เปิด Popover ทันทีเพื่อให้ User เห็นรายละเอียด
            setShowPopover(true);
            console.log("👆 User Tapped Notification:", content.data);

            // ถ้ามี Logic การเปลี่ยนหน้า (Navigation) ให้ใส่ตรงนี้
            // if (content.data?.type === 'manual_announcement') { ... }
        });

        // Cleanup function
        return () => {
            receivedSub.remove();
            responseSub.remove();
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

    // --- Render Password Change Form ---
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
    const renderFontSettings = () => (
        <>
            <View style={{ flex: 1, padding: 20 }}>
                    <View style={{ 
                        padding: 20, 
                        backgroundColor: '#F8FAFC', 
                        borderRadius: 16, 
                        marginBottom: 30, 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        minHeight: 120,
                        borderWidth: 1,
                        borderColor: '#E2E8F0'
                    }}>
                        <AppText style={{ fontSize: 16 * fontScale }}>ตัวอย่างข้อความ</AppText>
                        <AppText style={{ fontSize: 14 * fontScale, color: '#64748B', marginTop: 8 }}>นี่คือขนาดตัวอักษรปัจจุบันของคุณ</AppText>
                    </View>

                    <AppText style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: '#1E293B' }}>เลือกขนาดตัวอักษร</AppText>

                    <View style={{ gap: 12 }}>
                        <TouchableOpacity 
                            style={[styles.fontSizeOption, fontScale === FONT_SCALES.SMALL && styles.fontSizeOptionActive]}
                            onPress={() => changeFontScale(FONT_SCALES.SMALL)}
                        >
                            <Text style={{ fontSize: 16, color: fontScale === FONT_SCALES.SMALL ? 'white' : '#1E293B' }}>A</Text>
                            <AppText style={[styles.fontSizeLabel, { color: fontScale === FONT_SCALES.SMALL ? 'white' : '#1E293B' }]}>เล็ก (16)</AppText>
                            {fontScale === FONT_SCALES.SMALL && <Check size={20} color="white" />}
                        </TouchableOpacity>

                         <TouchableOpacity 
                            style={[styles.fontSizeOption, fontScale === FONT_SCALES.MEDIUM && styles.fontSizeOptionActive]}
                            onPress={() => changeFontScale(FONT_SCALES.MEDIUM)}
                        >
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: fontScale === FONT_SCALES.MEDIUM ? 'white' : '#1E293B' }}>A</Text>
                            <AppText style={[styles.fontSizeLabel, { color: fontScale === FONT_SCALES.MEDIUM ? 'white' : '#1E293B' }]}>กลาง (20)</AppText>
                            {fontScale === FONT_SCALES.MEDIUM && <Check size={20} color="white" />}
                        </TouchableOpacity>

                         <TouchableOpacity 
                            style={[styles.fontSizeOption, fontScale === FONT_SCALES.LARGE && styles.fontSizeOptionActive]}
                            onPress={() => changeFontScale(FONT_SCALES.LARGE)}
                        >
                            <Text style={{ fontSize: 24, fontWeight: '900', color: fontScale === FONT_SCALES.LARGE ? 'white' : '#1E293B' }}>A</Text>
                            <AppText style={[styles.fontSizeLabel, { color: fontScale === FONT_SCALES.LARGE ? 'white' : '#1E293B' }]}>ใหญ่ (24)</AppText>
                            {fontScale === FONT_SCALES.LARGE && <Check size={20} color="white" />}
                        </TouchableOpacity>
                    </View>
                </View>
        </>
    );


    // --- Render Content for Settings Modal ---
    const renderSettingsContent = useCallback(() => {
        // 1. กำหนด Title และ Content ตาม settingsView
        let title = 'ตั้งค่า';
        let content = null;
        let isMain = settingsView === 'main';

        if (settingsView === 'main') {
            title = 'ตั้งค่า';
            // ใช้ Layout ใหม่สไตล์ LINE
            content = (
                <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
                    
                    {/* กลุ่มที่ 1: บัญชี */}
                    <AppText style={styles.menuGroupTitle}>บัญชีของฉัน</AppText>
                    <View style={styles.menuGroupContainer}>
                        <LineMenuItem 
                            icon={UserCircle} 
                            color="#3B82F6" 
                            label="ข้อมูลส่วนตัว (Medical ID)" 
                            onPress={() => {
                                authenticateUser(() => {
                                    settingsSheetRef.current?.dismiss();
                                    navigation.navigate('Profile');
                                });
                            }} 
                        />
                        <View style={styles.separator} />
                        <LineMenuItem 
                            icon={Key} 
                            color="#F59E0B" 
                            label="เปลี่ยนรหัสผ่าน" 
                            onPress={() => setSettingsView('password')} 
                        />
                    </View>

                    {/* กลุ่มที่ 2: การตั้งค่า */}
                    <AppText style={styles.menuGroupTitle}>การตั้งค่าแอป</AppText>
                    <View style={styles.menuGroupContainer}>
                        <LineMenuItem 
                            icon={Type} 
                            color="#8B5CF6" 
                            label="ขนาดตัวอักษร" 
                            onPress={() => setSettingsView('font')} 
                        />
                        <View style={styles.separator} />
                        <LineMenuItem 
                            icon={Globe} 
                            color="#10B981" 
                            label="ภาษา (Language)" 
                            onPress={() => setSettingsView('language')} 
                        />
                    </View>

                    {/* กลุ่มที่ 3: ช่วยเหลือ */}
                    <AppText style={styles.menuGroupTitle}>ความช่วยเหลือ</AppText>
                    <View style={styles.menuGroupContainer}>
                        <LineMenuItem icon={PhoneCall} color="#EF4444" label="ติดต่อโรงพยาบาล" onPress={() => setSettingsView('contact')} />
                        <View style={styles.separator} />
                        <LineMenuItem icon={FileText} color="#64748B" label="ข้อกำหนดการใช้บริการ" onPress={() => setSettingsView('terms')} />
                        <View style={styles.separator} />
                        <LineMenuItem icon={Lock} color="#64748B" label="นโยบายความเป็นส่วนตัว" onPress={() => setSettingsView('privacy')} />
                        <View style={styles.separator} />
                        <LineMenuItem icon={InfoIcon} color="#64748B" label="เกี่ยวกับแอป" onPress={() => setSettingsView('about')} />
                    </View>

                    {/* ปุ่ม Logout */}
                    <TouchableOpacity 
                        style={styles.lineLogoutButton} 
                        onPress={() => { settingsSheetRef.current?.dismiss(); onLogout(); }}
                    >
                        <AppText style={styles.lineLogoutText}>ออกจากระบบ</AppText>
                    </TouchableOpacity>
                </View>
            );
        }  else if (settingsView === 'terms') {
            title = 'ข้อกำหนดการใช้บริการ';
            content = (
                <>
                    <AppText style={styles.termsHeading}>ข้อกำหนดและเงื่อนไขการใช้บริการ</AppText>
                    <AppText style={[styles.termsText, { marginBottom: 15, fontStyle: 'italic', textAlign: 'center' }]}>
                        แอปพลิเคชัน: KSVR ACS Fasttrack{'\n'}ฉบับปรับปรุงล่าสุด: 10 มกราคม 2569
                    </AppText>
                    <AppText style={styles.termsHeading}>1. บทนิยาม</AppText>
                    <AppText style={styles.termsText}>"ผู้ให้บริการ" หมายถึง [ชื่อโรงพยาบาล/หน่วยงาน KSVR]...</AppText>
                    <View style={{height: 40}} />
                </>
            );
        } else if (settingsView === 'privacy') {
            title = 'นโยบายความเป็นส่วนตัว';
            content = (
                <>
                    <AppText style={styles.termsHeading}>นโยบายความเป็นส่วนตัว (Privacy Policy)</AppText>
                    <AppText style={[styles.termsText, { marginBottom: 15, fontStyle: 'italic', textAlign: 'center' }]}>
                        แอปพลิเคชัน: KSVR ACS Fasttrack{'\n'}ฉบับปรับปรุงล่าสุด: 10 มกราคม 2569
                    </AppText>
                    <AppText style={styles.termsHeading}>1. บทนำ</AppText>
                    <AppText style={styles.termsText}>รพ.ค่ายกฤษณ์สีวะรา ("ผู้ให้บริการ") ตระหนักถึงความสำคัญ...</AppText>
                    <View style={{height: 40}} />
                </>
            );
        } else if (settingsView === 'password') {
                    title = 'เปลี่ยนรหัสผ่าน';
                    content = renderPasswordSettings(); // เรียกใช้ฟังก์ชันแทน
        } else if (settingsView === 'font') {
            title = 'ขนาดตัวอักษร';
            content = renderFontSettings();
       
        } else if (settingsView === 'contact') {
            title = 'ติดต่อโรงพยาบาล';
            content = (
                <View style={styles.contactCard}>
                     <PhoneCall size={32} color="#EF4444" style={{marginBottom: 10}} />
                     <AppText style={styles.contactTitle}>รพ.ค่ายกฤษณ์สีวะรา</AppText>
                     <AppText style={styles.contactSubtitle}>แผนกฉุกเฉิน 24 ชั่วโมง</AppText>
                     <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL('tel:1669')}>
                        <AppText style={styles.callButtonText}>โทร 1669</AppText>
                     </TouchableOpacity>
                     <TouchableOpacity style={[styles.callButton, {backgroundColor: 'white', borderWidth:1, borderColor:'#E2E8F0', marginTop: 10}]} onPress={() => Linking.openURL('tel:042712867')}>
                        <AppText style={[styles.callButtonText, {color:'#1E293B'}]}>โทร 042-712867</AppText>
                     </TouchableOpacity>
                 </View>
            );
        } else if (settingsView === 'about') {
            title = 'เกี่ยวกับแอป';
            content = (
                <View style={styles.aboutContainer}>
                     <View style={styles.logoCircle}><Heart size={24} color="white" fill="white" /></View>
                     <AppText style={styles.aboutAppName}>KSVR ACS Fasttrack</AppText>
                     <AppText style={styles.aboutVersion}>Version 1.0.0</AppText>
                     <AppText style={styles.aboutDesc}>แอปพลิเคชันสำหรับแจ้งเหตุฉุกเฉินผู้ป่วยโรคหัวใจและหลอดเลือด โรงพยาบาลค่ายกฤษณ์สีวะรา จังหวัดสกลนคร</AppText>
                </View>
            );
        }
        
        // 2. Return โครงสร้างหลัก (Unified Structure)
        return (
            <View style={{ flex: 1 }}>
                {/* Header ส่วนกลาง */}
                <View style={styles.modalHeaderRow}>
                    <View style={{ width: 40, alignItems: 'flex-start' }}>
                        {!isMain && (
                            <TouchableOpacity onPress={() => setSettingsView('main')} style={styles.headerBackButton} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                                <ChevronLeft size={24} color="#1E293B" />
                            </TouchableOpacity>
                        )}
                    </View>
                    
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <AppText style={styles.modalTitle}>{title}</AppText>
                    </View>

                    <View style={{ width: 40, alignItems: 'flex-end' }}>
                        <TouchableOpacity onPress={() => settingsSheetRef.current?.dismiss()} style={styles.modalCloseIcon} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                            <X size={24} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* เนื้อหาที่เปลี่ยนไปตาม State */}
                <BottomSheetScrollView 
                    style={{ flex: 1, width: '100%' }} 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 50, paddingHorizontal: 20 }}
                >
                    {content}
                </BottomSheetScrollView>
            </View>
        );
    }, [settingsView, fontScale]);

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
                <SafeAreaView style={styles.container}>
                    <StatusBar barStyle="dark-content" />
                    
                    {/* Header (Minimal) */}
                    <View style={styles.headerBar}>
                        <View style={styles.logoContainer}>
                            <View style={styles.logoCircle}><Heart size={16} color="white" fill="white" /></View>
                            <AppText style={styles.appNameText}>KSVR <AppText style={styles.appNameLight}>ACS FAST TRACK</AppText></AppText>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <TouchableOpacity 
                                style={styles.settingsIconButton}
                                onPress={() => {
                                    setHasUnread(false); // ลบจุดแดง
                                    setShowPopover(true); // เปิด Popover
                                }}
                            >
                                <Bell size={20} color="#94A3B8" />
                                {hasUnread && <View style={styles.notificationBadge} />}
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.settingsIconButton}
                                onPress={() => { setSettingsView('main'); settingsSheetRef.current?.present(); }}
                            >
                                <Settings size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView 
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ flexGrow: 1 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EF4444']} />}
                    >
                        <View style={{ flex: 1, paddingBottom: 40 }}>
                            {/* --- Redesigned Main Card --- */}
                            <View style={styles.unifiedCard}>
                                {/* Profile Section */}
                                <TouchableOpacity 
                                    style={styles.profileHeaderSection}
                                    // [NEW] เรียกใช้ฟังก์ชันสแกนนิ้วก่อนเข้าดูโปรไฟล์
                                    onPress={() => authenticateUser(() => navigation.navigate('Profile'))}
                                    activeOpacity={0.8}
                                >
                                     <View style={styles.profileRow}>
                                         <View style={styles.avatarContainerMain}>
                                            <View style={styles.avatarCircleMain}>
                                                {/* [FIX] Check for user profile picture and load if available, else show icon */}
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

                                {/* Location Section with Info Dashboard (Inline) */}
                                <TouchableOpacity 
                                    onPress={openInMaps} 
                                    activeOpacity={0.9} 
                                    style={styles.locationBoxMain}
                                >
                                    <View style={styles.locationContentContainer}>
                                        {/* [UPDATE] New Inline Layout for Location */}
                                        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
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

                                        {/* Merged Info Dashboard */}
                                        <View style={styles.miniStatsRow}>
                                            <View style={styles.miniStatItem}>
                                                <AppText style={styles.miniStatLabel}>หมู่เลือด</AppText>
                                                {/* [FIX] Map กับค่า blood_type */}
                                                <AppText style={styles.miniStatValue}>{user?.detail_medical?.blood_type || '-'}</AppText>
                                            </View>
                                            <View style={styles.miniStatDivider} />
                                            <View style={styles.miniStatItem}>
                                                <AppText style={styles.miniStatLabel}>เวลาเดินทางถึง รพ.</AppText>
                                                <AppText style={styles.miniStatValue}>~{Math.ceil(calculateTravelTime(distance)/60)} นาที</AppText>
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
                                            {/* [UPDATE] เปลี่ยนข้อความตามคำขอ */}
                                            <AppText style={styles.subtitle}>{HOSPITAL_COORDS.name} ระยะทางประมาณ {distance} กม.</AppText>
                                        </View>

                                        <View style={styles.sosWrapper}>
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

                                        {/* --- [เพิ่ม] ปุ่มสำรอง โทรออกทันที --- */}
                                        <TouchableOpacity 
                                            style={styles.directCallButton} 
                                            onPress={() => Linking.openURL('tel:1669')}
                                            activeOpacity={0.7}
                                        >
                                            <Phone size={16} color="#EF4444" style={{ marginRight: 6 }} />
                                            <AppText style={styles.directCallText}>โทร 1669 ทันที</AppText>
                                        </TouchableOpacity>

                                        {/* --- [เพิ่ม] แถบเตือนเมื่อไม่มีเน็ต --- */}
                                        {!isConnected && (
                                            <View style={styles.offlineWarning}>
                                                <AlertTriangle size={14} color="#B45309" />
                                                <AppText style={styles.offlineText}>ไม่มีสัญญาณอินเทอร์เน็ต กรุณาใช้วิธีโทร</AppText>
                                            </View>
                                        )}
                                    </>
                                ) : (
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

                    {/* --- Unified Settings Modal (Using CustomBottomSheet) --- */}
                    {/* [REPLACE] ใช้ BottomSheetModal แทน CustomBottomSheet */}
                    <BottomSheetModal
                        ref={settingsSheetRef}
                        index={0}
                        snapPoints={snapPoints}
                        backdropComponent={renderBackdrop}
                        enablePanDownToClose={true}
                        handleIndicatorStyle={{ backgroundColor: '#E2E8F0', width: 40 }}
                        backgroundStyle={{ borderRadius: 24, backgroundColor: 'white' }} 
                        onDismiss={() => setSettingsView('main')}
                    >
                        <BottomSheetView style={{ flex: 1 }}>
                            {renderSettingsContent()}
                        </BottomSheetView>
                    </BottomSheetModal>
                    
                    {/* Map Modal */}
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
                    {/* --- Popover Modal (กล่องแจ้งเตือน) --- */}
                    <Modal
                        transparent={true}
                        visible={showPopover}
                        animationType="fade"
                        onRequestClose={() => setShowPopover(false)}
                    >
                        {/* ส่วน Background ใส (กดตรงไหนก็ได้เพื่อปิด) */}
                        <TouchableOpacity 
                            style={styles.popoverOverlay} 
                            activeOpacity={1} 
                            onPress={() => setShowPopover(false)}
                        >
                            {/* ตัวกล่อง Popover */}
                            <TouchableWithoutFeedback>
                                <View style={styles.popoverContainer}>
                                    {/* สามเหลี่ยมชี้ขึ้น (Arrow) */}
                                    <View style={styles.popoverArrow} />

                                    <View style={styles.popoverHeader}>
                                        <AppText style={styles.popoverTitle}>การแจ้งเตือน</AppText>
                                        <TouchableOpacity onPress={() => setShowPopover(false)}>
                                            <AppText style={styles.popoverCloseText}>ปิด</AppText>
                                        </TouchableOpacity>
                                    </View>

                                    <ScrollView style={{ maxHeight: 300 }}>
                                        {notificationList.length === 0 ? (
                                            <View style={{ padding: 30, alignItems: 'center' }}>
                                                <Bell size={40} color="#E2E8F0" />
                                                <AppText style={{ color: '#94A3B8', marginTop: 10 }}>ไม่มีการแจ้งเตือนใหม่</AppText>
                                            </View>
                                        ) : (
                                            // วนลูปแสดงรายการ
                                            notificationList.map((item, index) => {
                                                const style = getNotifIcon(item.type);
                                                const IconComponent = style.icon;

                                                return (
                                                    <TouchableOpacity 
                                                        key={item.id || index} 
                                                        style={[
                                                            styles.popoverItem, 
                                                            // ถ้ายังไม่อ่าน ให้พื้นหลังสีจางๆ (Optional)
                                                            !item.read && { backgroundColor: '#F8FAFC' } 
                                                        ]}
                                                        activeOpacity={0.7}
                                                    >
                                                        <View style={[styles.popoverIconBox, { backgroundColor: style.bg }]}>
                                                            <IconComponent size={20} color={style.color} />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                                <AppText style={styles.popoverItemTitle} numberOfLines={1}>
                                                                    {item.title}
                                                                </AppText>
                                                                {/* จุดแดงเล็กๆ ถ้ายังไม่อ่าน */}
                                                                {!item.read && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', marginTop: 6 }} />}
                                                            </View>
                                                            
                                                            <AppText style={styles.popoverItemDesc} numberOfLines={2}>
                                                                {item.body}
                                                            </AppText>
                                                            <AppText style={styles.popoverItemTime}>
                                                                {item.time}
                                                            </AppText>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })
                                        )}
                                    </ScrollView>
                                </View>
                            </TouchableWithoutFeedback>
                        </TouchableOpacity>
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
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
    loadingIconContainer: { marginBottom: 30, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    loadingTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', letterSpacing: 1 },
    loadingText: { 
        marginTop: 8, 
        color: '#64748B', // ✅ แก้จาก #94A3B8 เป็น #64748B
        fontSize: 14, 
        fontWeight: '500' 
    },
    
    // Bottom Sheet Styles
    sheetContainer: { flex: 1, justifyContent: 'flex-end' },
    sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheetContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, // overflow hidden for borderRadius
    sheetHandleContainer: { width: '100%', alignItems: 'center', paddingVertical: 10 },
    sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    sheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    sheetCloseButton: { padding: 4 },

    // Unified Card Design (Clean & Modern)
    unifiedCard: {
        backgroundColor: 'white',
        marginHorizontal: 20,
        marginTop: 10,
        borderRadius: 24,
        padding: 0, 
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 5,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)'
    },
    profileHeaderSection: {
        padding: 20,
        backgroundColor: '#FFFFFF',
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainerMain: {
        position: 'relative',
        marginRight: 16,
    },
    avatarCircleMain: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#EF4444', 
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    onlineBadgeMain: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#22C55E',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    greetingContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    greetingText: {
        fontSize: 13,
        color: '#64748B',
        marginBottom: 2,
        fontWeight: '500',
    },
    patientNameMain: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 6,
    },
    hnTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    hnTagLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#64748B', // ✅ แก้จาก #94A3B8 เป็น #64748B (อ่านง่ายขึ้น)
        marginRight: 4,
    },
    hnTagValue: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#475569',
    },
    profileChevron: {
        padding: 10,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginHorizontal: 20,
    },
    locationBoxMain: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 15, // Reduced from 20
        backgroundColor: '#FFFFFF', 
    },
    locationContentContainer: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 12, // Reduced from 16
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    locationHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    locationLabelGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    mapIconBadge: {
        width: 36, // Increased slightly for better proportion with smaller padding
        height: 36,
        borderRadius: 10,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    locationLabelMain: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#334155',
        marginBottom: 2,
    },
    liveBadgeSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginLeft: 'auto', // Push to right
    },
    liveDotSmall: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#22C55E',
        marginRight: 4,
    },
    liveTextSmall: {
        fontSize: 9,
        fontWeight: '900',
        color: '#166534',
    },
    addressTextMain: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        lineHeight: 20,
    },
    miniStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8, // Reduced from 12
        paddingTop: 8, // Reduced from 12
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    miniStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    miniStatLabel: {
        fontSize: 10,
        color: '#94A3B8',
        marginBottom: 2,
        fontWeight: 'bold',
    },
    miniStatValue: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: 'bold',
    },
    miniStatDivider: {
        width: 1,
        height: 20,
        backgroundColor: '#E2E8F0',
    },
    tapToViewMap: {
        fontSize: 11,
        color: '#3B82F6',
        fontWeight: '600',
        marginTop: 8,
        textAlign: 'right',
    },
    
    // [NEW] Font Selection Styles
    fontSizeOption: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'white' },
    fontSizeOptionActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    fontSizeLabel: { marginLeft: 15, flex: 1, fontSize: 16, fontWeight: '600' },

    // SOS Section
    mainInteractiveArea: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 30 },
    sosWrapper: { width: 240, height: 240, justifyContent: 'center', alignItems: 'center' },
    svg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
    sosButton: { width: 190, height: 190, borderRadius: 95, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', borderWidth: 8, borderColor: 'white', elevation: 20, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.4, shadowRadius: 20 },
    sosButtonActive: { backgroundColor: '#991B1B', transform: [{ scale: 0.95 }] },
    sosButtonDisabled: { backgroundColor: '#FCA5A5' },
    sosText: { color: 'white', fontSize: 36, fontWeight: '900', marginTop: 4, letterSpacing: 1 },
    holdText: { marginTop: 25, fontSize: 14, color: '#64748B', fontWeight: '500' },
    headerTextContainer: { alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 32, fontWeight: '900', color: '#1E293B' },
    subtitle: { 
        fontSize: 14, 
        color: '#64748B', // ✅ แก้จาก #94A3B8 เป็น #64748B
        textAlign: 'center' 
    },

    // Alert & Status Styles
    alertCard: { flexDirection: 'row', backgroundColor: '#FFFBEB', marginHorizontal: 24, marginTop: 15, padding: 14, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#FEF3C7' },
    alertTextContainer: { marginLeft: 12 },
    alertTitle: { fontSize: 13, fontWeight: 'bold', color: '#B45309' },
    alertSubtitle: { fontSize: 12, color: '#D97706' },
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
    cancelButton: { 
        marginTop: 20, 
        alignItems: 'center', 
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#FFFFFF',      // พื้นขาว
        borderWidth: 1,                 // มีขอบ
        borderColor: '#E2E8F0',         // ขอบสีเทาอ่อน (หรือใช้ #FECACA ถ้าอยากให้สื่อถึงสีแดงจางๆ)
        borderRadius: 30,               // ขอบมน
        // เพิ่มเงาเล็กน้อยเพื่อให้ดูเป็นปุ่มกดได้
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    cancelButtonText: { 
        color: '#64748B',               // เปลี่ยนสีให้เข้มขึ้น (Slate-500)
        fontSize: 14,                   // เพิ่มขนาดตัวอักษร
        fontWeight: '600',              // หนาปานกลาง
        // เอาขีดเส้นใต้ออก เพราะดูเป็นปุ่มแล้ว
    },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    settingsModalContent: { backgroundColor: 'white', padding: 25, borderTopLeftRadius: 35, borderTopRightRadius: 35, maxHeight: '85%' },
    modalHandle: { width: 50, height: 5, backgroundColor: '#E2E8F0', alignSelf: 'center', borderRadius: 5, marginBottom: 20 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 20, paddingHorizontal: 20 }, // [FIX] Added paddingTop
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
    modalCloseIcon: { padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12 },
    
    // [NEW] Menu Styles for Card Look
    menuSection: { marginTop: 15, paddingHorizontal: 20 }, // เพิ่ม padding ด้านข้าง
    menuGroupTitle: { fontSize: 12, fontWeight: 'bold', color: '#94A3B8', marginBottom: 10, marginLeft: 5, textTransform: 'uppercase' },
    menuIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    
    // [UPDATED] MenuItem as Card
    menuItem: { 
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
    menuItemText: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#334155' },
    
    logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', paddingVertical: 16, borderRadius: 20, marginTop: 20, gap: 10 },
    logoutText: { fontSize: 15, fontWeight: 'bold', color: '#EF4444' },

    // Input Fields
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
    
    // Common
    medicalCard: { backgroundColor: '#F8FAFC', borderRadius: 25, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 20 },
    medicalHeaderCenter: { alignItems: 'center', marginBottom: 20, paddingTop: 10 },
    medicalAvatarLarge: { width: 80, height: 80, borderRadius: 30, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    medicalNameCenter: { fontSize: 22, fontWeight: '900', color: '#1E293B', textAlign: 'center' },
    medicalHNCenter: { fontSize: 14, color: '#64748B', marginTop: 4 },
    medicalGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    medicalItem: { alignItems: 'center', flex: 1 },
    medicalLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', marginBottom: 4 },
    medicalValue: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
    medicalValueRed: { fontSize: 16, fontWeight: 'bold', color: '#EF4444' },
    medicalLine: { width: 1, height: 25, backgroundColor: '#E2E8F0' },
    allergyBox: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 15, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 20 },
    allergyTitle: { fontSize: 12, fontWeight: 'bold', color: '#D97706' },
    allergyText: { fontSize: 12, color: '#B45309', marginTop: 2, fontWeight: '500' },
    contactRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    contactIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    contactName: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
    contactRelation: { fontSize: 11, color: '#64748B' },
    infoSection: { marginBottom: 20 },
    infoSectionTitle: { fontSize: 12, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 },
    infoRowSimple: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 8 },
    infoLabelSimple: { fontSize: 13, color: '#64748B', flex: 1 },
    infoValueSimple: { fontSize: 13, fontWeight: '600', color: '#1E293B', flex: 1.5, textAlign: 'right' },
    
    // Terms Styles
    termsContainer: { flex: 1, backgroundColor: 'white' },
    termsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, paddingTop: Platform.OS === 'ios' ? 60 : 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: 'white', zIndex: 10 },
    termsTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    termsContent: { padding: 20 },
    termsHeading: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginTop: 15, marginBottom: 8 },
    termsText: { fontSize: 14, color: '#64748B', lineHeight: 22, textAlign: 'justify' },
    headerBackButton: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 14, zIndex: 20 },
    
    // Map Styles
    mapModalContainer: { flex: 1, backgroundColor: 'white' },
    mapHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    mapHeaderTitle: { fontSize: 18, fontWeight: 'bold' },
    mapHeaderSub: { fontSize: 12, color: '#94A3B8' },
    closeMapButton: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 14, zIndex: 20 },
    mapViewWrapper: { flex: 1, backgroundColor: '#F8FAFC' },
    map: { width: '100%', height: '100%' },
    customMarker: { backgroundColor: 'white', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#EF4444', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
    mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    mapFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    distanceInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    distanceText: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
    externalMapLink: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    externalMapText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 12 },
    
    // --- Popover Styles ---
    popoverOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)', // พื้นหลังมืดลงเล็กน้อย
    },
    popoverContainer: {
        position: 'absolute',
        // ปรับเป็น marginTop จากขอบบนสุดของ SafeAreaView แทน
        // ค่า 70-80 มักจะพ้น Header พอดีในทุกรุ่น
        top: 65, 
        right: 20, 
        width: 300,
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 0,
        // ... shadow ...
        zIndex: 9999, // เพิ่ม zIndex ให้มั่นใจว่าอยู่บนสุด
    },
    popoverArrow: {
        position: 'absolute',
        top: -10,
        // -----------------------------------------------------
        // 👇 แก้ตรงนี้: เปลี่ยนจาก 62 เป็น 68 เพื่อให้ตรงกับกึ่งกลางปุ่ม Bell
        // -----------------------------------------------------
        right: 65,  
        
        width: 20,
        height: 20,
        backgroundColor: 'white',
        transform: [{ rotate: '45deg' }],
        shadowColor: "#000",
        shadowOffset: { width: -2, height: -2 }, // เงาเฉียงขึ้นซ้ายบน
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2, // สำหรับ Android
        zIndex: 1, // บังเส้นขอบด้านล่าง
    },
    popoverHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    popoverTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    popoverCloseText: {
        fontSize: 14,
        color: '#64748B',
    },
    popoverItem: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    popoverIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    popoverItemTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    popoverItemDesc: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    popoverItemTime: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 4,
    },
    
    // ... (ส่วน Styles อื่นๆ คงเดิม) ...
    notificationBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444', // สีแดง
        borderWidth: 1.5,
        borderColor: '#FFFFFF', // ขอบขาวเพื่อให้ตัดกับไอคอน
    },
    // [NEW] Menu Styles for Card Look
    menuSection: { marginTop: 15, paddingHorizontal: 20 }, // เพิ่ม padding ด้านข้าง
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
    directCallButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#FEF2F2',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    directCallText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#EF4444',
    },
    offlineWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        backgroundColor: '#FFFBEB',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    offlineText: {
        fontSize: 12,
        color: '#B45309',
        marginLeft: 6,
    }
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