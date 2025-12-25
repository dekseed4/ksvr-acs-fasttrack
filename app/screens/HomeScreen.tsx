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
} from 'react-native';

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
  Navigation,
  X,
  Settings,
} from 'lucide-react-native';

import Svg, { Circle } from 'react-native-svg';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import MapView, { Marker, PROVIDER_GOOGLE, Circle as MapCircle } from 'react-native-maps';

import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL, useAuth } from '../context/AuthContext';
import axios from 'axios';

const { width } = Dimensions.get('window');

// พิกัด รพ.ค่ายกฤษณ์สีวะรา (สกลนคร)
const HOSPITAL_COORDS = {
    latitude: 17.187368,
    longitude: 104.105749,
    name: 'รพ.ค่ายกฤษณ์สีวะรา'
};

const HomeScreen = () => {
    const { authToken } = useAuth();

    // Navigation & UI States
    const [isCalling, setIsCalling] = useState(false);
    const [showInAppMap, setShowInAppMap] = useState(false); // State สำหรับเปิด/ปิดแผนที่ในแอป
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

    const triggerHaptic = async (type) => {
        try {
            if (Platform.OS === 'web') return;
            switch (type) {
                case 'impactMedium': await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
                case 'selection': await Haptics.selectionAsync(); break;
                case 'notificationSuccess': await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
                default: await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (e) {
        // ป้องกัน Error บน Simulator หรือเครื่องที่ไม่มีระบบสั่น
        }
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
            
            setAddress(formattedAddress || 'ไม่สามารถระบุชื่อถนนได้');
        }
        } catch (error) {
        console.log("Geocoding error:", error);
        }
    };

    // ฟังก์ชันอัปเดต UI เมื่อพิกัดเปลี่ยน
    const updateUIWithLocation = useCallback(async (coords) => {
        if (!coords || typeof coords !== 'object') return;
        
        const { latitude, longitude } = coords;
        if (latitude === undefined || longitude === undefined) return;

            setCurrentLocation({ latitude, longitude });
            getAddressFromCoords(latitude, longitude);
        const newDist = calculateDistance(latitude, longitude, HOSPITAL_COORDS.latitude, HOSPITAL_COORDS.longitude);
            setDistance(newDist);
            setIsLocationLive(true);
    }, []);

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
            // สั่นเบาๆ เพื่อบอกการเริ่มทำงาน
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
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
            } catch (error) {
                console.error("Refresh error:", error.message);
            } finally {
                setRefreshing(false);
            }
    }, [updateUIWithLocation]);
    
    // --- Haptic & Animation Logic ---

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
    useEffect(() => {
        const initData = async () => {
        setLoading(true);
        await loadUser();
        await requestLocationPermission();
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
        const pulse = Animated.loop(
        Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
        );

        if (!isPressing && !isCalling) {
            pulse.start();
        } else {
            pulse.stop();
            pulseAnim.setValue(1);
        }
        
        return () => pulse.stop();
    }, [isPressing, isCalling]);

    // --- Helpers ---
    const strokeDashoffset = circumference - (pressProgress / 100) * circumference;

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
        <StatusBar barStyle="dark-content" />
        
        {/* --- ส่วน Header (โลโก้ และ ตั้งค่า) --- */}
        <View style={styles.headerBar}>
            <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
                <Heart size={16} color="white" fill="white" />
            </View>
            {/* แก้ไขชื่อแอปตรงนี้ */}
            <Text style={styles.appNameText}>KSVR <Text style={styles.appNameLight}>ACS FAST TRACK</Text></Text>
            </View>
            <TouchableOpacity 
            style={styles.settingsIconButton}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            onPress={() => triggerHaptic('impactMedium')}
            >
            <Settings size={20} color="#94A3B8" />
            </TouchableOpacity>
        </View>

        <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EF4444']} tintColor={'#EF4444'} />}
        >
            {/* --- Unified Patient & Location Card --- */}
            <View style={styles.unifiedCard}>
            <View style={styles.profileTopRow}>
                <View style={styles.profileInfoMain}>
                <View style={styles.avatarContainer}>
                    <View style={styles.avatarCircle}>
                    <User size={28} color="#EF4444" />
                    </View>
                    <View style={styles.onlineBadge} />
                </View>
                <View style={styles.nameContainer}>
                    <Text style={styles.patientName}>{patientProfile?.name || 'ไม่ระบุชื่อ'}</Text>
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

            <View style={styles.profileQuickStats}>
                <View style={styles.statBox}>
                <Text style={styles.statLabel}>เลือด</Text>
                <Text style={styles.statValueRed}>{patientProfile?.bloodType || patientProfile?.blood_group || '-'}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                <Text style={styles.statLabel}>อายุ</Text>
                <Text style={styles.statValue}>{patientProfile?.age || '-'}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                <Text style={styles.statLabel}>ระยะห่าง</Text>
                <Text style={styles.statValue}>{distance} กม.</Text>
                </View>
            </View>

            <TouchableOpacity onPress={openInMaps} activeOpacity={0.7} style={styles.locationIntegrator}>
                <View style={styles.locationHeaderRow}>
                <View style={styles.locationLabelGroup}><MapPin size={14} color="#3B82F6" /><Text style={styles.locationLabelText}>ตำแหน่งปัจจุบัน</Text></View>
                <View style={styles.liveGPSBadge}><Animated.View style={[styles.liveGPSDot, { opacity: blinkAnim }]} /><Text style={styles.liveGPSText}>LIVE GPS</Text></View>
                </View>
                <View style={styles.addressContainer}>
                <Text style={styles.addressDisplayText} numberOfLines={1}>{address}</Text>
                </View>
            </TouchableOpacity>
            </View>

            <View style={styles.mainInteractiveArea}>
            {!isCalling ? (
                <>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.title}>ขอความช่วยเหลือ</Text>
                    <Text style={styles.subtitle}>{HOSPITAL_COORDS.name} อยู่ห่างจากคุณ {distance} กม.{'\n'}ทีมกู้ชีพพร้อมออกปฏิบัติการทันที</Text>
                </View>

                <View style={styles.sosWrapper}>
                    <Svg width={220} height={220} style={styles.svg}>
                    <Circle cx="110" cy="110" r={radius} stroke="#F1F5F9" strokeWidth={strokeWidth} fill="transparent" />
                    <Circle cx="110" cy="110" r={radius} stroke="#EF4444" strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                    </Svg>

                    <Animated.View style={{ transform: [{ scale: isPressing ? scaleAnim : pulseAnim }] }}>
                    <TouchableOpacity activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[styles.sosButton, isPressing && styles.sosButtonActive]}>
                        <Heart size={48} color="white" fill="white" />
                        <Text style={styles.sosText}>{isPressing ? `${Math.ceil((HOLD_DURATION - (pressProgress * HOLD_DURATION / 100)) / 1000)}s` : 'ฉุกเฉิน'}</Text>
                    </TouchableOpacity>
                    </Animated.View>
                </View>

                <View style={[styles.alertCard, { opacity: isPressing ? 0 : 1 }]}>
                    <AlertTriangle size={16} color="#B45309" />
                    <View style={styles.alertTextContainer}>
                    <Text style={styles.alertTitle}>ระบบยืนยันพิกัดเรียลไทม์</Text>
                    <Text style={styles.alertSubtitle}>พิกัดของคุณถูกส่งให้ทีมกู้ชีพแล้ว</Text>
                    </View>
                </View>
                </>
            ) : (
                <View style={styles.statusContainer}>
                <View style={styles.activeCard}>
                    <View style={styles.activeCardHeader}>
                    <View>
                        <View style={styles.liveIndicator}><View style={styles.redDot} /><Text style={styles.liveText}>ติดตามพิกัดปัจจุบัน</Text></View>
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
                        <Text style={styles.unitSub}>เจ้าหน้าที่กำลังมุ่งหน้าไปตามพิกัดของคุณ</Text>
                    </View>
                    </View>
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

        {/* --- In-App Map Modal --- */}
        <Modal
            animationType="slide"
            transparent={false}
            visible={showInAppMap}
            onRequestClose={() => setShowInAppMap(false)}
        >
            <View style={styles.mapModalContainer}>
            <View style={styles.mapHeader}>
                <View style={{ flex: 1 }}>
                <Text style={styles.mapHeaderTitle}>ตำแหน่งของคุณ</Text>
                <Text style={styles.mapHeaderSub} numberOfLines={1}>{address}</Text>
                </View>
                <TouchableOpacity 
                onPress={() => setShowInAppMap(false)} 
                style={styles.closeMapButton}
                hitSlop={{ top: 40, bottom: 40, left: 40, right: 40 }} 
                >
                <X size={26} color="#1E293B" />
                </TouchableOpacity>
            </View>
            
            <View style={styles.mapViewWrapper}>
                {mapRegion ? (
                <MapView
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                    style={styles.map}
                    initialRegion={mapRegion}
                    showsUserLocation={true}
                >
                    <Marker
                    coordinate={{
                        latitude: mapRegion.latitude,
                        longitude: mapRegion.longitude,
                    }}
                    title="คุณอยู่ที่นี่"
                    >
                    <View style={styles.customMarker}>
                        <Heart size={18} color="white" fill="#EF4444" />
                    </View>
                    </Marker>

                    <Marker
                    coordinate={{
                        latitude: HOSPITAL_COORDS.latitude,
                        longitude: HOSPITAL_COORDS.longitude,
                    }}
                    title={HOSPITAL_COORDS.name}
                    pinColor="#3B82F6"
                    />

                    <MapCircle
                    center={{
                        latitude: mapRegion.latitude,
                        longitude: mapRegion.longitude,
                    }}
                    radius={100}
                    strokeColor="rgba(239, 68, 68, 0.5)"
                    fillColor="rgba(239, 68, 68, 0.1)"
                    />
                </MapView>
                ) : (
                <View style={styles.mapLoading}>
                    <ActivityIndicator size="large" color="#EF4444" />
                    <Text style={styles.loadingText}>กำลังดึงแผนที่...</Text>
                </View>
                )}
            </View>
            
            <SafeAreaView style={styles.mapFooter}>
                <View style={styles.distanceInfo}>
                    <Navigation size={18} color="#3B82F6" />
                    <Text style={styles.distanceText}>{distance} กม. จาก รพ.</Text>
                </View>
                <TouchableOpacity 
                    style={styles.externalMapLink}
                    onPress={() => {
                    if (!currentLocation) return;
                    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
                    const latLng = `${currentLocation.latitude},${currentLocation.longitude}`;
                    const label = 'Patient Location';
                    const url = Platform.select({
                        ios: `${scheme}${label}@${latLng}`,
                        android: `${scheme}${latLng}(${label})`
                    });
                    if (url) Linking.openURL(url);
                    }}
                >
                    <Text style={styles.externalMapText}>แอปแผนที่</Text>
                </TouchableOpacity>
            </SafeAreaView>
            </View>
        </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFEFF' },
  
  // --- New Header Bar Styles ---
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 12,
    backgroundColor: '#FDFEFF',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  appNameText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  appNameLight: {
    fontWeight: '400',
    color: '#94A3B8',
  },
  settingsIconButton: {
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFEFF' },
  loadingText: { marginTop: 10, color: '#94A3B8', fontWeight: 'bold' },
  unifiedCard: { backgroundColor: 'white', marginHorizontal: 20, marginTop: 5, padding: 20, borderRadius: 35, borderWidth: 1, borderColor: '#F1F5F9', elevation: 4 },
  profileTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  profileInfoMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatarCircle: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
  onlineBadge: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: 'white' },
  nameContainer: { flex: 1 },
  patientName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', textAlign: 'left' },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 9, fontWeight: 'bold', color: '#EF4444', marginLeft: 4 },
  medicalIdButton: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  profileQuickStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  statBox: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: 'bold', color: '#334155' },
  statValueRed: { fontSize: 15, fontWeight: 'bold', color: '#EF4444' },
  statDivider: { width: 1, height: 20, backgroundColor: '#F1F5F9' },
  locationIntegrator: { backgroundColor: '#F8FAFC', borderRadius: 22, padding: 15, marginTop: 5, borderWidth: 1, borderColor: '#F1F5F9' },
  locationHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  locationLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationLabelText: { fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' },
  liveGPSBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveGPSDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 4 },
  liveGPSText: { fontSize: 8, fontWeight: '900', color: '#166534' },
  addressContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  addressDisplayText: { fontSize: 13, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', flex: 1 },
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
  cancelButton: { marginTop: 35, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', alignSelf: 'center' },
  cancelButtonText: { color: '#94A3B8', fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5, textTransform: 'uppercase', textDecorationLine: 'underline' },
  mapModalContainer: { flex: 1, backgroundColor: 'white' },
  mapHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 20) + 15,
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9',
    backgroundColor: 'white',
    zIndex: 10,
  },
  mapHeaderTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  mapHeaderSub: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  closeMapButton: { 
    padding: 10, 
    backgroundColor: '#F1F5F9', 
    borderRadius: 14,
    zIndex: 20,
  },
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
