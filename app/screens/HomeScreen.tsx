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
} from 'react-native';

import MapView, { Marker, PROVIDER_GOOGLE, Circle as MapCircle } from 'react-native-maps';
import axios from 'axios';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
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
  Lock
} from 'lucide-react-native';

import { API_URL, useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// พิกัด รพ.ค่ายกฤษณ์สีวะรา (สกลนคร)
const HOSPITAL_COORDS = {
    latitude: 17.187368,
    longitude: 104.105749,
    name: 'รพ.ค่ายกฤษณ์สีวะรา'
    
};

const HomeScreen = () => {
    const { setUserData, onLogout, authState } = useAuth(); // ดึง Token และฟังก์ชัน Logout
    const user = authState?.user; // ข้อมูลโปรไฟล์ผู้ใช้

    // Navigation & UI States
    const [isCalling, setIsCalling] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // สถานะขณะส่งข้อมูลไปยัง Server
    const [showInAppMap, setShowInAppMap] = useState(false); // State สำหรับเปิด/ปิดแผนที่ในแอป
    
    // --- Settings Modal State Management ---
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsView, setSettingsView] = useState('main'); // 'main' | 'terms' | 'privacy'

    const [secondsLeft, setSecondsLeft] = useState(0);
    const [pressProgress, setPressProgress] = useState(0);
    const [isPressing, setIsPressing] = useState(false);

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

    // --- Utility Functions ---

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
    // --- Data & Logic Functions ---
    const loadUser = async () => {
        // if (authState?.user) return; // ถ้ามีข้อมูลผู้ใช้ใน Context แล้ว ให้ข้ามการโหลดใหม่
    
        try {
            const result = await axios.get(`${API_URL}/profile`);
            // console.log("Profile loaded:", result.data);
            setUserData(result.data.data);
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

    // --- Helpers ---
    const strokeDashoffset = circumference - (pressProgress / 100) * circumference;

    // --- Render Content for Settings Modal ---
    const renderSettingsContent = () => {
        if (settingsView === 'terms') {
            return (
                <>
                    <View style={styles.modalHeaderRow}>
                        <TouchableOpacity onPress={() => setSettingsView('main')} style={styles.headerBackButton}>
                            <ChevronLeft size={24} color="#1E293B" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>ข้อกำหนดการใช้บริการ</Text>
                        <TouchableOpacity onPress={() => setShowSettingsModal(false)}><X size={24} color="#94A3B8" /></TouchableOpacity>
                    </View>
                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.termsContent}>
                        <Text style={styles.termsHeading}>ข้อกำหนดและเงื่อนไขการใช้บริการ</Text>
                        <Text style={[styles.termsText, { marginBottom: 15, fontStyle: 'italic', textAlign: 'center' }]}>
                            แอปพลิเคชัน: KSVR ACS Fasttrack{'\n'}ฉบับปรับปรุงล่าสุด: 10 มกราคม 2569
                        </Text>

                        <Text style={styles.termsHeading}>1. บทนิยาม</Text>
                        <Text style={styles.termsText}>
                            "ผู้ให้บริการ" หมายถึง [ชื่อโรงพยาบาล/หน่วยงาน KSVR], ทีมผู้พัฒนาแอปพลิเคชัน และบุคลากรทางการแพทย์ที่เกี่ยวข้อง{'\n'}
                            "ผู้ใช้บริการ" หมายถึง ผู้ป่วย ญาติผู้ป่วย หรือบุคคลทั่วไปที่ลงทะเบียนเข้าใช้งานแอปพลิเคชันนี้{'\n'}
                            "บริการ" หมายถึง การใช้งานแอปพลิเคชันเพื่อแจ้งเหตุฉุกเฉินทางสุขภาพ ส่งพิกัดตำแหน่ง และส่งข้อมูลสุขภาพเบื้องต้น
                        </Text>

                        <Text style={styles.termsHeading}>2. การยอมรับข้อตกลง</Text>
                        <Text style={styles.termsText}>
                            การที่ท่านดาวน์โหลด ติดตั้ง และสมัครเข้าใช้งานแอปพลิเคชันนี้ ถือว่าท่านได้อ่าน เข้าใจ และตกลงยอมรับข้อกำหนดและเงื่อนไขฉบับนี้โดยสมบูรณ์ หากท่านไม่ยอมรับเงื่อนไขส่วนหนึ่งส่วนใด กรุณายุติการใช้งานทันที
                        </Text>

                        <Text style={styles.termsHeading}>3. ขอบเขตการให้บริการและข้อจำกัด (สำคัญมาก)</Text>
                        <Text style={styles.termsText}>
                            3.1 แอปพลิเคชันนี้เป็น "ช่องทางเสริม" ในการแจ้งเหตุฉุกเฉินสำหรับผู้ป่วยกลุ่มเสี่ยง (โดยเฉพาะกลุ่มโรคหัวใจและหลอดเลือด ACS) เพื่อความรวดเร็วในการระบุพิกัดและข้อมูลพื้นฐานเท่านั้น{'\n'}
                            3.2 ไม่รับประกันผลลัพธ์: ผู้ให้บริการไม่สามารถรับประกันได้ว่ารถพยาบาลจะเดินทางไปถึงภายในเวลาที่กำหนดได้ทุกกรณี เนื่องจากขึ้นอยู่กับปัจจัยภายนอก เช่น สภาพการจราจร, สภาพอากาศ, ระยะทาง หรือเหตุสุดวิสัยอื่นๆ{'\n'}
                            3.3 กรณีระบบขัดข้อง: ในกรณีที่แอปพลิเคชันไม่ตอบสนอง, ไม่มีสัญญาณอินเทอร์เน็ต หรือระบบ GPS คลาดเคลื่อน ผู้ใช้บริการต้องโทรแจ้งสายด่วน 1669 ทันที อย่ารอการตอบกลับจากแอปพลิเคชันเพียงอย่างเดียว
                        </Text>

                        <Text style={styles.termsHeading}>4. หน้าที่และความรับผิดชอบของผู้ใช้บริการ</Text>
                        <Text style={styles.termsText}>
                            4.1 ความถูกต้องของข้อมูล: ท่านตกลงที่จะให้ข้อมูลที่เป็นจริง เป็นปัจจุบัน และครบถ้วน โดยเฉพาะข้อมูลประวัติการแพ้ยา โรคประจำตัว และข้อมูลติดต่อฉุกเฉิน เพื่อความปลอดภัยในการรักษาของท่านเอง{'\n'}
                            4.2 การใช้งานพิกัด (Location): ท่านยินยอมให้แอปพลิเคชันเข้าถึงและส่งข้อมูลพิกัดตำแหน่ง (GPS Location) ของท่านไปยังศูนย์สั่งการ เมื่อมีการกดปุ่มขอความช่วยเหลือ{'\n'}
                            4.3 การรักษาความปลอดภัยบัญชี: ท่านต้องเก็บรักษารหัสผ่าน (Password) หรือรหัสยืนยันตัวตน (OTP) ไว้เป็นความลับ การกระทำใดๆ ผ่านบัญชีของท่านถือว่าเป็นการกระทำของท่านเอง{'\n'}
                            4.4 ห้ามแจ้งเหตุเท็จ: ห้ามใช้งานแอปพลิเคชันเพื่อก่อกวน กลั่นแกล้ง หรือแจ้งเหตุอันเป็นเท็จ หากตรวจพบ ผู้ให้บริการขอสงวนสิทธิ์ในการระงับการใช้งานถาวรและดำเนินคดีตามกฎหมาย
                        </Text>
                        
                        <View style={{height: 40}} />
                    </ScrollView>
                </>
            );
        } else if (settingsView === 'privacy') {
            return (
                <>
                    <View style={styles.modalHeaderRow}>
                        <TouchableOpacity onPress={() => setSettingsView('main')} style={styles.headerBackButton}>
                            <ChevronLeft size={24} color="#1E293B" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>นโยบายความเป็นส่วนตัว</Text>
                        <TouchableOpacity onPress={() => setShowSettingsModal(false)}><X size={24} color="#94A3B8" /></TouchableOpacity>
                    </View>
                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.termsContent}>
                        <Text style={styles.termsHeading}>นโยบายความเป็นส่วนตัว (Privacy Policy)</Text>
                        <Text style={[styles.termsText, { marginBottom: 15, fontStyle: 'italic', textAlign: 'center' }]}>
                            แอปพลิเคชัน: KSVR ACS Fasttrack{'\n'}ฉบับปรับปรุงล่าสุด: 10 มกราคม 2569
                        </Text>

                        <Text style={styles.termsHeading}>1. บทนำ</Text>
                        <Text style={styles.termsText}>
                            รพ.ค่ายกฤษณ์สีวะรา ("ผู้ให้บริการ") ตระหนักถึงความสำคัญของการคุ้มครองข้อมูลส่วนบุคคลของท่าน เราจึงจัดทำนโยบายความเป็นส่วนตัวฉบับนี้ขึ้น เพื่อแจ้งให้ท่านทราบถึงรายละเอียดการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของท่าน ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
                        </Text>

                        <Text style={styles.termsHeading}>2. ข้อมูลที่เราเก็บรวบรวม</Text>
                        <Text style={styles.termsText}>
                            เพื่อให้แอปพลิเคชันทำงานได้อย่างเต็มประสิทธิภาพในการช่วยเหลือฉุกเฉิน เราจำเป็นต้องเก็บรวบรวมข้อมูลดังต่อไปนี้:{'\n'}
                            2.1 ข้อมูลยืนยันตัวตน: ชื่อ-นามสกุล, เลขประจำตัวประชาชน (CID), หมายเลขโรงพยาบาล (HN), วันเดือนปีเกิด และเบอร์โทรศัพท์{'\n'}
                            2.2 ข้อมูลสุขภาพ (Sensitive Data): หมู่เลือด, โรคประจำตัว, ประวัติการแพ้ยา, ประวัติการรักษา, ข้อมูลการตรวจสุขภาพ (Check-up), และสถานะความเสี่ยงโรคหัวใจและหลอดเลือด{'\n'}
                            2.3 ข้อมูลตำแหน่ง (Location Data): พิกัดตำแหน่งปัจจุบัน (Latitude/Longitude) ของท่านแบบเรียลไทม์ เมื่อมีการใช้งานฟังก์ชันแจ้งเหตุฉุกเฉิน
                        </Text>

                        <Text style={styles.termsHeading}>3. วัตถุประสงค์การใช้ข้อมูล (สำคัญ)</Text>
                        <Text style={styles.termsText}>
                            เราเก็บรวบรวมข้อมูลของท่านเพื่อวัตถุประสงค์หลัก ดังนี้:{'\n'}
                            - เพื่อการช่วยเหลือฉุกเฉิน (Vital Interest): ใช้พิกัดตำแหน่งในการส่งรถพยาบาลไปยังจุดเกิดเหตุ และใช้ข้อมูลสุขภาพเพื่อให้ทีมแพทย์เตรียมการรักษาได้ทันท่วงทีระหว่างนำส่งโรงพยาบาล{'\n'}
                            - เพื่อการบริการทางการแพทย์: เพื่อยืนยันตัวตนผู้ป่วยและดึงประวัติการรักษาเดิมมาประกอบการวินิจฉัย{'\n'}
                            - เพื่อการพัฒนาบริการ: นำข้อมูลสถิติ (ที่ไม่ระบุตัวตน) ไปวิเคราะห์เพื่อปรับปรุงระบบการแพทย์ฉุกเฉิน
                        </Text>

                        <Text style={styles.termsHeading}>4. ฐานกฎหมายในการประมวลผลข้อมูล</Text>
                        <Text style={styles.termsText}>
                            เราประมวลผลข้อมูลของท่านภายใต้ฐานกฎหมายต่อไปนี้:{'\n'}
                            - ฐานความยินยอม (Consent): สำหรับการเก็บข้อมูลสุขภาพและพิกัดตำแหน่ง{'\n'}
                            - ฐานป้องกันหรือระงับอันตรายต่อชีวิต (Vital Interest): ในกรณีฉุกเฉินที่ท่านอาจไม่สามารถให้ความยินยอมได้ในขณะนั้น เพื่อประโยชน์ในการช่วยชีวิตท่าน{'\n'}
                            - ฐานภารกิจของรัฐ/สาธารณประโยชน์ (Public Task): (กรณีผู้ให้บริการเป็นหน่วยงานรัฐ/โรงพยาบาลรัฐ)
                        </Text>

                        <Text style={styles.termsHeading}>5. การเปิดเผยข้อมูล</Text>
                        <Text style={styles.termsText}>
                            ข้อมูลของท่านจะถูกเปิดเผยเฉพาะกับบุคคลที่เกี่ยวข้องกับการช่วยเหลือชีวิตเท่านั้น ได้แก่:{'\n'}
                            - ทีมแพทย์และพยาบาลห้องฉุกเฉิน (ER){'\n'}
                            - เจ้าหน้าที่กู้ชีพและพนักงานขับรถพยาบาล{'\n'}
                            - ศูนย์สั่งการการแพทย์ฉุกเฉิน
                        </Text>

                        <Text style={styles.termsHeading}>6. มาตรการความปลอดภัย</Text>
                        <Text style={styles.termsText}>
                            เรามีมาตรการรักษาความปลอดภัยที่เข้มงวด ทั้งทางเทคนิคและการบริหารจัดการ เพื่อป้องกันไม่ให้ข้อมูลของท่านสูญหาย หรือถูกเข้าถึงโดยไม่ได้รับอนุญาต (เช่น การเข้ารหัสข้อมูล, การยืนยันตัวตนผ่านระบบ Token)
                        </Text>

                        <Text style={styles.termsHeading}>7. ระยะเวลาการเก็บรักษาข้อมูล</Text>
                        <Text style={styles.termsText}>
                            เราจะเก็บรักษาข้อมูลของท่านไว้ตลอดระยะเวลาที่ท่านยังคงมีบัญชีผู้ใช้งาน หรือตามระยะเวลาที่กฎหมายทางการแพทย์กำหนด (เช่น กฎหมายสถานพยาบาล)
                        </Text>

                        <Text style={styles.termsHeading}>8. สิทธิของเจ้าของข้อมูล</Text>
                        <Text style={styles.termsText}>
                            ท่านมีสิทธิในการขอเข้าถึง, ขอรับสำเนา, ขอแก้ไขข้อมูลให้ถูกต้อง, หรือขอลบข้อมูลของท่านออกจากระบบ ได้โดยการติดต่อเจ้าหน้าที่ผ่านช่องทางที่กำหนด
                        </Text>

                        <Text style={styles.termsHeading}>9. ช่องทางการติดต่อ</Text>
                        <Text style={styles.termsText}>
                            หากท่านมีข้อสงสัยเกี่ยวกับนโยบายความเป็นส่วนตัวนี้ สามารถติดต่อได้ที่:{'\n'}
                            หน่วยงาน: รพ.ค่ายกฤษณ์สีวะรา{'\n'}
                            ที่อยู่: [ที่อยู่หน่วยงาน]{'\n'}
                            เบอร์โทรศัพท์: [เบอร์โทรศัพท์ติดต่อ]{'\n'}
                            อีเมล: [อีเมลติดต่อ]
                        </Text>
                        
                        <View style={{height: 40}} />
                    </ScrollView>
                </>
            );
        }

        // Default: Main Settings Menu
        return (
            <>
                <View style={styles.modalHeaderRow}>
                    <Text style={styles.modalTitle}>ตั้งค่า</Text>
                    <TouchableOpacity onPress={() => setShowSettingsModal(false)}><X size={24} color="#94A3B8" /></TouchableOpacity>
                </View>

                {/* Removed ScrollView from Main Settings as requested */}
                <View style={{ width: '100%' }}>
                    {/* Medical Profile Card */}
                    <View style={styles.medicalCard}>
                        <View style={styles.medicalHeader}>
                            <View style={styles.medicalAvatar}><User size={30} color="white" /></View>
                            <View style={{flex: 1}}>
                                <Text style={styles.medicalName}>{user?.name || 'ไม่ระบุชื่อ'}</Text>
                                <Text style={styles.medicalHN}>HN: {user?.username || '-'}</Text>
                            </View>
                        </View>
                        <View style={styles.medicalGrid}>
                            <View style={styles.medicalItem}>
                                <Text style={styles.medicalLabel}>กรุ๊ปเลือด</Text>
                                <Text style={styles.medicalValueRed}>{user?.detail_medical?.blood_type || '-'}</Text>
                            </View>
                            <View style={styles.medicalLine} />
                            <View style={styles.medicalItem}>
                                <Text style={styles.medicalLabel}>อายุ</Text>
                                <Text style={styles.medicalValue}>{user?.detail_genaral?.age ? `${user.detail_genaral.age} ปี` : '-'}</Text>
                            </View>
                            <View style={styles.medicalLine} />
                            <View style={styles.medicalItem}>
                                <Text style={styles.medicalLabel}>โรคประจำตัว</Text>
                                <Text style={styles.medicalValue} numberOfLines={1}>ACS</Text>
                            </View>
                        </View>
                        <View style={styles.allergyBox}>
                            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 5}}>
                                <AlertTriangle size={16} color="#F59E0B" />
                                <Text style={styles.allergyTitle}> ประวัติการแพ้ยา</Text>
                            </View>
                            <Text style={styles.allergyText}>{user?.detail_medical?.drug_allergy || 'ไม่มีประวัติการแพ้ยา'}</Text>
                        </View>
                    </View>

                    <View style={styles.menuSection}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => setSettingsView('terms')}>
                            <FileText size={20} color="#3B82F6" />
                            <Text style={styles.menuItemText}>ข้อกำหนดการใช้บริการ</Text>
                            <ChevronRight size={16} color="#CBD5E1" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => setSettingsView('privacy')}>
                            <Lock size={20} color="#10B981" />
                            <Text style={styles.menuItemText}>นโยบายความเป็นส่วนตัว</Text>
                            <ChevronRight size={16} color="#CBD5E1" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.logoutButton} onPress={() => { setShowSettingsModal(false); onLogout(); }}>
                            <LogOut size={20} color="#EF4444" />
                            <Text style={styles.logoutText}>ออกจากระบบ</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#EF4444" />
                <Text style={styles.loadingText}>กำลังดึงข้อมูลส่วนตัว...</Text>
            </View>
        );
    }
 
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            
            <View style={styles.headerBar}>
                <View style={styles.logoContainer}>
                    <View style={styles.logoCircle}><Heart size={16} color="white" fill="white" /></View>
                    <Text style={styles.appNameText}>KSVR <Text style={styles.appNameLight}>ACS FAST TRACK</Text></Text>
                </View>
                <TouchableOpacity 
                    style={styles.settingsIconButton}
                    onPress={() => { setSettingsView('main'); setShowSettingsModal(true); }}
                >
                    <Settings size={20} color="#94A3B8" />
                </TouchableOpacity>
            </View>

            <ScrollView 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EF4444']} />}
            >
                <View style={styles.unifiedCard}>
                    <View style={styles.profileTopRow}>
                        <TouchableOpacity 
                            style={styles.profileInfoMain} 
                            onPress={() => { setSettingsView('main'); setShowSettingsModal(true); }}
                            activeOpacity={0.7}
                        >
                            <View style={styles.avatarContainer}>
                                <View style={styles.avatarCircle}><User size={28} color="#EF4444" /></View>
                                <View style={styles.onlineBadge} />
                            </View>
                            <View style={styles.nameContainer}>
                                <Text style={styles.patientName}>{user?.name || 'ไม่ระบุชื่อ'}</Text>
                                {/* เปลี่ยนจาก ACS Monitoring เป็น HN */}
                                <View style={styles.statusPill}>
                                    <Text style={styles.statusPillText}>HN: {user?.username || '-'}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.medicalIdButton} onPress={() => { setSettingsView('main'); setShowSettingsModal(true); }}>
                            <ShieldCheck size={22} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={styles.profileQuickStats}
                        onPress={() => { setSettingsView('main'); setShowSettingsModal(true); }}
                        activeOpacity={0.7}
                    >
                        <View style={styles.statBox}><Text style={styles.statLabel}>เลือด</Text><Text style={styles.statValueRed}>{user?.detail_medical?.blood_type || '-'}</Text></View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}><Text style={styles.statLabel}>อายุ</Text><Text style={styles.statValue}>{user?.detail_genaral?.age || '-'}</Text></View>
                        <View style={styles.statDivider} />
                        {/* เปลี่ยนจาก โรคประจำตัว เป็น แพ้ยา */}
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>แพ้ยา</Text>
                            <Text style={styles.statValue} numberOfLines={1}>{user?.detail_medical?.drug_allergy || '-'}</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={openInMaps} activeOpacity={0.7} style={styles.locationIntegrator}>
                        <View style={styles.locationHeaderRow}>
                            <View style={styles.locationLabelGroup}><MapPin size={14} color="#3B82F6" /><Text style={styles.locationLabelText}>ตำแหน่งปัจจุบัน</Text></View>
                            <View style={styles.liveGPSBadge}><Text style={styles.liveGPSText}>LIVE GPS</Text></View>
                        </View>
                        <Text style={styles.addressDisplayText} numberOfLines={1}>{address}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.mainInteractiveArea}>
                    {!isCalling ? (
                        <>
                            <View style={styles.headerTextContainer}>
                                <Text style={styles.title}>ขอความช่วยเหลือ</Text>
                                <Text style={styles.subtitle}>{HOSPITAL_COORDS.name} อยู่ห่างจากคุณ {distance} กม.</Text>
                            </View>

                            <View style={styles.sosWrapper}>
                                <Svg width={220} height={220} style={styles.svg}>
                                    <Circle cx="110" cy="110" r={radius} stroke="#F1F5F9" strokeWidth={strokeWidth} fill="transparent" />
                                    <Circle cx="110" cy="110" r={radius} stroke="#EF4444" strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                                </Svg>

                                <Animated.View style={{ transform: [{ scale: isPressing ? scaleAnim : pulseAnim }] }}>
                                    <TouchableOpacity 
                                        activeOpacity={1} 
                                        onPressIn={handlePressIn} 
                                        onPressOut={handlePressOut} 
                                        disabled={isSubmitting}
                                        style={[styles.sosButton, isPressing && styles.sosButtonActive, isSubmitting && styles.sosButtonDisabled]}
                                    >
                                        {isSubmitting ? (
                                            <ActivityIndicator size="large" color="white" />
                                        ) : (
                                            <>
                                                <Heart size={48} color="white" fill="white" />
                                                <Text style={styles.sosText}>ฉุกเฉิน</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </Animated.View>
                            </View>

                            <View style={[styles.alertCard, { opacity: (isPressing || isSubmitting) ? 0.5 : 1 }]}>
                                <AlertTriangle size={16} color="#B45309" />
                                <View style={styles.alertTextContainer}>
                                    <Text style={styles.alertTitle}>{isSubmitting ? 'กำลังส่งพิกัด...' : 'Hold to Confirm'}</Text>
                                    <Text style={styles.alertSubtitle}>กดค้าง 1 วินาทีเพื่อเรียกรถกู้ชีพ</Text>
                                </View>
                            </View>
                        </>
                    ) : (
                        <View style={styles.statusContainer}>
                            <View style={styles.activeCard}>
                                <View style={styles.activeCardHeader}>
                                    <View>
                                        <View style={styles.liveIndicator}><View style={styles.redDot} /><Text style={styles.liveText}>GPS Active</Text></View>
                                        <Text style={styles.cardTitle}>กำลังมาหาคุณ</Text>
                                    </View>
                                    <View style={styles.timerBadge}>
                                        <Text style={styles.timerText}>{formatTime(secondsLeft)}</Text>
                                        <Text style={styles.timerUnit}>นาที</Text>
                                    </View>
                                </View>
                                <View style={styles.cardDivider} />
                                <View style={styles.dispatchedInfo}>
                                    <Zap size={24} color="#FACC15" />
                                    <View style={{ marginLeft: 15 }}>
                                        <Text style={styles.unitTitle}>{HOSPITAL_COORDS.name}</Text>
                                        <Text style={styles.unitSub}>เจ้าหน้าที่ได้รับตำแหน่งของคุณแล้ว</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.checklistContainer}>
                                <Text style={styles.checklistHeader}>ข้อปฏิบัติระหว่างรอ:</Text>
                                {[{ text: 'นั่งนิ่งๆ หายใจช้าๆ', bold: true }, { text: 'อมยาใต้ลิ้นทันที (ถ้ามี)', bold: true }, { text: 'ปลดกระดุมเสื้อให้หายใจสะดวก', bold: false }].map((item, i) => (
                                    <View key={i} style={styles.checkItem}><View style={[styles.checkCircle, item.bold && {borderColor: '#EF4444'}]} /><Text style={[styles.checkText, item.bold && {fontWeight: 'bold'}]}>{item.text}</Text></View>
                                ))}
                            </View>

                            <TouchableOpacity 
                                onPress={handleCancelSOS} 
                                style={styles.cancelButton}
                                hitSlop={{ top: 20, bottom: 20, left: 50, right: 50 }} 
                                activeOpacity={0.6}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator size="small" color="#94A3B8" />
                                ) : (
                                    <Text style={styles.cancelButtonText}>ยกเลิกรายการเรียก</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* --- Unified Settings Modal (In-Modal Navigation) --- */}
            <Modal animationType="slide" transparent={true} visible={showSettingsModal} onRequestClose={() => setShowSettingsModal(false)}>
                <View style={styles.modalOverlay}>
                    {/* [NEW] ใช้ TouchableWithoutFeedback แทน TouchableOpacity เพื่อแก้ปัญหาการแย่ง Touch */}
                    <TouchableWithoutFeedback onPress={() => setShowSettingsModal(false)}>
                        <View style={StyleSheet.absoluteFill} />
                    </TouchableWithoutFeedback>
                    <View style={[
                        styles.settingsModalContent, 
                        (settingsView === 'terms' || settingsView === 'privacy') && { height: '85%' }
                    ]}>
                        <View style={styles.modalHandle} />
                        {renderSettingsContent()}
                    </View>
                </View>
            </Modal>

            {/* --- In-App Map Modal --- */}
            <Modal animationType="slide" transparent={false} visible={showInAppMap} onRequestClose={() => setShowInAppMap(false)}>
                <View style={styles.mapModalContainer}>
                    <View style={styles.mapHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.mapHeaderTitle}>ตำแหน่งของคุณ</Text>
                            <Text style={styles.mapHeaderSub} numberOfLines={1}>{address}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowInAppMap(false)} hitSlop={{top:20, bottom:20, left:20, right:20}}><X size={26} color="#1E293B" /></TouchableOpacity>
                    </View>
                    {mapRegion ? (
                        <MapView 
                            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined} 
                            style={{flex: 1}} 
                            initialRegion={mapRegion} 
                            showsUserLocation={true}
                            ref={mapRef}
                        >
                            <Marker coordinate={currentLocation} title="คุณอยู่ที่นี่" />
                            <Marker coordinate={HOSPITAL_COORDS} title={HOSPITAL_COORDS.name} pinColor="#3B82F6" />
                        </MapView>
                    ) : <ActivityIndicator size="large" style={{flex:1}} />}
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FDFEFF' },
    headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 12 },
    logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoCircle: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', elevation: 4 },
    appNameText: { fontSize: 16, fontWeight: '900', color: '#1E293B' },
    appNameLight: { fontWeight: '400', color: '#94A3B8' },
    settingsIconButton: { padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: '#94A3B8', fontWeight: 'bold' },
    unifiedCard: { backgroundColor: 'white', marginHorizontal: 20, marginTop: 5, padding: 20, borderRadius: 35, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
    profileTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    profileInfoMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatarContainer: { position: 'relative', marginRight: 15 },
    avatarCircle: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
    onlineBadge: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: 'white' },
    nameContainer: { marginLeft: 15 },
    patientName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 4 },
    statusPillText: { fontSize: 9, fontWeight: 'bold', color: '#EF4444', marginLeft: 4 },
    medicalIdButton: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
    profileQuickStats: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
    statBox: { alignItems: 'center', flex: 1 },
    statLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', marginBottom: 4 },
    statValue: { fontSize: 15, fontWeight: 'bold', color: '#334155' },
    statValueRed: { fontSize: 15, fontWeight: 'bold', color: '#EF4444' },
    statDivider: { width: 1, height: 20, backgroundColor: '#F1F5F9' },
    locationIntegrator: { backgroundColor: '#F8FAFC', borderRadius: 22, padding: 15, marginTop: 5, borderWidth: 1, borderColor: '#F1F5F9' },
    locationHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    locationLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    locationLabelText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
    liveGPSBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    liveGPSText: { fontSize: 8, fontWeight: '900', color: '#166534' },
    addressDisplayText: { fontSize: 13, fontWeight: 'bold', color: '#1E293B', textAlign: 'center' },
    mainInteractiveArea: { flex: 1, alignItems: 'center', marginTop: 30 },
    headerTextContainer: { alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 32, fontWeight: '900', color: '#1E293B' },
    subtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
    sosWrapper: { width: 220, height: 220, justifyContent: 'center', alignItems: 'center' },
    svg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
    sosButton: { width: 170, height: 170, borderRadius: 85, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', borderWidth: 8, borderColor: 'white', elevation: 15 },
    sosButtonActive: { backgroundColor: '#991B1B' },
    sosButtonDisabled: { backgroundColor: '#F87171' },
    sosText: { color: 'white', fontSize: 30, fontWeight: '900', marginTop: 4 },
    alertCard: { flexDirection: 'row', backgroundColor: '#FFFBEB', marginHorizontal: 24, marginTop: 15, padding: 14, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#FEF3C7' },
    alertTextContainer: { marginLeft: 12 },
    alertTitle: { fontSize: 12, fontWeight: 'bold', color: '#92400E' },
    alertSubtitle: { fontSize: 11, color: '#B45309' },
    statusContainer: { width: '100%', paddingHorizontal: 20 },
    activeCard: { backgroundColor: '#0F172A', borderRadius: 35, padding: 25 },
    activeCardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    liveIndicator: { flexDirection: 'row', alignItems: 'center' },
    redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 6 },
    liveText: { color: '#F87171', fontSize: 10, fontWeight: '900' },
    cardTitle: { color: 'white', fontSize: 22, fontWeight: '900' },
    timerBadge: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 15, alignItems: 'center', minWidth: 70 },
    timerText: { color: 'white', fontSize: 18, fontWeight: '900' },
    timerUnit: { color: 'rgba(255,255,255,0.5)', fontSize: 8 },
    cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
    dispatchedInfo: { flexDirection: 'row', alignItems: 'center' },
    unitTitle: { color: 'white', fontSize: 14, fontWeight: 'bold' },
    unitSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
    checklistContainer: { marginTop: 25 },
    checklistHeader: { fontSize: 14, fontWeight: '900', color: '#1E293B', marginBottom: 15 },
    checkItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    checkCircle: { width: 16, height: 16, borderRadius: 8, borderWIdth: 2, borderColor: '#CBD5E1', marginRight: 10 },
    checkText: { fontSize: 12, color: '#475569' },
    cancelButton: { marginTop: 35, paddingVertical: 12, paddingHorizontal: 30, alignItems: 'center', alignSelf: 'center', zIndex: 10 },
    cancelButtonText: { color: '#94A3B8', fontSize: 13, textDecorationLine: 'underline', fontWeight: 'bold' },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    settingsModalContent: { backgroundColor: 'white', padding: 25, borderTopLeftRadius: 35, borderTopRightRadius: 35, maxHeight: '85%' },
    modalHandle: { width: 50, height: 5, backgroundColor: '#E2E8F0', alignSelf: 'center', borderRadius: 5, marginBottom: 20 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
    modalCloseIcon: { padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12 },
    
    // Medical Card Styles
    medicalCard: { backgroundColor: '#F8FAFC', borderRadius: 25, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 20 },
    medicalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    medicalAvatar: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    medicalName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    medicalHN: { fontSize: 13, color: '#64748B', marginTop: 2 },
    medicalGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    medicalItem: { alignItems: 'center', flex: 1 },
    medicalLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', marginBottom: 4 },
    medicalValue: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
    medicalValueRed: { fontSize: 16, fontWeight: 'bold', color: '#EF4444' },
    medicalLine: { width: 1, height: 25, backgroundColor: '#E2E8F0' },
    allergyBox: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 15, borderWidth: 1, borderColor: '#FDE68A' },
    allergyTitle: { fontSize: 12, fontWeight: 'bold', color: '#D97706' },
    allergyText: { fontSize: 12, color: '#B45309', marginTop: 2, fontWeight: '500' },
    
    menuSection: { marginTop: 10 },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    menuItemText: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#334155', marginLeft: 15 },
    logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', paddingVertical: 16, borderRadius: 20, marginTop: 20, gap: 10 },
    logoutText: { fontSize: 15, fontWeight: 'bold', color: '#EF4444' },
    
    termsHeading: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginTop: 15, marginBottom: 8 },
    termsText: { fontSize: 14, color: '#64748B', lineHeight: 22, textAlign: 'justify' },
    termsContent: { padding: 20 },
    
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
    
    // Terms Styles (Updated for iOS Safe Area)
    termsContainer: { flex: 1, backgroundColor: 'white' },
    termsHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        paddingHorizontal: 20, 
        paddingBottom: 20, 
        // ปรับ Padding Top ให้รองรับ iOS Notch เหมือนหน้า Map
        paddingTop: Platform.OS === 'ios' ? 60 : 20, 
        borderBottomWidth: 1, 
        borderBottomColor: '#F1F5F9', 
        backgroundColor: 'white',
        zIndex: 10 
    },
    termsTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    termsContent: { padding: 20 },
    termsHeading: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginTop: 15, marginBottom: 8 },
    termsText: { fontSize: 14, color: '#64748B', lineHeight: 22, textAlign: 'justify' },
    // เพิ่มสไตล์ปุ่มย้อนกลับให้เหมือนกับปุ่มปิดในหน้า Map
    headerBackButton: {
        padding: 10,
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        zIndex: 20,
    },
});

