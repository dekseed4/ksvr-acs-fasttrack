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
  Alert,
  TextInput,
  AppState,
  LayoutAnimation, 
  DeviceEventEmitter,
  Vibration
} from 'react-native';

import { useNavigation } from '@react-navigation/native'; 
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { 
  BottomSheetModal, 
  BottomSheetBackdrop, 
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';

import { 
    SlideInRight, SlideOutRight, 
    SlideInLeft, SlideOutLeft, FadeInUp 
} from 'react-native-reanimated';

import MapView, { Marker, PROVIDER_GOOGLE, Circle as MapCircle } from 'react-native-maps';
import axios from 'axios';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '../components/AppText';
import { useTheme } from '../context/ThemeContext';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import Svg, { Circle } from 'react-native-svg';
import {
  Heart,
  MapPin,
  AlertTriangle,
  Zap,
  User,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  X,
  Settings,
  Bell,
  UserCircle,
  FileText,
  Phone,
  FileHeart, 
  Calendar, 
  Key,      
  Type,      
  PhoneCall, 
  Info as InfoIcon,
  Check,
  Eye,   
  EyeOff 
} from 'lucide-react-native';
import Constants from 'expo-constants';

import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../config';
import { Image } from 'expo-image';
const { width, height } = Dimensions.get('window'); 

import { HOSPITAL_COORDS } from '../config';
import SettingsMenu from '../components/SettingsMenu';
import { useLoading } from '../context/LoadingContext';

const HomeScreen = () => {

    const { setUserData, onLogout, authState } = useAuth();
    const user = authState?.user;

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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showInAppMap, setShowInAppMap] = useState(false);
    
    // --- Settings Modal State Management ---
    const settingsSheetRef = useRef(null);
    const snapPoints = useMemo(() => ['90%'], []);
    const [settingsView, setSettingsView] = useState('main'); 

    const [secondsLeft, setSecondsLeft] = useState(0);
    const [pressProgress, setPressProgress] = useState(0);
    const [isPressing, setIsPressing] = useState(false);

    // --- Biometric Authentication State ---
    const [biometricPermission, setBiometricPermission] = useState(null);
    const lastAuthTime = useRef(0);
    const AUTH_GRACE_PERIOD = 5 * 60 * 1000;
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

    const [activeEmergencyId, setActiveEmergencyId] = useState(null);

    // --- Profile & Loading States ---
    const { setIsLoading } = useLoading();
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
    const blinkAnim = useRef(new Animated.Value(0.4)).current; 

    const HOLD_DURATION = 1000;
    const radius = 90;
    const strokeWidth = 8;
    const circumference = 2 * Math.PI * radius;

    const changeSettingsView = (newView) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSettingsView(newView);
    };

    // 🌟 ฟังก์ชันจัดการการโทรออกอย่างปลอดภัยบน iPad
    const handleCall = async (phoneNumber) => {
        const url = `tel:${phoneNumber}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert("ไม่รองรับการโทร", "อุปกรณ์นี้ไม่สามารถทำการโทรออกได้ (เช่น iPad) กรุณาใช้โทรศัพท์มือถือในการติดต่อ");
            }
        } catch (error) {
            console.log("Call error", error);
            Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถเชื่อมต่อระบบโทรศัพท์ได้");
        }
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
        
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return;
        }

        try {
            token = (await Notifications.getExpoPushTokenAsync({
                projectId: Constants.expoConfig?.extra?.eas?.projectId || 'YOUR_PROJECT_ID_HERE'
            })).data;
            // console.log("Expo Push Token:", token); 
            return token;
        } catch (error) {
            console.log("Error getting push token:", error);
        }
    }

   // --- Backdrop for Bottom Sheet ---
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

    const calculateTravelTime = (km) => {
        const AVG_SPEED_KMH = 60;
        const PREP_TIME_MINS = 2;
        const travelTimeMins = (km / AVG_SPEED_KMH) * 60;
        const totalTimeMins = Math.max(3, travelTimeMins + PREP_TIME_MINS);
        return Math.round(totalTimeMins * 60);
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
    };

    const openInMaps = () => {
        if (currentLocation && currentLocation.latitude) {
        setShowInAppMap(true);
        triggerHaptic('impactMedium');
        }
    };

    const authenticateUser = async (onSuccess) => {
        try {
            if (Constants.appOwnership === 'expo') {
                console.log("รันบน Expo Go: ข้ามการสแกน Face ID ชั่วคราว");
                onSuccess();
                return;
            }
            const now = Date.now();
            if (lastAuthTime.current > 0 && (now - lastAuthTime.current < AUTH_GRACE_PERIOD)) {
                onSuccess();
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
                                    await AsyncStorage.setItem('use_biometric', 'false');
                                    onSuccess(); 
                                }
                            },
                            {
                                text: "ใช้งาน",
                                onPress: () => { 
                                    setTimeout(async () => {
                                        try {
                                            const result = await LocalAuthentication.authenticateAsync({
                                                promptMessage: 'ยืนยันตัวตนเพื่อตั้งค่า',
                                                cancelLabel: 'ยกเลิก',
                                                disableDeviceFallback: true, 
                                            });

                                            if (result.success) {
                                                setBiometricPermission(true);
                                                await AsyncStorage.setItem('use_biometric', 'true');
                                                lastAuthTime.current = Date.now();
                                                onSuccess();
                                                triggerHaptic('notificationSuccess');
                                            } else {
                                                Alert.alert(
                                                    "ยืนยันตัวตนเพื่อตั้งค่า ไม่สำเร็จ", 
                                                    `เกิดข้อผิดพลาดรหัส: ${result.error}\n เนื่องจากคุณปฏิเสธการยืนยันตัวตน ระบบจะไม่เปิดใช้งานการสแกนใบหน้า/ลายนิ้วมือ และจะเข้าสู่หน้าตั้งค่าโดยตรง`,
                                                );
                                            }
                                        } catch (error) {
                                            Alert.alert("ข้อผิดพลาดระบบ", String(error));
                                        }
                                    }, 300);
                                }
                            }
                        ]
                    );
                } else if (biometricPermission === true) {
                    const result = await LocalAuthentication.authenticateAsync({
                        promptMessage: 'ยืนยันตัวตนเพื่อเข้าถึงข้อมูล',
                        cancelLabel: 'ยกเลิก',
                        disableDeviceFallback: true, 
                    });
                    if (result.success) {
                        lastAuthTime.current = Date.now();
                        onSuccess();
                        triggerHaptic('notificationSuccess');
                    }
                } else {
                    onSuccess();
                }
            } else {
                onSuccess();
            }
        } catch (error) {
            console.log("Biometric error:", error);
            onSuccess(); // Fallback
        }
    };

    const loadUser = async () => {
        try {
            const result = await axios.get(`${API_URL}/profile`);
            setUserData(result.data.data);
            setImageLoadError(false);
        } catch (e) {
            console.error("Profile load failed:", e.message);
            if (e.response?.status === 401) onLogout && onLogout();
        }
    };

    const getAddressFromCoords = async (latitude, longitude) => {
        if (!latitude || !longitude) return;
        try {
            const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (reverseGeocode && reverseGeocode.length > 0) {
                const place = reverseGeocode[0];
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

    const updateUIWithLocation = useCallback(async (coords) => {
        if (!coords || typeof coords !== 'object') return;
            const { latitude, longitude } = coords;
            setCurrentLocation({ latitude, longitude });
            getAddressFromCoords(latitude, longitude);
            setDistance(calculateDistance(latitude, longitude, HOSPITAL_COORDS.latitude, HOSPITAL_COORDS.longitude));
            setIsLocationLive(true);
    }, []);

    const startLocationTracking = async (mode = 'normal') => {
        try {
            if (watchSubscription.current) {
                watchSubscription.current.remove();
                watchSubscription.current = null;
            }

            const options = mode === 'emergency' 
                ? { 
                    accuracy: Location.Accuracy.BestForNavigation, 
                    distanceInterval: 5,
                    timeInterval: 2000   
                }
                : { 
                    accuracy: Location.Accuracy.Balanced, 
                    distanceInterval: 100,
                    timeInterval: 60000    
                };

            watchSubscription.current = await Location.watchPositionAsync(
                options,
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

    const requestLocationPermission = async () => {
        try {
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

    const onRefresh = useCallback(async () => {
            setRefreshing(true);
            try {
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
    
    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }
        if (newPassword.length < 6) {
            Alert.alert('แจ้งเตือน', 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('แจ้งเตือน', 'รหัสผ่านใหม่ไม่ตรงกัน');
            return;
        }
        if (currentPassword === newPassword) {
            Alert.alert('แจ้งเตือน', 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
            return;
        }

        setIsChangingPassword(true);

        try {
            const response = await axios.post(`${API_URL}/change-password`, {
                old_password: currentPassword,
                new_password: newPassword,
                new_password_confirmation: confirmPassword,
            });

            if (response.status === 200) {
                Alert.alert('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setSettingsView('main'); 
            }
        } catch (error) {
            let msg = "ไม่สามารถเปลี่ยนรหัสผ่านได้";
            if (error.response) {
                msg = error.response.data?.message || msg;
            } else if (error.request) {
                msg = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต";
            } else {
                msg = error.message;
            }
            Alert.alert('เกิดข้อผิดพลาด', msg);
        } finally {
            setIsChangingPassword(false);
        }
    };

    const startSOS = async () => {
        if (isSubmitting || !authState?.token) return;

        if (!isConnected) {
            triggerHaptic('notificationError');
            Alert.alert(
                "ไม่มีการเชื่อมต่อ",
                "โทรศัพท์ของคุณไม่ได้เชื่อมต่ออินเทอร์เน็ต ระบบจะเปลี่ยนเป็นการโทรออก 1669 แทน",
                [
                    { text: "ยกเลิก", style: "cancel" },
                    // 🌟 อัปเดต: ใช้ handleCall
                    { text: "โทร 1669", onPress: () => handleCall('1669') }
                ]
            );
            return;
        }

        setIsSubmitting(true);
        triggerHaptic('impactMedium');

        const source = axios.CancelToken.source();
        const timeout = setTimeout(() => {
            source.cancel('Timeout');
            Alert.alert(
                "การเชื่อมต่อล่าช้า", 
                "ไม่สามารถส่งพิกัดผ่านอินเทอร์เน็ตได้ในขณะนี้ กรุณาโทร 1669 ทันที",
                // 🌟 อัปเดต: ใช้ handleCall
                [{ text: "โทรเลย", onPress: () => handleCall('1669') }]
            );
        }, 8000); 

        try {
            const emergencyPayload = {
                latitude: currentLocation?.latitude,
                longitude: currentLocation?.longitude,
                current_address: address,
                distance_to_hospital: distance,
                patient_name: user?.name,
                emergency_type: 'ACS_FAST_TRACK',
            };
          
            const response = await axios.post(`${API_URL}/user_location`, emergencyPayload, {
                cancelToken: source.token
            });
            clearTimeout(timeout);
                
            if (response.status === 200 || response.status === 201) {
                const emergencyId = response.data?.data?.patient_id || response.data?.patient_id;
                setActiveEmergencyId(emergencyId);
                
                setIsCalling(true);
                setSecondsLeft(calculateTravelTime(distance));
                triggerHaptic('notificationSuccess');
            }
      
        } catch (error) {
            clearTimeout(timeout);
            if (axios.isCancel(error)) return; 
            triggerHaptic('notificationError');
            Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถส่งพิกัดได้ กรุณาโทร 1669 ทันที");
        } finally {
            setIsSubmitting(false);
            setPressProgress(0);
            setIsPressing(false);
        }
    };

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
                        if (!activeEmergencyId) {
                            setIsCalling(false);
                            setSecondsLeft(0);
                            Alert.alert("รีเซ็ตสถานะ", "ไม่พบข้อมูลรายการเรียกในเครื่อง ระบบได้ทำการล้างหน้าจอให้คุณแล้ว หากคุณยังต้องการความช่วยเหลือกรุณาโทร 1669");
                            return;
                        }

                        setIsSubmitting(true);
                        try {
                            await axios.post(`${API_URL}/emergency-requests/cancel`, {
                                emergency_id: activeEmergencyId
                            }, {
                                headers: { 'Authorization': `Bearer ${authState?.token}` }
                            });
                            
                            setActiveEmergencyId(null);
                            setIsCalling(false);
                            setSecondsLeft(0);
                            triggerHaptic('notificationSuccess');
                            Alert.alert("ยกเลิกสำเร็จ", "รายการขอความช่วยเหลือของคุณถูกยกเลิกแล้ว");
                        } catch (error) {
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

    useEffect(() => {
        const initData = async () => {
            setIsLoading(true);
            await registerForPushNotificationsAsync(); 
            if (authState?.token) {
                await loadUser();
            }
            setIsLoading(false);
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

    const mapRegion = useMemo(() => {
        if (!currentLocation || !currentLocation.latitude) return null;
        return {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        };
    }, [currentLocation]);

    useEffect(() => {
        if (showInAppMap && currentLocation && mapRef.current) {
            mapRef.current.fitToCoordinates(
                [
                    { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
                    { latitude: HOSPITAL_COORDS.latitude, longitude: HOSPITAL_COORDS.longitude }
                ],
                {
                    edgePadding: { top: 100, right: 50, bottom: 100, left: 50 }, 
                    animated: true,
                }   
            );
        }
    }, [currentLocation, showInAppMap]);

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

    useEffect(() => {
        notificationListRef.current = notificationList;
    }, [notificationList]);

    useEffect(() => {
        const handleNewNotification = (notification) => {
            const content = notification.request.content;
            const identifier = notification.request.identifier; 

            const isDuplicate = notificationListRef.current.some(n => n.id === identifier);
            if (isDuplicate) return; 

            const now = new Date();
            const timeString = now.toLocaleDateString('th-TH', {
                year: '2-digit', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            }) + ' น.';

            const newNotif = {
                id: identifier, 
                type: content.data?.type || 'info',
                title: content.title || 'การแจ้งเตือนใหม่',
                body: content.body || '',
                time: timeString,
                read: false
            };
            
            setNotificationList(prev => [newNotif, ...prev]);
            setHasUnread(true);
        };

        const receivedSub = Notifications.addNotificationReceivedListener(notification => {
            handleNewNotification(notification);
        });

        const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
            const content = response.notification.request.content;
            const identifier = response.notification.request.identifier; 

            const currentList = notificationListRef.current;
            const existingIndex = currentList.findIndex(n => n.id === identifier);
            
            let newList;

            if (existingIndex !== -1) {
                newList = [...currentList];
                newList[existingIndex] = { ...newList[existingIndex], read: true };
            } else {
                const now = new Date();
                const timeString = now.toLocaleDateString('th-TH', {
                    year: '2-digit', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: false
                }) + ' น.';

                const tappedNotif = {
                    id: identifier, 
                    type: content.data?.type || 'info',
                    title: content.title || 'การแจ้งเตือนใหม่',
                    body: content.body || '',
                    time: timeString,
                    read: true 
                };
                newList = [tappedNotif, ...currentList];
            }

            setNotificationList(newList);
            setHasUnread(false);
            
            navigation.navigate('Notifications', { 
                notifications: newList,
                initialId: identifier 
            });
        });

        return () => {
            receivedSub.remove();
            responseSub.remove();
        };
    }, []);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('notificationRead', (readId) => {
            setNotificationList(prevList => {
                const newList = prevList.map(n => n.id === readId ? { ...n, read: true } : n);
                notificationListRef.current = newList; 
                const stillHasUnread = newList.some(n => !n.read);
                setHasUnread(newList.length > 0 && stillHasUnread);
                return newList;
            });
        });
        return () => {
            subscription.remove();
        };
    }, []);

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

            if (isCalling) {
                console.log("📍 Switch to Emergency Tracking Mode (High Accuracy)");
                await startLocationTracking('emergency');
            } else {
                console.log("🍃 Switch to Normal Tracking Mode (Battery Saving)");
                await startLocationTracking('normal');
            }
        };

        manageLocationTracking();

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
                console.log('App has come to the foreground!');
                startLocationTracking(isCalling ? 'emergency' : 'normal');
            } else if (nextAppState.match(/inactive|background/)) {
                if (watchSubscription.current) {
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

    useEffect(() => {
        const timeElapsed = calculateTravelTime(distance) - secondsLeft;
        if (isCalling && timeElapsed === 180) {
            const PATTERN = [0, 500, 200, 500]; 
            Vibration.vibrate(PATTERN);
        }
    }, [secondsLeft, isCalling]);

    const strokeDashoffset = circumference - (pressProgress / 100) * circumference;

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
       
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <StatusBar barStyle="dark-content" />
                
                <View style={styles.headerBar}>
                    <View style={styles.logoContainer}>
                        <Image 
                            source={require('../../assets/logo.png')}
                            style={{ width: 40, height: 40, contentFit: 'contain' }} 
                        />
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
                        
                        <View style={styles.unifiedCard}>
                            <TouchableOpacity 
                                style={styles.profileHeaderSection}
                                onPress={() => authenticateUser(() => navigation.navigate('Profile'))}
                                activeOpacity={0.8}
                            >
                                <View style={styles.profileRow}>
                                        <View style={styles.avatarContainerMain}>
                                        <View style={styles.avatarCircleMain}>
                                            {user?.picture_profile && !imageLoadError ? (
                                                <Image 
                                                    cachePolicy="disk"
                                                    source={{ uri: `${API_URL}/files/avatars/${user.picture_profile}` }}
                                                    style={{ width: '100%', height: '100%', borderRadius: 30 }}
                                                    contentFit="cover"
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

                        <View style={styles.mainInteractiveArea}>
                            {!isCalling ? (
                                <>
                                    <View style={styles.headerTextContainer}>
                                        <AppText style={styles.title}>ขอความช่วยเหลือ</AppText>
                                        
                                        <View style={styles.hospitalInfoBox}>
                                            <AppText style={styles.hospitalNameText}>{HOSPITAL_COORDS.name}</AppText>
                                            <View style={styles.tripInfoRow}>
                                                <View style={styles.tripInfoTag}>
                                                    <MapPin size={12} color="#64748B" />
                                                    <AppText style={styles.tripInfoText}> ห่าง {distance} กม.</AppText>
                                                </View>
                                                <View style={styles.tripInfoDivider} />
                                                <View style={styles.tripInfoTag}>
                                                    <Zap size={12} color="#F59E0B" fill="#F59E0B" /> 
                                                    <AppText style={[styles.tripInfoText, { color: '#D97706' }]}>
                                                        {' '}ถึงใน ~{Math.ceil(calculateTravelTime(distance)/60)} นาที
                                                    </AppText>
                                                </View>
                                            </View>
                                        </View>
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
                                                    <>
                                                    <Heart size={56} color="white" fill="white" />
                                                    <Text style={styles.sosText}>ฉุกเฉิน</Text></>
                                                )}
                                            </TouchableOpacity>
                                        </Animated.View>
                                    </View>
                                    <AppText style={styles.holdText}>กดค้าง 1 วินาที เพื่อขอความช่วยเหลือ</AppText>

                                    <TouchableOpacity 
                                        style={styles.directCallButton} 
                                        // 🌟 อัปเดต: ใช้ handleCall สำหรับปุ่ม 1669
                                        onPress={() => handleCall('1669')}
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
                                   {(calculateTravelTime(distance) - secondsLeft >= 180) && (
                                        <Animated.View 
                                            entering={FadeInUp.duration(600)} 
                                            style={{ width: '100%' }}
                                        >
                                            <TouchableOpacity 
                                                style={[
                                                    styles.directCallButton, 
                                                    { 
                                                        backgroundColor: '#FEF2F2', 
                                                        borderColor: '#FECACA', 
                                                        borderWidth: 1,
                                                        paddingVertical: 12,
                                                        borderRadius: 12,
                                                        flexDirection: 'row',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        shadowColor: '#EF4444',
                                                        shadowOffset: { width: 0, height: 2 },
                                                        shadowOpacity: 0.1,
                                                        shadowRadius: 4,
                                                        elevation: 2
                                                    }
                                                ]} 
                                                // 🌟 อัปเดต: ใช้ handleCall สำหรับโทร ER
                                                onPress={() => handleCall('0647906014')}
                                                activeOpacity={0.8}
                                            >
                                                <PhoneCall size={20} color="#EF4444" style={{ marginRight: 10 }} />
                                                <AppText style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 16 }}>
                                                    โทรติดต่อโรงพยาบาลแผนก ER
                                                </AppText>
                                            </TouchableOpacity>
                                            <AppText style={{ 
                                                fontSize: 12, 
                                                color: '#94A3B8', 
                                                textAlign: 'center', 
                                                marginTop: 8,
                                                fontStyle: 'italic' 
                                            }}>
                                                *หากอาการเปลี่ยนแปลง หรือรอนานเกินไป โปรดโทรทันที
                                            </AppText>
                                        </Animated.View>
                                    )}
                                    <TouchableOpacity onPress={handleCancelSOS} style={styles.cancelButton} hitSlop={{ top: 20, bottom: 20, left: 50, right: 50 }} activeOpacity={0.6} disabled={isSubmitting}>
                                        {isSubmitting ? <ActivityIndicator size="small" color="#94A3B8" /> : <AppText style={styles.cancelButtonText}>ยกเลิกรายการเรียก</AppText>}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </ScrollView>
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
                    <View style={{ flex: 1, height: '100%' }}> 
                        <SettingsMenu 
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
        paddingBottom: 15, 
        backgroundColor: '#FFFFFF',
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

    // SOS Area (Updated)
    mainInteractiveArea: { 
        flex: 1, 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginVertical: 10, 
    },
    headerTextContainer: { alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 32, fontWeight: '900', color: '#1E293B' },
    
    // Hospital Info
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
    headerBackButton: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 14, zIndex: 20 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    settingsModalContent: { backgroundColor: 'white', padding: 25, borderTopLeftRadius: 35, borderTopRightRadius: 35, maxHeight: '85%' },
    modalHandle: { width: 50, height: 5, backgroundColor: '#E2E8F0', alignSelf: 'center', borderRadius: 5, marginBottom: 20 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 20, paddingHorizontal: 20 }, 
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
    modalCloseIcon: { padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12 },
    
    // Menu Styles
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingHorizontal: 20 },
    menuGroupTitle: { fontSize: 12, fontWeight: 'bold', color: '#94A3B8', marginBottom: 10, marginLeft: 5, textTransform: 'uppercase' },
    menuIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    lineMenuItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 16, 
        backgroundColor: '#FFFFFF',
        borderRadius: 16, 
        marginBottom: 10, 
        borderWidth: 1, 
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2
    },
    lineMenuIconBox: { 
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
    lineMenuText: { 
        fontSize: 15, 
        fontWeight: 'bold', 
        color: '#334155' 
    },
    lineLogoutButton: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#FEF2F2', 
        paddingVertical: 16, 
        borderRadius: 20, 
        marginTop: 20, 
        gap: 10 
    },
    lineLogoutText: { 
        fontSize: 15, 
        fontWeight: 'bold', 
        color: '#EF4444' 
    },
    separator: { 
        height: 1,
        backgroundColor: '#F1F5F9',
        marginLeft: 64, 
        marginRight: 10,
        display: 'none' 
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

    // Password Change Form
    formGroup: { marginBottom: 20 },
    inputLabel: { 
        fontSize: 13, 
        fontWeight: 'bold', 
        color: '#475569',
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
    
    // Modals
    mapModalContainer: { flex: 1, backgroundColor: 'white' },
    mapHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    mapHeaderTitle: { fontSize: 18, fontWeight: 'bold' },
    mapHeaderSub: { fontSize: 12, color: '#94A3B8' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
    loadingIconContainer: { marginBottom: 30, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    loadingTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', letterSpacing: 1 },
    loadingText: { marginTop: 8, color: '#94A3B8', fontSize: 14, fontWeight: '500' },
    
    detailModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)', 
        justifyContent: 'center',         
        alignItems: 'center',             
        padding: 20,
    },
    detailModalContainer: {
        width: '100%',
        maxWidth: 340,                    
        backgroundColor: 'white',
        borderRadius: 24,                  
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    detailModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',   
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
        backgroundColor: '#F1F5F9',        
        marginBottom: 15,
    },
    detailBody: {
        fontSize: 15,
        color: '#334155',
        lineHeight: 24,                    
    },
    detailOkButton: {
        marginTop: 25,
        backgroundColor: '#F1F5F9',        
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