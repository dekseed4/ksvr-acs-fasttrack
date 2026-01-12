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
} from 'react-native';

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

const HomeScreen = () => {
    const { setUserData, onLogout, authState } = useAuth(); // ดึง Token และฟังก์ชัน Logout
    const user = authState?.user; // ข้อมูลโปรไฟล์ผู้ใช้

    // ใช้งาน Theme Context
    const { fontScale, changeFontScale } = useTheme();

    // Navigation & UI States
    const [isCalling, setIsCalling] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // สถานะขณะส่งข้อมูลไปยัง Server
    const [showInAppMap, setShowInAppMap] = useState(false); // State สำหรับเปิด/ปิดแผนที่ในแอป
    
    // --- Settings Modal State Management ---
    const settingsSheetRef = useRef(null);
    const profileSheetRef = useRef(null);
    // Snap points: 90% ของหน้าจอ
    const snapPoints = useMemo(() => ['90%'], []);
    const [settingsView, setSettingsView] = useState('main'); 

    const [secondsLeft, setSecondsLeft] = useState(0);
    const [pressProgress, setPressProgress] = useState(0);
    const [isPressing, setIsPressing] = useState(false);

    const [biometricPermission, setBiometricPermission] = useState(null);

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

    const authenticateUser = async (onSuccess) => {
        try {
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
    const startLocationTracking = async () => {
        try {
        // ดึงครั้งแรกเพื่อเริ่มระบบ
            let initialLocation = await Location.getCurrentPositionAsync({ 
                accuracy: Location.Accuracy.Highest 
            });
            if (initialLocation && initialLocation.coords) {
                updateUIWithLocation(initialLocation.coords);
            }
        
        // ตั้งค่าการติดตามแบบเรียลไทม์ (Watcher)
            if (watchSubscription.current) watchSubscription.current.remove();
            watchSubscription.current = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.BestForNavigation, 
                    distanceInterval: 5, // อัปเดตทุกๆ 5 เมตรเพื่อให้เรียลไทม์ที่สุด
                    timeInterval: 10000 // หรืออัปเดตทุก 10 วินาทีถ้าอยู่นิ่ง
                },
                (newLocation) => {
                    if (newLocation && newLocation.coords) {
                        updateUIWithLocation(newLocation.coords);
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

        setIsSubmitting(true);
        triggerHaptic('impactMedium');

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
            const response = await axios.post(`${API_URL}/user_location`, emergencyPayload);
                
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
            await requestLocationPermission();
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

    const strokeDashoffset = circumference - (pressProgress / 100) * circumference;

    // Helper: แปลง array ของโรคเป็น string
    const getCongenitalDiseases = () => {
        if (!user?.detail_medical?.patient_congenital_disease) return '-';
        if (Array.isArray(user.detail_medical.patient_congenital_disease)) {
             return user.detail_medical.patient_congenital_disease.map(d => d.name).join(', ') || 'ไม่มีโรคประจำตัว';
        }
        return '-';
    };


   // --- Render Content for Settings Modal ---
    const renderSettingsContent = () => {
        const renderHeader = (title) => (
            <View style={styles.modalHeaderRow}>
                {/* [UPDATE] ใช้ View 3 ช่อง เพื่อจัดกึ่งกลาง Title */}
                <View style={{ width: 40, alignItems: 'flex-start' }}>
                    {settingsView !== 'main' && (
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
        );

        if (settingsView === 'terms') {
            return (
                <>
                    {renderHeader('ข้อกำหนดการใช้บริการ')}
                    <BottomSheetScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.termsContent}>
                        <AppText style={styles.termsHeading}>ข้อกำหนดและเงื่อนไขการใช้บริการ</AppText>
                        <AppText style={[styles.termsText, { marginBottom: 15, fontStyle: 'italic', textAlign: 'center' }]}>
                            แอปพลิเคชัน: KSVR ACS Fasttrack{'\n'}ฉบับปรับปรุงล่าสุด: 10 มกราคม 2569
                        </AppText>
                        <AppText style={styles.termsHeading}>1. บทนิยาม</AppText>
                        <AppText style={styles.termsText}>"ผู้ให้บริการ" หมายถึง [ชื่อโรงพยาบาล/หน่วยงาน KSVR]...</AppText>
                        <View style={{height: 40}} />
                    </BottomSheetScrollView>
                </>
            );
        } else if (settingsView === 'privacy') {
            return (
                <>
                    {renderHeader('นโยบายความเป็นส่วนตัว')}
                    <BottomSheetScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.termsContent}>
                        <AppText style={styles.termsHeading}>นโยบายความเป็นส่วนตัว (Privacy Policy)</AppText>
                        <AppText style={[styles.termsText, { marginBottom: 15, fontStyle: 'italic', textAlign: 'center' }]}>
                            แอปพลิเคชัน: KSVR ACS Fasttrack{'\n'}ฉบับปรับปรุงล่าสุด: 10 มกราคม 2569
                        </AppText>
                        <AppText style={styles.termsHeading}>1. บทนำ</AppText>
                        <AppText style={styles.termsText}>รพ.ค่ายกฤษณ์สีวะรา ("ผู้ให้บริการ") ตระหนักถึงความสำคัญ...</AppText>
                        <View style={{height: 40}} />
                    </BottomSheetScrollView>
                </>
            );
        } else if (settingsView === 'password') {
            return (
                <>
                    {renderHeader('เปลี่ยนรหัสผ่าน')}
                    <BottomSheetScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.termsContent}>
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
                    </BottomSheetScrollView>
                </>
            );
        } else if (settingsView === 'font') {
            return (
                <>
                    {renderHeader('ขนาดตัวอักษร')}
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
                                style={[
                                    styles.fontSizeOption, 
                                    fontScale === FONT_SCALES.SMALL && styles.fontSizeOptionActive
                                ]}
                                onPress={() => changeFontScale(FONT_SCALES.SMALL)}
                            >
                                <Text style={{ fontSize: 16, color: fontScale === FONT_SCALES.SMALL ? 'white' : '#1E293B' }}>A</Text>
                                <AppText style={[styles.fontSizeLabel, { color: fontScale === FONT_SCALES.SMALL ? 'white' : '#1E293B' }]}>เล็ก (16)</AppText>
                                {fontScale === FONT_SCALES.SMALL && <Check size={20} color="white" />}
                            </TouchableOpacity>

                             <TouchableOpacity 
                                style={[
                                    styles.fontSizeOption, 
                                    fontScale === FONT_SCALES.MEDIUM && styles.fontSizeOptionActive
                                ]}
                                onPress={() => changeFontScale(FONT_SCALES.MEDIUM)}
                            >
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: fontScale === FONT_SCALES.MEDIUM ? 'white' : '#1E293B' }}>A</Text>
                                <AppText style={[styles.fontSizeLabel, { color: fontScale === FONT_SCALES.MEDIUM ? 'white' : '#1E293B' }]}>กลาง (20)</AppText>
                                {fontScale === FONT_SCALES.MEDIUM && <Check size={20} color="white" />}
                            </TouchableOpacity>

                             <TouchableOpacity 
                                style={[
                                    styles.fontSizeOption, 
                                    fontScale === FONT_SCALES.LARGE && styles.fontSizeOptionActive
                                ]}
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
        } else if (settingsView === 'language') {
            return (
                <>
                    {renderHeader('ภาษา')}
                    <View style={styles.placeholderContainer}>
                        <InfoIcon size={48} color="#CBD5E1" />
                        <AppText style={styles.placeholderText}>ฟีเจอร์นี้อยู่ระหว่างการพัฒนา</AppText>
                    </View>
                </>
            );
        } else if (settingsView === 'contact') {
            return (
                <>
                    {renderHeader('ติดต่อโรงพยาบาล')}
                    <BottomSheetScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.termsContent}>
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
                    </BottomSheetScrollView>
                </>
            );
        } else if (settingsView === 'about') {
            return (
                <>
                    {renderHeader('เกี่ยวกับแอป')}
                    <View style={styles.aboutContainer}>
                         <View style={styles.logoCircle}><Heart size={24} color="white" fill="white" /></View>
                         <AppText style={styles.aboutAppName}>KSVR ACS Fasttrack</AppText>
                         <AppText style={styles.aboutVersion}>Version 1.0.0</AppText>
                         <AppText style={styles.aboutDesc}>แอปพลิเคชันสำหรับแจ้งเหตุฉุกเฉินผู้ป่วยโรคหัวใจและหลอดเลือด โรงพยาบาลค่ายกฤษณ์สีวะรา จังหวัดสกลนคร</AppText>
                    </View>
                </>
            );
        }

        // --- Default: Main Settings Menu ---
        return (
            <>
                <View style={styles.modalHeaderRow}>
                    <View style={{ width: 40 }} />
                    <View style={{ flex: 1, alignItems: 'center' }}>
                         <AppText style={styles.modalTitle}>ตั้งค่า</AppText>
                    </View>
                    <View style={{ width: 40, alignItems: 'flex-end' }}>
                        <TouchableOpacity onPress={() => settingsSheetRef.current?.dismiss()} style={styles.modalCloseIcon} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                            <X size={24} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* [FIXED] ใช้ BottomSheetScrollView เพื่อให้เมนูเลื่อนได้ใน Bottom Sheet */}
                <BottomSheetScrollView 
                    style={{ flex: 1, width: '100%' }} 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }} // [FIX] เพิ่ม paddingBottom เป็น 100 เพื่อให้เห็นปุ่มออกจากระบบ
                >
                    <View style={styles.menuSection}>
                        <AppText style={styles.menuGroupTitle}>บัญชีผู้ใช้</AppText>
                        <TouchableOpacity style={styles.menuItem} onPress={() => {
                            authenticateUser(() => {
                                settingsSheetRef.current?.dismiss();
                                setTimeout(() => {
                                    profileSheetRef.current?.present();
                                }, 300);
                            });
                        }}>
                            <View style={[styles.menuIconBox, { backgroundColor: '#FEF2F2' }]}>
                                <UserCircle size={20} color="#EF4444" />
                            </View>
                            <AppText style={styles.menuItemText}>ข้อมูลส่วนตัว (Medical ID)</AppText>
                            <ChevronRight size={16} color="#CBD5E1" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => setSettingsView('password')}>
                             <View style={[styles.menuIconBox, { backgroundColor: '#F0F9FF' }]}>
                                <Key size={20} color="#0EA5E9" />
                            </View>
                            <AppText style={styles.menuItemText}>เปลี่ยนรหัสผ่าน</AppText>
                            <ChevronRight size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.menuSection}>
                        <AppText style={styles.menuGroupTitle}>การใช้งาน</AppText>
                        <TouchableOpacity style={styles.menuItem} onPress={() => setSettingsView('font')}>
                            <View style={[styles.menuIconBox, { backgroundColor: '#FDF4FF' }]}>
                                <Type size={20} color="#C026D3" />
                            </View>
                            <AppText style={styles.menuItemText}>ขนาดตัวอักษร</AppText>
                            <ChevronRight size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.menuSection}>
                        <AppText style={styles.menuGroupTitle}>ช่วยเหลือ</AppText>
                        <TouchableOpacity style={styles.menuItem} onPress={() => setSettingsView('contact')}>
                             <View style={[styles.menuIconBox, { backgroundColor: '#ECFDF5' }]}>
                                <PhoneCall size={20} color="#10B981" />
                            </View>
                            <AppText style={styles.menuItemText}>ติดต่อโรงพยาบาล</AppText>
                            <ChevronRight size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                        
                         <TouchableOpacity style={styles.menuItem} onPress={() => setSettingsView('terms')}>
                             <View style={[styles.menuIconBox, { backgroundColor: '#F1F5F9' }]}>
                                <FileText size={20} color="#64748B" />
                            </View>
                            <AppText style={styles.menuItemText}>ข้อกำหนดการใช้บริการ</AppText>
                            <ChevronRight size={16} color="#CBD5E1" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => setSettingsView('privacy')}>
                             <View style={[styles.menuIconBox, { backgroundColor: '#F1F5F9' }]}>
                                <Lock size={20} color="#64748B" />
                            </View>
                            <AppText style={styles.menuItemText}>นโยบายความเป็นส่วนตัว</AppText>
                            <ChevronRight size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                        
                         <TouchableOpacity style={styles.menuItem} onPress={() => setSettingsView('about')}>
                             <View style={[styles.menuIconBox, { backgroundColor: '#F1F5F9' }]}>
                                <InfoIcon size={20} color="#64748B" />
                            </View>
                            <AppText style={styles.menuItemText}>เกี่ยวกับแอป</AppText>
                            <ChevronRight size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.menuSection}>
                        <TouchableOpacity style={styles.logoutButton} onPress={() => { settingsSheetRef.current?.dismiss(); onLogout(); }}>
                            <LogOut size={20} color="#EF4444" />
                            <AppText style={styles.logoutText}>ออกจากระบบ</AppText>
                        </TouchableOpacity>
                    </View>
                </BottomSheetScrollView>
            </>
        );
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
            <BottomSheetModalProvider>
                <SafeAreaView style={styles.container}>
                    <StatusBar barStyle="dark-content" />
                    
                    {/* Header (Minimal) */}
                    <View style={styles.headerBar}>
                        <View style={styles.logoContainer}>
                            <View style={styles.logoCircle}><Heart size={16} color="white" fill="white" /></View>
                            <AppText style={styles.appNameText}>KSVR <AppText style={styles.appNameLight}>ACS FAST TRACK</AppText></AppText>
                        </View>
                        <TouchableOpacity 
                            style={styles.settingsIconButton}
                            onPress={() => { setSettingsView('main'); settingsSheetRef.current?.present(); }}
                        >
                            <Settings size={20} color="#94A3B8" />
                        </TouchableOpacity>
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
                                    onPress={() => authenticateUser(() => profileSheetRef.current?.present())}
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
                        handleIndicatorStyle={{ backgroundColor: 'transparent' }} // [NEW] ซ่อน Handle
                    >
                        <BottomSheetView style={{ flex: 1 }}>
                            {renderSettingsContent()}
                        </BottomSheetView>
                    </BottomSheetModal>

                    {/* --- Profile Modal (Standalone CustomBottomSheet) --- */}
                    <BottomSheetModal
                        ref={profileSheetRef}
                        index={0}
                        snapPoints={snapPoints}
                        backdropComponent={renderBackdrop}
                        enablePanDownToClose={true}
                        handleIndicatorStyle={{ backgroundColor: 'transparent' }} // [NEW] ซ่อน Handle
                    >
                         <BottomSheetScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                                <View style={{ padding: 20 }}>
                                    <View style={styles.headerBar}>
                                        <Text style={{fontSize: 20, fontWeight: '900', color: '#1E293B', marginBottom: 10}}>ข้อมูลส่วนตัว</Text>
                                        <TouchableOpacity onPress={() => profileSheetRef.current?.dismiss()} style={{ position: 'absolute', right: 0, top: 0, padding: 10 }}>
                                            <X size={24} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.medicalCard}>
                                        <View style={styles.medicalHeaderCenter}>
                                            <View style={styles.medicalAvatarLarge}>
                                                {/* [FIX] Check for user profile picture and load if available, else show icon */}
                                                {user?.picture_profile && !imageLoadError ? (
                                                    <Image 
                                                        source={{ uri: `https://ksvrhospital.go.th/krit-siwara_smart_heart/files/avatars/${user.picture_profile}` }}
                                                        style={{ width: '100%', height: '100%', borderRadius: 30 }}
                                                        resizeMode="cover"
                                                        onError={() => setImageLoadError(true)}
                                                    />
                                                ) : (
                                                    <User size={40} color="white" />
                                                )}
                                            </View>
                                            <View style={{alignItems: 'center', marginTop: 10}}>
                                                <AppText style={styles.medicalNameCenter}>{user?.name || 'ไม่ระบุชื่อ'}</AppText>
                                                <AppText style={styles.medicalHNCenter}>HN: {user?.hn || user?.username || '-'}</AppText>
                                            </View>
                                        </View>
                                        <View style={styles.medicalGrid}>
                                            <View style={styles.medicalItem}><AppText style={styles.medicalLabel}>กรุ๊ปเลือด</AppText><AppText style={styles.medicalValueRed}>{user?.detail_medical?.blood_type || '-'}</AppText></View>
                                            <View style={styles.medicalLine} />
                                            <View style={styles.medicalItem}><AppText style={styles.medicalLabel}>อายุ</AppText><AppText style={styles.medicalValue}>{user?.detail_genaral?.age ? `${user.detail_genaral.age} ปี` : '-'}</AppText></View>
                                            <View style={styles.medicalLine} />
                                            <View style={styles.medicalItem}><AppText style={styles.medicalLabel}>โรคประจำตัว</AppText><AppText style={styles.medicalValue} numberOfLines={1}>{getCongenitalDiseases()}</AppText></View>
                                        </View>
                                        <View style={styles.allergyBox}>
                                            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 5}}><AlertTriangle size={16} color="#F59E0B" /><AppText style={styles.allergyTitle}> ประวัติการแพ้ยา</AppText></View>
                                            <AppText style={styles.allergyText}>{user?.detail_medical?.drug_allergy_history || 'ไม่มีประวัติการแพ้ยา'}</AppText>
                                        </View>

                                        {/* [NEW] General Info Section with Email */}
                                        <View style={styles.infoSection}>
                                            <AppText style={styles.infoSectionTitle}>ข้อมูลทั่วไป</AppText>
                                            
                                            <View style={styles.infoRowSimple}>
                                                <AppText style={styles.infoLabelSimple}>เลขบัตรประชาชน</AppText>
                                                <AppText style={styles.infoValueSimple}>{user?.detail_genaral?.cid || '-'}</AppText>
                                            </View>
                                            
                                            <View style={styles.infoRowSimple}>
                                                <AppText style={styles.infoLabelSimple}>วันเกิด</AppText>
                                                <AppText style={styles.infoValueSimple}>{user?.detail_genaral?.birthday || '-'}</AppText>
                                            </View>

                                            {/* Added Email Field */}
                                            <View style={styles.infoRowSimple}>
                                                <AppText style={styles.infoLabelSimple}>อีเมล</AppText>
                                                <AppText style={styles.infoValueSimple} numberOfLines={1}>{user?.detail_genaral?.email || '-'}</AppText>
                                            </View>

                                            <View style={styles.infoRowSimple}>
                                                <AppText style={styles.infoLabelSimple}>เบอร์โทรศัพท์</AppText>
                                                <AppText style={styles.infoValueSimple}>{user?.detail_genaral?.phonenumber || '-'}</AppText>
                                            </View>
                                            
                                            <View style={styles.infoRowSimple}>
                                                <AppText style={styles.infoLabelSimple}>ที่อยู่</AppText>
                                                <AppText style={styles.infoValueSimple}>{user?.addr?.address1 || '-'}</AppText>
                                            </View>

                                            <View style={styles.infoRowSimple}>
                                                <AppText style={styles.infoLabelSimple}>หน่วย/สังกัด</AppText>
                                                <AppText style={styles.infoValueSimple}>
                                                    {user?.detail_genaral?.unit || '-'} {user?.detail_genaral?.sub ? `(${user.detail_genaral.sub})` : ''}
                                                </AppText>
                                            </View>
                                        </View>

                                        {/* [NEW] Medical Rights & Habits Section */}
                                        <View style={styles.infoSection}>
                                            <AppText style={styles.infoSectionTitle}>ข้อมูลสิทธิและการรักษา</AppText>

                                            <View style={styles.infoRowSimple}>
                                                <AppText style={styles.infoLabelSimple}>สิทธิการรักษา</AppText>
                                                <AppText style={styles.infoValueSimple}>{user?.detail_medical?.claim_patient || '-'}</AppText>
                                            </View>
                                            
                                            <View style={styles.infoRowSimple}>
                                                <AppText style={styles.infoLabelSimple}>แพทย์เจ้าของไข้</AppText>
                                                <AppText style={styles.infoValueSimple}>{user?.detail_medical?.doctor || '-'}</AppText>
                                            </View>

                                            <View style={styles.infoRowSimple}>
                                                <AppText style={styles.infoLabelSimple}>สถานะสูบบุหรี่</AppText>
                                                <AppText style={styles.infoValueSimple}>{user?.detail_medical?.cigarette || '-'}</AppText>
                                            </View>
                                        </View>

                                        {/* Emergency Contact */}
                                        <View style={styles.infoSection}>
                                            <AppText style={styles.infoSectionTitle}>ผู้ติดต่อฉุกเฉิน</AppText>
                                            <View style={styles.contactRow}>
                                                <View style={styles.contactIcon}><Phone size={16} color="white" /></View>
                                                <View>
                                                    {/* [FIX] Map family_patient */}
                                                    <AppText style={styles.contactName}>{user?.family_patient?.relation_name || 'ไม่ได้ระบุ'}</AppText>
                                                    <AppText style={styles.contactRelation}>
                                                        {user?.family_patient?.relationship ? `(${user.family_patient.relationship})` : ''} {user?.family_patient?.relation_tel || ''}
                                                    </AppText>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </BottomSheetScrollView>
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
                </SafeAreaView>
            </BottomSheetModalProvider>
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
    loadingText: { marginTop: 8, color: '#94A3B8', fontSize: 14, fontWeight: '500' },
    
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
        color: '#94A3B8',
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
    subtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

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
    cancelButton: { marginTop: 30, alignItems: 'center', padding: 15 },
    cancelButtonText: { color: '#94A3B8', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' },

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
    inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8 },
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