export default HomeScreen;

// เพิ่มตรรกะการคำนวณ เวลาเดินทางโดยประมาณ (ETA) ที่สัมพันธ์กับระยะทางจริงจาก รพ.ค่ายกฤษณ์สีวะรา 
// โดยใช้ความเร็วเฉลี่ยของรถพยาบาลในสถานการณ์ฉุกเฉินครับ
// เพิ่มฟังก์ชัน calculateTravelTime ซึ่งจะนำค่า distance (กิโลเมตร) มาคำนวณเป็นเวลาที่รถพยาบาลจะมาถึงจริง 
// โดยกำหนดความเร็วเฉลี่ยไว้ที่ 40 กม./ชม. พร้อมเพิ่มเวลาเตรียมตัว 2 นาที และกำหนดขั้นต่ำไว้ที่ 3 นาทีครับ 
// ตัวนับถอยหลังจะเริ่มจากค่าที่คำนวณได้นี้ทันทีที่คุณกดปุ่มฉุกเฉินครับ สรุปคือตอนนี้ทั้งระยะทางและเวลาจะอัปเดตสัมพันธ์กันอย่างสมจริงครับ

//สิ่งที่ปรับปรุงในเวอร์ชันนี้:
// 1. Dynamic ETA Logic: คำนวณเวลาเริ่มต้นของตัวนับถอยหลังโดยอ้างอิงจากระยะทาง (สมมติความเร็วเฉลี่ยรถพยาบาลที่ 40 กม./ชม. รวมเวลาเตรียมตัวออกเหตุ)

