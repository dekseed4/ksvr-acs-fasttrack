import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Alert, Platform, Linking, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Navigation, Phone, MapPin } from 'lucide-react-native';
import axios from 'axios';

// 🔴 1. ใส่ API Key ของคุณตรงนี้
const GOOGLE_API_KEY = "AIzaSyAefNsLzWi69v_TwczP6U2HHwzOYhYydhs"; 

// ฟังก์ชันคำนวณระยะทาง (ใช้เพื่อแสดงผลว่าห่างกี่ กม.)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // รัศมีโลก (km)
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const HospitalMapScreen = () => {
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [hospitals, setHospitals] = useState<any[]>([]); // เก็บข้อมูลจาก API
    const [nearestHospital, setNearestHospital] = useState<any>(null);
    const [selectedHospital, setSelectedHospital] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const mapRef = useRef<MapView>(null);

    // ฟังก์ชันดึงข้อมูลจาก Google Places API
    const fetchNearbyHospitals = async (lat: number, lng: number) => {
        try {
            const radius = 5000; // รัศมีค้นหา 5 กิโลเมตร
            const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=hospital&language=th&key=${GOOGLE_API_KEY}`;
            
            const response = await axios.get(url);
            
            if (response.data.status === 'OK') {
                const places = response.data.results.map((place: any) => ({
                    id: place.place_id,
                    name: place.name,
                    address: place.vicinity, // Google ให้ที่อยู่มาใน field นี้
                    latitude: place.geometry.location.lat,
                    longitude: place.geometry.location.lng,
                    rating: place.rating,
                    // หมายเหตุ: nearbysearch ปกติจะไม่คืนเบอร์โทร ต้องใช้ Place Details API เพิ่มถ้าต้องการ
                }));
                return places;
            } else {
                console.error("Google API Error:", response.data.status);
                return [];
            }
        } catch (error) {
            console.error("Fetch error:", error);
            return [];
        }
    };

    useEffect(() => {
        (async () => {
            // 1. ขอสิทธิ์ Location
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'กรุณาเปิด GPS เพื่อค้นหาโรงพยาบาล');
                setLoading(false);
                return;
            }

            // 2. หาตำแหน่งปัจจุบัน
            let userLocation = await Location.getCurrentPositionAsync({});
            setLocation(userLocation);

            // 3. เรียก API ค้นหาโรงพยาบาล
            const places = await fetchNearbyHospitals(
                userLocation.coords.latitude, 
                userLocation.coords.longitude
            );

            // 4. คำนวณหาระยะทางและหาอันที่ใกล้ที่สุด
            if (places.length > 0) {
                let minDistance = Infinity;
                let nearest = null;

                const placesWithDistance = places.map((h: any) => {
                    const dist = getDistance(
                        userLocation.coords.latitude,
                        userLocation.coords.longitude,
                        h.latitude,
                        h.longitude
                    );
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearest = { ...h, distance: dist };
                    }
                    return { ...h, distance: dist };
                });

                setHospitals(placesWithDistance);
                setNearestHospital(nearest);
                setSelectedHospital(nearest);

                // Zoom แผนที่
                setTimeout(() => {
                    mapRef.current?.fitToCoordinates([
                        { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
                        { latitude: nearest.latitude, longitude: nearest.longitude }
                    ], {
                        edgePadding: { top: 50, right: 50, bottom: 250, left: 50 },
                        animated: true,
                    });
                }, 1000);
            } else {
                Alert.alert("ไม่พบข้อมูล", "ไม่พบโรงพยาบาลในระแวกใกล้เคียง");
            }
            setLoading(false);
        })();
    }, []);

    const handleNavigate = (lat: number, lng: number, label: string) => {
        const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
        const latLng = `${lat},${lng}`;
        const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`
        });
        if (url) Linking.openURL(url);
    };

    return (
        <View style={styles.container}>
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={{ marginTop: 10 }}>กำลังค้นหาโรงพยาบาล...</Text>
                </View>
            )}

            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                showsUserLocation={true}
                showsMyLocationButton={true}
                initialRegion={{
                    latitude: 17.16, // ค่าเริ่มต้น (ถ้ายังโหลดไม่เสร็จ)
                    longitude: 104.14,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                }}
            >
                {hospitals.map((hospital) => (
                    <Marker
                        key={hospital.id}
                        coordinate={{ latitude: hospital.latitude, longitude: hospital.longitude }}
                        title={hospital.name}
                        // ใช้สีแดงถ้าเป็นอันที่เลือกอยู่ หรือเป็นอันที่ใกล้ที่สุด
                        pinColor={hospital.id === selectedHospital?.id ? "red" : "orange"}
                        onPress={() => setSelectedHospital(hospital)}
                    />
                ))}
            </MapView>

            {/* การ์ดข้อมูลด้านล่าง */}
            {selectedHospital && (
                <View style={styles.cardContainer}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.hospitalName} numberOfLines={1}>{selectedHospital.name}</Text>
                            <Text style={styles.hospitalAddress} numberOfLines={2}>{selectedHospital.address}</Text>
                            <Text style={styles.distanceText}>
                                ห่างจากคุณ {selectedHospital.distance?.toFixed(2)} กม.
                                {selectedHospital.id === nearestHospital?.id && " (ใกล้ที่สุด)"}
                            </Text>
                        </View>
                        <View style={styles.iconContainer}>
                             <MapPin color="#D32F2F" size={24} />
                        </View>
                    </View>

                    <View style={styles.buttonGroup}>
                        <TouchableOpacity 
                            style={[styles.button, styles.navButton]}
                            onPress={() => handleNavigate(selectedHospital.latitude, selectedHospital.longitude, selectedHospital.name)}
                        >
                            <Navigation color="white" size={20} />
                            <Text style={styles.buttonText}>นำทาง</Text>
                        </TouchableOpacity>

                        {/* ปุ่มโทร (Google Nearby Search ไม่ให้เบอร์มา อาจต้องซ่อนหรือใช้เบอร์กลาง 1669 แทน) */}
                        <TouchableOpacity 
                            style={[styles.button, styles.callButton]}
                            // เนื่องจาก API ค้นหาเบื้องต้นไม่ให้เบอร์ จึงแนะนำให้โทร 1669 หรือเบอร์กลางแทน
                            onPress={() => Linking.openURL(`tel:1669`)} 
                        >
                            <Phone color="#007AFF" size={20} />
                            <Text style={[styles.buttonText, { color: '#007AFF' }]}>ฉุกเฉิน (1669)</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    cardContainer: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 20,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    iconContainer: {
        backgroundColor: '#FFEBEE',
        padding: 10,
        borderRadius: 50,
        marginLeft: 10,
    },
    hospitalName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    hospitalAddress: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    distanceText: {
        fontSize: 14,
        color: '#2E7D32',
        fontWeight: '600',
        marginTop: 5,
    },
    buttonGroup: {
        flexDirection: 'row',
        gap: 10,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    navButton: {
        backgroundColor: '#007AFF',
    },
    callButton: {
        backgroundColor: '#F0F8FF',
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    }
});

export default HospitalMapScreen;