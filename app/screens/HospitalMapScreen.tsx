import { Dimensions } from 'react-native';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
    View, Text, StyleSheet, Platform, Linking, 
    ActivityIndicator, Image, TouchableOpacity, Alert 
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import { Navigation, Phone, MapPin, Star, Trophy } from 'lucide-react-native';
import { useLoading } from '../context/LoadingContext';
import { useTheme } from '../context/ThemeContext';
import { AppText } from '../components/AppText';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || 'ใส่_KEY_ตรงนี้';

const MAIN_HOSPITAL = {
    id: 'fort_krit_main',
    name: "โรงพยาบาลค่ายกฤษณ์สีวะรา",
    address: "ถ.นิตโย ต.แวง อ.เมือง จ.สกลนคร",
    latitude: 17.1872777,
    longitude: 104.1058157,
    phone: "042712860",
    isMain: true,
    rating: 5.0,
    user_ratings_total: 'รพ.หลัก',
    open_now: true,
};

const { height: screenHeight } = Dimensions.get('window');

// 🌟 1. ย้าย HospitalMarker ออกมาไว้ข้างนอก! เพื่อไม่ให้ React ทำลายมันทิ้งเวลาหน้าจอรีเฟรช
const HospitalMarker = ({ hospital, isSelected, fontScale, onPress }: any) => {
    const [trackChanges, setTrackChanges] = useState(true);

    useEffect(() => {
        setTrackChanges(true);
        const timer = setTimeout(() => setTrackChanges(false), 500);
        return () => clearTimeout(timer);
    }, [fontScale, isSelected]);

    const markerBgColor = hospital.isMain ? '#3B82F6' : (isSelected ? '#EF4444' : '#F59E0B');
    const baseSize = 16 * fontScale;

    return (
        <Marker
            coordinate={{ latitude: hospital.latitude, longitude: hospital.longitude }}
            zIndex={hospital.isMain ? 999 : (isSelected ? 998 : 1)}
            tracksViewChanges={trackChanges}
            onPress={onPress}
        >
            <View style={styles.customMarkerContainer}>
                {(hospital.isMain || isSelected) && (
                    <View style={[
                        styles.markerLabel, 
                        { 
                            backgroundColor: markerBgColor,
                            paddingHorizontal: 12 * fontScale, 
                            paddingVertical: 6 * fontScale,
                            borderRadius: 10 * fontScale,
                        }
                    ]}>
                        <AppText 
                            style={[styles.markerLabelText, { fontSize: baseSize }]} 
                            numberOfLines={1}
                        >
                            {hospital.isMain ? "⭐ " : ""}{hospital.name}
                        </AppText>
                    </View>
                )}

                <View style={[styles.customMarker, { backgroundColor: markerBgColor, padding: 6 * fontScale }]}>
                    {hospital.isMain ? <Trophy size={baseSize} color="white" /> : <MapPin size={baseSize} color="white" />}
                </View>
                
                <View style={[styles.markerTriangle, { 
                    borderTopColor: markerBgColor,
                    borderTopWidth: 8 * fontScale,
                    borderLeftWidth: 6 * fontScale,
                    borderRightWidth: 6 * fontScale,
                }]} />
            </View>
        </Marker>
    );
};