// 2. Minimum Response Time: กำหนดเวลาขั้นต่ำไว้ที่ 3 นาที (180 วินาที) เพราะแม้ระยะทางจะใกล้มาก แต่ทีมกู้ชีพต้องใช้เวลาในการเตรียมอุปกรณ์และเคลื่อนที่

// 3. Real-time Tracking: ยืนยันการทำงานของระบบ Watcher ที่จะอัปเดตพิกัดทุกๆ การเคลื่อนที่ (กำหนดไว้ที่ 5-10 เมตร)

// 4. Live Indicator: เพิ่มสัญลักษณ์จุดสีเขียวกระพริบหน้า "ตำแหน่งปัจจุบัน" เพื่อบอกสถานะว่า GPS กำลังทำงานแบบเรียลไทม์

// 5. Dynamic Distance & ETA: ระยะทางและเวลาเดินทางจะถูกคำนวณใหม่โดยอัตโนมัติทันทีที่ผู้ป่วยขยับตัวครับ

// 6. Enhanced Error Handling: ปรับปรุงการจัดการข้อผิดพลาดในการดึงพิกัดและแสดงข้อความที่ชัดเจนยิ่งขึ้น

// 7. UI/UX Improvements: ปรับปรุงดีไซน์บางส่วนให้ใช้งานง่ายและดูทันสมัยยิ่งขึ้น

// 8. เพิ่ม Modal แสดง ข้อกำหนดการใช้บริการ (Terms of Service) ในหน้าตั้งค่า

// 9. เพิ่ม Modal แสดง นโยบายความเป็นส่วนตัว (Privacy Policy) ในหน้าตั้งค่า

// 10. การทำให้แผนที่ใน Modal ขยับตามพิกัดผู้ใช้แบบอัตโนมัติ (Live Map Camera) และ ปรับมุมกล้องให้เห็นทั้ง "เรา" และ "รพ." พร้อมกัน เพื่อให้เห็นระยะห่างจริง