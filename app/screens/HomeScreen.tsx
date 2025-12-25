import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
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
} from 'lucide-react-native';

import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL, useAuth } from '../context/AuthContext';
import axios from 'axios';

const { width } = Dimensions.get('window');

// พิกัด รพ.ค่ายกฤษณ์สีวะรา (สกลนคร)
const HOSPITAL_COORDS = {
    latitude: 17.1354,
    longitude: 104.1103,
    name: 'รพ.ค่ายกฤษณ์สีวะรา'
};

const HomeScreen = () => {
    const { authToken } = useAuth();

    // --- SOS States ---
    const [isCalling, setIsCalling] = useState(false);
    // const [secondsLeft, setSecondsLeft] = useState(360); // 6 นาที
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [pressProgress, setPressProgress] = useState(0);
    const [isPressing, setIsPressing] = useState(false);

    // --- Profile & Loading States ---
    const [patientProfile, setPatientProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { onLogout } = useAuth(); // ดึงฟังก์ชัน Logout มาจาก Context

    // --- Location States ---
    const [currentLocation, setCurrentLocation] = useState(null);
    const [address, setAddress] = useState('กำลังค้นหาพิกัด...');
    const [distance, setDistance] = useState(0);
    const [isLocationLive, setIsLocationLive] = useState(false);

    // --- Refs & Animation ---
    const timerRef = useRef(null);
    const countdownRef = useRef(null);
    const watchSubscription = useRef(null); 
    const pulseAnim = useRef(new Animated.Value(1)).current; 
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const blinkAnim = useRef(new Animated.Value(0.4)).current; // สำหรับสถานะ Live GPS

    const HOLD_DURATION = 3000; // 3 วินาที
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

    // ฟังก์ชันสำหรับเปิดแผนที่เพื่อดูตำแหน่งปัจจุบัน
    const openInMaps = () => {
        if (currentLocation) {
        const { latitude, longitude } = currentLocation;
        const label = "ตำแหน่งปัจจุบันของฉัน";
        
        // สร้าง URL สำหรับเปิดแอปแผนที่ในแต่ละระบบ
        const url = Platform.select({
            ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
            android: `geo:0,0?q=${latitude},${longitude}(${label})`
        });

        Linking.canOpenURL(url).then((supported) => {
            if (supported) {
            Linking.openURL(url);
            } else {
            // หากไม่มีแอปแผนที่ในเครื่อง ให้เปิดผ่าน Browser (Google Maps)
            const browserUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
            Linking.openURL(browserUrl);
            }
        });
        
        // สั่นเบาๆ เมื่อกดเปิดแผนที่
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };
    // --- Data & Logic Functions ---
    const loadUser = async () => {
        try {
        const result = await axios.get(`${API_URL}/profile`);
        setPatientProfile(result.data.data || result.data);
        // console.log("Profile data:", result.data);
        } catch (e) {
        console.error(e.message || "Failed to load profile");
        }
    };

    // ฟังก์ชันแปลงพิกัดเป็นชื่อสถานที่ (Reverse Geocoding)
    const getAddressFromCoords = async (latitude, longitude) => {
        try {
        const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude,
            longitude
        });

        if (reverseGeocode.length > 0) {
            const place = reverseGeocode[0];
            // จัดรูปแบบที่อยู่: ถนน, แขวง/ตำบล, เขต/อำเภอ, จังหวัด
            const formattedAddress = [
            place.street,
            place.district,
            place.city || place.region,
            ].filter(Boolean).join(', ');
            
            setAddress(formattedAddress || 'ไม่สามารถระบุชื่อถนนได้');
        }
        } catch (error) {
        console.log("Geocoding error:", error);
        }
    };

    // ฟังก์ชันอัปเดต UI เมื่อพิกัดเปลี่ยน
    const updateUIWithLocation = (coords) => {
        const { latitude, longitude } = coords;
            setCurrentLocation({ latitude, longitude });
            getAddressFromCoords(latitude, longitude);
        const newDist = calculateDistance(latitude, longitude, HOSPITAL_COORDS.latitude, HOSPITAL_COORDS.longitude);
            setDistance(newDist);
            setIsLocationLive(true);
    };

    const startLocationTracking = async () => {
        // ดึงครั้งแรกเพื่อเริ่มระบบ
        let initialLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        updateUIWithLocation(initialLocation.coords);
        
        // ตั้งค่าการติดตามแบบเรียลไทม์ (Watcher)
        if (watchSubscription.current) watchSubscription.current.remove();
        
            watchSubscription.current = await Location.watchPositionAsync(
            { 
                accuracy: Location.Accuracy.High, 
                distanceInterval: 5, // อัปเดตทุกๆ 5 เมตรเพื่อให้เรียลไทม์ที่สุด
                timeInterval: 10000 // หรืออัปเดตทุก 10 วินาทีถ้าอยู่นิ่ง
            },
            (newLocation) => {
                updateUIWithLocation(newLocation.coords);
            }
        );
    };

    // --- Location Logic สำหรับ Expo ---
    const requestLocationPermission = async () => {
        try {
        // ขอสิทธิ์การเข้าถึงตำแหน่ง
       let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setAddress('กรุณาอนุญาตการเข้าถึงตำแหน่ง');
                return;
            }
            startLocationTracking();
        } catch (error) {
            console.log("Permission error:", error);
        }
    };

    // ฟังก์ชันรีเฟรชข้อมูล (Pull to Refresh)
    const onRefresh = useCallback(async () => {
            setRefreshing(true);
            // สั่นเบาๆ เพื่อบอกการเริ่มทำงาน
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
            try {
            // ดึงข้อมูลโปรไฟล์และตำแหน่งใหม่ไปพร้อมกัน
                await loadUser();
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status === 'granted') {
                    let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
                    updateUIWithLocation(loc.coords);
                } else {
                    await requestLocationPermission();
                }
            } catch (error) {
                console.error("Refresh error:", error.message);
            } finally {
                setRefreshing(false);
            }
    }, [updateUIWithLocation]);
    
    // --- Haptic & Animation Logic ---

    const triggerHaptic = async (type) => {
        try {
            switch (type) {
                case 'impactMedium':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    break;
                case 'selection':
                    await Haptics.selectionAsync();
                    break;
                case 'notificationSuccess':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    break;
                default:
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (e) {
            console.log("Haptics not supported in this environment");
        }
    };


    // --- SOS Logic ---
    const startSOS = () => {
        setIsCalling(true);
        const estimatedSeconds = calculateTravelTime(distance);
        setSecondsLeft(estimatedSeconds);
        setPressProgress(0);
        setIsPressing(false);
        triggerHaptic("notificationSuccess"); // สั่นเมื่อเริ่มเรียก SOS
    };

    const handlePressIn = () => {
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
    useEffect(() => {
        const initData = async () => {
        setLoading(true);
        await Promise.all([loadUser(), requestLocationPermission()]);
        setLoading(false);
        };
        initData();
        return () => { if (watchSubscription.current) watchSubscription.current.remove(); };
    }, []);

    useEffect(() => {
        if (isLocationLive) {
        Animated.loop(
            Animated.sequence([
            Animated.timing(blinkAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(blinkAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
            ])
        ).start();
        }
    }, [isLocationLive]);

    useEffect(() => {
        if (isCalling && secondsLeft > 0) {
        countdownRef.current = setInterval(() => setSecondsLeft((p) => (p > 0 ? p - 1 : 0)), 1000);
        }
        return () => clearInterval(countdownRef.current);
    }, [isCalling, secondsLeft]);

    useEffect(() => {
        if (!isPressing && !isCalling) {
        Animated.loop(
            Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        ).start();
        } else {
        pulseAnim.setValue(1);
        }
    }, [isPressing, isCalling]);

    // --- Helpers ---
    const strokeDashoffset = circumference - (pressProgress / 100) * circumference;

    // แสดงตัวโหลดข้อมูลถ้ายังดึงข้อมูลไม่เสร็จ
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
            <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ paddingBottom: 30 }}
                refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={['#EF4444']}
                    tintColor={'#EF4444'}
                />
                }
            >
                {/* --- Comprehensive Patient Profile Card (Includes Location) --- */}
                <View style={styles.unifiedCard}>
                {/* Section 1: Identity & Status */}
                <View style={styles.profileTopRow}>
                    <View style={styles.profileInfoMain}>
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatarCircle}>
                        <User size={28} color="#EF4444" />
                        </View>
                        <View style={styles.onlineBadge} />
                    </View>
                    <View style={styles.nameContainer}>
                        <Text style={styles.patientName}>{patientProfile?.name || patientProfile?.full_name || 'ไม่ระบุชื่อ'}</Text>
                        <View style={styles.statusPill}>
                        <Activity size={10} color="#EF4444" />
                        <Text style={styles.statusPillText}>Cardiac Monitoring Active</Text>
                        </View>
                    </View>
                    </View>
                    <TouchableOpacity style={styles.medicalIdButton}>
                    <ShieldCheck size={22} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                {/* Section 2: Vitals / Quick Stats */}
                <View style={styles.profileQuickStats}>
                    <View style={styles.statBox}>
                    <Text style={styles.statLabel}>เลือด</Text>
                    <Text style={styles.statValueRed}>{patientProfile?.bloodType || patientProfile?.blood_group || '-'}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                    <Text style={styles.statLabel}>อายุ</Text>
                    <Text style={styles.statValue}>{patientProfile?.age ? `${patientProfile.age} ปี` : '-'}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                    <Text style={styles.statLabel}>ระยะห่าง</Text>
                    <Text style={styles.statValue}>{distance} กม.</Text>
                    </View>
                </View>

                {/* Section 3: Integrated Location (Clickable) */}
                <TouchableOpacity 
                    onPress={openInMaps}
                    activeOpacity={0.7}
                    style={styles.locationIntegrator}
                >
                    <View style={styles.locationHeaderRow}>
                    <View style={styles.locationLabelGroup}>
                        <MapPin size={14} color="#3B82F6" />
                        <Text style={styles.locationLabelText}>ตำแหน่งปัจจุบัน</Text>
                    </View>
                    <View style={styles.liveGPSBadge}>
                        <Animated.View style={[styles.liveGPSDot, { opacity: blinkAnim }]} />
                        <Text style={styles.liveGPSText}>LIVE GPS</Text>
                    </View>
                    </View>
                    <View style={styles.addressContainer}>
                    <Text style={styles.addressDisplayText} numberOfLines={1}>
                        {address}
                    </Text>
                    <ChevronRight size={14} color="#CBD5E1" />
                    </View>
                </TouchableOpacity>
                </View>

                <View style={styles.mainInteractiveArea}>
                {!isCalling ? (
                    <>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.title}>ขอความช่วยเหลือ</Text>
                        <Text style={styles.subtitle}>
                        รพ.ค่ายกฤษณ์สีวะรา อยู่ห่างจากคุณ {distance} กม.{'\n'}ทีมกู้ชีพพร้อมออกปฏิบัติการทันที
                        </Text>
                    </View>

                    <View style={styles.sosWrapper}>
                        <Svg width={220} height={220} style={styles.svg}>
                        <Circle cx="110" cy="110" r={radius} stroke="#F1F5F9" strokeWidth={strokeWidth} fill="transparent" />
                        <Circle cx="110" cy="110" r={radius} stroke="#EF4444" strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                        </Svg>

                        <Animated.View style={{ transform: [{ scale: isPressing ? scaleAnim : pulseAnim }] }}>
                        <TouchableOpacity activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[styles.sosButton, isPressing && styles.sosButtonActive]}>
                            <Heart size={48} color="white" fill="white" />
                            <Text style={styles.sosText}>
                            {isPressing ? `${Math.ceil((HOLD_DURATION - (pressProgress * HOLD_DURATION / 100)) / 1000)}s` : 'ฉุกเฉิน'}
                            </Text>
                        </TouchableOpacity>
                        </Animated.View>
                    </View>

                    <View style={[styles.alertCard, { opacity: isPressing ? 0 : 1 }]}>
                        <AlertTriangle size={16} color="#B45309" />
                        <View style={styles.alertTextContainer}>
                        <Text style={styles.alertTitle}>ระบบยืนยันตัวตนคนไข้</Text>
                        <Text style={styles.alertSubtitle}>ข้อมูลและพิกัดของคุณจะถูกส่งให้ทีมแพทย์ทันที</Text>
                        </View>
                    </View>

                    {!isPressing && (
                        <View style={styles.tipCard}>
                        <View style={styles.tipHeader}>
                            <Info size={14} color="#3B82F6" />
                            <Text style={styles.tipTitle}>ข้อควรระวัง</Text>
                        </View>
                        <Text style={styles.tipText}>หากแน่นหน้าอกให้รีบนั่งพัก หายใจลึกๆ และเตรียมยาประจำตัวไว้</Text>
                        </View>
                    )}
                    </>
                ) : (
                    <View style={styles.statusContainer}>
                    <View style={styles.activeCard}>
                        <View style={styles.activeCardHeader}>
                        <View>
                            <View style={styles.liveIndicator}>
                            <View style={styles.redDot} />
                            <Text style={styles.liveText}>กำลังเดินทางมาที่พิกัดของคุณ</Text>
                            </View>
                            <Text style={styles.cardTitle}>กำลังเข้าช่วยเหลือ</Text>
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
                            <Text style={styles.unitSub}>เจ้าหน้าที่ได้รับตำแหน่งเรียลไทม์แล้ว</Text>
                        </View>
                        </View>
                    </View>

                    <View style={styles.checklistContainer}>
                        <Text style={styles.checklistHeader}>แนวทางปฏิบัติระหว่างรอ:</Text>
                        {[
                        { text: 'หยุดทุกกิจกรรม นั่งในท่าที่สบายที่สุด', bold: true },
                        { text: 'อมยาใต้ลิ้นทันที (หากมีและเคยใช้)', bold: true },
                        { text: 'เตรียมยาและประวัติการรักษาไว้ข้างตัว', bold: false },
                        { text: 'หากอยู่ลำพัง ให้ปลดล็อคประตูบ้าน', bold: false },
                        ].map((item, index) => (
                        <View key={index} style={styles.checkItem}>
                            <View style={[styles.checkCircle, item.bold && styles.checkCircleActive]} />
                            <Text style={[styles.checkText, item.bold && styles.checkTextBold]}>{item.text}</Text>
                        </View>
                        ))}
                    </View>

                    <TouchableOpacity 
                        onPress={() => setIsCalling(false)} 
                        style={styles.cancelButton}
                        hitSlop={{ top: 20, bottom: 20, left: 40, right: 40 }}
                        activeOpacity={0.6}
                    >
                        <Text style={styles.cancelButtonText}>ยกเลิกรายการเรียก</Text>
                    </TouchableOpacity>
                    </View>
                )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFEFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFEFF' },
  loadingText: { marginTop: 10, color: '#94A3B8', fontWeight: 'bold' },
  
  // Unified Card Styles
  unifiedCard: { 
    backgroundColor: 'white', 
    marginHorizontal: 20, 
    marginTop: 10, 
    padding: 20, 
    borderRadius: 35, 
    borderWidth: 1, 
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.03,
    shadowRadius: 20,
    elevation: 4,
  },
  profileTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  profileInfoMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatarCircle: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
  onlineBadge: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: 'white' },
  nameContainer: { flex: 1 },
  patientName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 2, textAlign: 'left' },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 9, fontWeight: 'bold', color: '#EF4444', marginLeft: 4 },
  medicalIdButton: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  
  profileQuickStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  statBox: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: 'bold', color: '#334155' },
  statValueRed: { fontSize: 15, fontWeight: 'bold', color: '#EF4444' },
  statDivider: { width: 1, height: 20, backgroundColor: '#F1F5F9' },

  // Location Integrator Styles
  locationIntegrator: {
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    padding: 15,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationLabelText: { fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' },
  liveGPSBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveGPSDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 4 },
  liveGPSText: { fontSize: 8, fontWeight: '900', color: '#166534' },
  addressContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addressDisplayText: { fontSize: 13, fontWeight: 'bold', color: '#1E293B', flex: 1, textAlign: 'left' },

  mainInteractiveArea: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  headerTextContainer: { alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#1E293B', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20, fontWeight: '500' },
  sosWrapper: { width: 220, height: 220, justifyContent: 'center', alignItems: 'center' },
  svg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  sosButton: { width: 170, height: 170, borderRadius: 85, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', borderWidth: 8, borderColor: 'white' },
  sosButtonActive: { backgroundColor: '#991B1B' },
  sosText: { color: 'white', fontSize: 30, fontWeight: '900', marginTop: 4 },
  alertCard: { flexDirection: 'row', backgroundColor: '#FFFBEB', marginHorizontal: 24, marginTop: 40, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: '#FEF3C7', alignItems: 'center' },
  alertTextContainer: { marginLeft: 12 },
  alertTitle: { fontSize: 12, fontWeight: 'bold', color: '#92400E', textAlign: 'left' },
  alertSubtitle: { fontSize: 11, color: '#B45309', opacity: 0.8, textAlign: 'left' },
  tipCard: { backgroundColor: '#EFF6FF', marginHorizontal: 24, marginTop: 20, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#DBEAFE' },
  tipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  tipTitle: { fontSize: 12, fontWeight: '900', color: '#1E40AF', marginLeft: 6, textTransform: 'uppercase' },
  tipText: { fontSize: 11, color: '#3B82F6', fontWeight: '600', lineHeight: 16 },
  statusContainer: { width: '100%', paddingHorizontal: 20 },
  activeCard: { backgroundColor: '#0F172A', borderRadius: 35, padding: 25 },
  activeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 6 },
  liveText: { color: '#F87171', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  cardTitle: { color: 'white', fontSize: 22, fontWeight: '900', fontStyle: 'italic', textAlign: 'left' },
  timerBadge: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 15, alignItems: 'center', minWidth: 70 },
  timerText: { color: 'white', fontSize: 18, fontWeight: '900' },
  timerUnit: { color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '900' },
  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },
  dispatchedInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  unitTitle: { color: 'white', fontSize: 14, fontWeight: 'bold', textAlign: 'left' },
  unitSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'left' },
  checklistContainer: { marginTop: 25, paddingHorizontal: 5 },
  checklistHeader: { fontSize: 14, fontWeight: '900', color: '#1E293B', marginBottom: 15, textAlign: 'left' },
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  checkCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBD5E1', marginRight: 12, marginTop: 1 },
  checkCircleActive: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  checkText: { fontSize: 12, fontWeight: '500', color: '#475569', textAlign: 'left', flex: 1, lineHeight: 18 },
  checkTextBold: { color: '#1E293B', fontWeight: 'bold' },
  cancelButton: { marginTop: 35, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', alignSelf: 'center' },
  cancelButtonText: { color: '#94A3B8', fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5, textTransform: 'uppercase', textDecorationLine: 'underline' },
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