// 🌟 2. ตัวหน้าจอหลักอยู่ตรงนี้
const HospitalMapScreen = () => {
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [selectedHospital, setSelectedHospital] = useState<any>(null);
    
    const mapRef = useRef<MapView>(null);
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['25%', '50%', '90%'], []);

    const { fontScale } = useTheme();
    const { setIsLoading } = useLoading();
    
    useEffect(() => {
        fetchNearbyHospitals();
    }, []);

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    const fitToMarkers = useCallback((userLoc: any, hospitalLoc: any) => {
        if (!userLoc || !hospitalLoc || !mapRef.current) return;

        // 1. คำนวณระยะห่างระหว่าง 2 จุด (คนไข้ กับ รพ.)
        const latDelta = Math.abs(userLoc.coords.latitude - hospitalLoc.latitude);
        const lonDelta = Math.abs(userLoc.coords.longitude - hospitalLoc.longitude);

        // 2. หาจุดกึ่งกลาง
        const midLat = (userLoc.coords.latitude + hospitalLoc.latitude) / 2;
        const midLon = (userLoc.coords.longitude + hospitalLoc.longitude) / 2;

        // 🌟 3. ทริคดันกล้อง: ลบค่าละติจูดลงนิดหน่อย เพื่อให้กล้องแพนต่ำลง 
        // ส่งผลให้หมุดทั้ง 2 เด้งขึ้นไปอยู่ด้านบนจอพ้น Bottom Sheet พอดี
        const adjustedLat = midLat - (latDelta * 0.25) - 0.005;

        // 4. สั่งซูมแบบสมูท (animateToRegion)
        mapRef.current.animateToRegion({
            latitude: adjustedLat,
            longitude: midLon,
            // กำหนดระดับการซูม (ป้องกันไม่ให้ซูมใกล้เกินไปถ้าอยู่ใกล้ รพ. มาก)
            latitudeDelta: Math.max(latDelta * 1.6, 0.02),
            longitudeDelta: Math.max(lonDelta * 1.6, 0.02),
        }, 1000);
    }, []);

    const fetchNearbyHospitals = async () => {
        setIsLoading(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            let userLoc = await Location.getCurrentPositionAsync({});
            setLocation(userLoc);

            const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${userLoc.coords.latitude},${userLoc.coords.longitude}&radius=20000&keyword=โรงพยาบาล&key=${GOOGLE_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
                const filtered = (data.results || []).filter((place: any) => {
                    const name = place.name.toLowerCase();
                    const isExcluded = 
                        name.includes('ส่งเสริมสุขภาพตำบล') || 
                        name.includes('รพ.สต.') ||
                        name.includes('คลินิก') ||
                        name.includes('สัตว์') ||
                        name.includes('vet') ||
                        name.includes('school') || 
                        name.includes('โรงเรียน') ||
                        name.includes('อาคาร') ||
                        name.includes('ตึก') ||
                        name.includes('7-eleve') ||
                        name.includes('สาขา') ||
                        name.includes('รพ') ||
                        name.includes('ศูนย์แพทย์') ||
                        name.includes('กฤษณ์สีวะรา'); 

                    return !isExcluded;
                });

                const googleResults = filtered.map((p: any) => ({
                    id: p.place_id, name: p.name, address: p.vicinity,
                    latitude: p.geometry.location.lat, longitude: p.geometry.location.lng,
                    rating: p.rating, photo_reference: p.photos?.[0]?.photo_reference,
                    distance: calculateDistance(userLoc.coords.latitude, userLoc.coords.longitude, p.geometry.location.lat, p.geometry.location.lng)
                })).sort((a: any, b: any) => a.distance - b.distance);

                const mainWithDist = { ...MAIN_HOSPITAL, distance: calculateDistance(userLoc.coords.latitude, userLoc.coords.longitude, MAIN_HOSPITAL.latitude, MAIN_HOSPITAL.longitude) };
                setHospitals([mainWithDist, ...googleResults]);
                setSelectedHospital(mainWithDist);
                setTimeout(() => fitToMarkers(userLoc, mainWithDist), 1000);
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const renderHospitalItem = ({ item }: { item: any }) => {
        const isActive = selectedHospital?.id === item.id;
        const photoUrl = item.photo_reference 
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=200&photo_reference=${item.photo_reference}&key=${GOOGLE_API_KEY}`
            : null;

        return (
            <View style={[styles.cardContainer, isActive && styles.activeCard]}>
                <TouchableOpacity 
                    style={styles.listItem}
                    onPress={() => {
                        setSelectedHospital(item);
                        fitToMarkers(location, item);
                        bottomSheetRef.current?.snapToIndex(0); 
                    }}
                >
                    {item.isMain ? (
                        <View style={styles.mainIconContainer}><Trophy size={28} color="#EF4444" /></View>
                    ) : (
                        <Image source={photoUrl ? { uri: photoUrl } : { uri: 'https://via.placeholder.com/150' }} style={styles.hospitalImage} />
                    )}

                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <AppText style={[styles.listName, isActive && { color: 'white' }]} numberOfLines={1}>{item.name}</AppText>
                        <View style={styles.infoRow}>
                            <Star size={14} color={isActive ? "white" : "#F59E0B"} fill={isActive ? "white" : "#F59E0B"} />
                            <AppText style={[styles.infoText, isActive && { color: 'white' }]}> {item.rating || 'N/A'} • {item.distance.toFixed(1)} กม.</AppText>
                        </View>
                    </View>
                </TouchableOpacity>

                {isActive && (
                    <View style={styles.itemActions}>
                        <TouchableOpacity 
                            style={[styles.btnAction, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                            onPress={() => Linking.openURL(`tel:${item.phone || '1669'}`)}
                        >
                            <Phone color="white" size={18} />
                            <AppText style={styles.btnText}>โทรหา</AppText>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.btnAction, { backgroundColor: 'white' }]}
                            onPress={() => {
                                const url = Platform.select({
                                    ios: `maps://app?daddr=${item.latitude},${item.longitude}`,
                                    android: `google.navigation:q=${item.latitude},${item.longitude}`
                                });
                                Linking.openURL(url!);
                            }}
                        >
                            <Navigation color="#EF4444" size={18} />
                            <AppText style={[styles.btnText, { color: '#EF4444' }]}>นำทาง</AppText>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                showsUserLocation={true}
                mapPadding={{ top: 40, right: 0, bottom: 200, left: 0 }}
            >
                {hospitals.map((h) => (
                    <HospitalMarker
                        // 🌟 3. ใส่ key ให้ชัวร์ 100% ว่าถ้าเลือกปุ๊บ มันจะบังคับเรนเดอร์หมุดใหม่ปั๊บ
                        key={`${h.id}-${h.id === selectedHospital?.id ? 'active' : 'inactive'}`}
                        hospital={h}
                        isSelected={h.id === selectedHospital?.id}
                        fontScale={fontScale}
                        onPress={() => {
                            setSelectedHospital(h);
                            fitToMarkers(location, h);
                            bottomSheetRef.current?.snapToIndex(0);
                        }}
                    />
                ))}
            </MapView>

            <BottomSheet 
                ref={bottomSheetRef} 
                index={1} 
                snapPoints={snapPoints}
            >
                <BottomSheetView style={styles.listHeader}>
                    <AppText style={styles.listTitle}>โรงพยาบาลในพื้นที่</AppText>
                    <TouchableOpacity onPress={fetchNearbyHospitals}>
                        <AppText style={{ color: '#3B82F6', fontWeight: 'bold' }}>รีเฟรช</AppText>
                    </TouchableOpacity>
                </BottomSheetView>

                <BottomSheetFlatList
                    data={hospitals}
                    keyExtractor={(item) => item.id}
                    renderItem={renderHospitalItem}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 40 }}>
                            <AppText style={{ color: '#94A3B8' }}>ไม่พบโรงพยาบาลในรัศมี 20 กม.</AppText>
                        </View>
                    }
                />
            </BottomSheet>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
    listTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    cardContainer: { backgroundColor: '#F8FAFC', borderRadius: 24, marginBottom: 12, overflow: 'hidden', padding: 4 },
    activeCard: { backgroundColor: '#EF4444' },
    listItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    hospitalImage: { width: 50, height: 50, borderRadius: 14 },
    mainIconContainer: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
    listName: { fontWeight: 'bold', color: '#334155', fontSize: 15 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    infoText: { fontSize: 12, color: '#64748B' },
    itemActions: { flexDirection: 'row', padding: 8, gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    btnAction: { flex: 1, flexDirection: 'row', height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 6 },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    customMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    customMarker: {
        padding: 6,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    markerTriangle: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderBottomWidth: 0,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        marginTop: -2,
    },
    markerLabel: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 4, 
        borderWidth: 1,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
        // 🌟 ลบ maxWidth: 120 ออกไปแล้วครับ มันจะขยายตามอักษรได้อิสระเลย
    },
    markerLabelText: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});

export default HospitalMapScreen;