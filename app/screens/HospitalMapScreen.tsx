import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Alert, Platform, Linking, ActivityIndicator, Image } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps'; // ใช้ตัวมาตรฐาน
import * as Location from 'expo-location';
import { Navigation, Phone, MapPin } from 'lucide-react-native';

// ข้อมูลจำลอง (Mock Data) - หรือจะดึงจาก API ก็ได้
const HOSPITALS = [
    { id: 1, name: "รพ.ค่ายกฤษณ์สีวะรา", address: "อ.เมือง จ.สกลนคร", latitude: 17.1352, longitude: 104.1465, phone: "042-123456" },
    { id: 2, name: "รพ.ศูนย์สกลนคร", address: "ใจกลางเมืองสกลนคร", latitude: 17.1662, longitude: 104.1480, phone: "042-711711" },
    { id: 3, name: "รพ.รักษ์สกล", address: "ถ.รัฐพัฒนา", latitude: 17.1580, longitude: 104.1350, phone: "042-712888" },
];

// ฟังก์ชันคำนวณระยะทาง (km)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const HospitalMapScreen = () => {
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [nearestHospital, setNearestHospital] = useState<any>(null);
    const [selectedHospital, setSelectedHospital] = useState<any>(null);
    const mapRef = useRef<MapView>(null); // Ref สำหรับควบคุมแผนที่

    useEffect(() => {
        (async () => {
            // 1. ขอ Permission
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'กรุณาเปิด GPS เพื่อใช้งาน');
                return;
            }

            // 2. หาตำแหน่งเรา
            let userLocation = await Location.getCurrentPositionAsync({});
            setLocation(userLocation);

            // 3. คำนวณหารพ.ที่ใกล้ที่สุด
            let minDistance = Infinity;
            let nearest = null;

            const updatedHospitals = HOSPITALS.map(hospital => {
                const dist = getDistance(
                    userLocation.coords.latitude,
                    userLocation.coords.longitude,
                    hospital.latitude,
                    hospital.longitude
                );
                if (dist < minDistance) {
                    minDistance = dist;
                    nearest = { ...hospital, distance: dist };
                }
                return { ...hospital, distance: dist };
            });

            setNearestHospital(nearest);
            setSelectedHospital(nearest);

            // 4. สั่งให้แผนที่ Zoom ไปหาจุดที่เราอยู่และรพ. (Animation)
            if (nearest && mapRef.current) {
                setTimeout(() => {
                    mapRef.current?.fitToCoordinates([
                        { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
                        { latitude: nearest.latitude, longitude: nearest.longitude }
                    ], {
                        edgePadding: { top: 50, right: 50, bottom: 250, left: 50 }, // เว้นระยะขอบ (bottom เยอะหน่อยเพราะมีการ์ดบัง)
                        animated: true,
                    });
                }, 1000); // รอ map โหลดแป๊บนึง
            }
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
            <MapView
                ref={mapRef}
                style={styles.map}
                // ถ้าเป็น Android ให้ใช้ Google Maps, ถ้า iOS ให้ใช้ Apple Maps (ไม่ใส่ provider)
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                showsUserLocation={true}
                showsMyLocationButton={true}
                initialRegion={{
                    latitude: 17.16,
                    longitude: 104.14,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                }}
            >
                {HOSPITALS.map((hospital) => (
                    <Marker
                        key={hospital.id}
                        coordinate={{ latitude: hospital.latitude, longitude: hospital.longitude }}
                        title={hospital.name}
                        description={hospital.address}
                        // สีแดง = ใกล้สุด หรือ ถูกเลือกอยู่
                        pinColor={hospital.id === selectedHospital?.id ? "red" : "orange"}
                        onPress={() => setSelectedHospital({
                            ...hospital,
                            // คำนวณระยะทางใหม่เผื่อ user ขยับ หรือใช้ค่าเดิม
                            distance: location ? getDistance(location.coords.latitude, location.coords.longitude, hospital.latitude, hospital.longitude) : 0
                        })}
                    />
                ))}
            </MapView>

            {/* การ์ดข้อมูลด้านล่าง */}
            {selectedHospital && (
                <View style={styles.cardContainer}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.hospitalName}>{selectedHospital.name}</Text>
                            <Text style={styles.hospitalAddress}>{selectedHospital.address}</Text>
                            <Text style={styles.distanceText}>
                                {selectedHospital.id === nearestHospital?.id ? "📍 ใกล้ที่สุด " : ""}
                                ห่าง {selectedHospital.distance?.toFixed(2)} กม.
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

                        <TouchableOpacity 
                            style={[styles.button, styles.callButton]}
                            onPress={() => Linking.openURL(`tel:${selectedHospital.phone}`)}
                        >
                            <Phone color="#007AFF" size={20} />
                            <Text style={[styles.buttonText, { color: '#007AFF' }]}>โทร</Text>
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
    cardContainer: {
        position: 'absolute',
        bottom: 25, // ยกขึ้นมาจากขอบล่าง
        left: 20,
        right: 20,
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        // Shadow ให้ดูมีมิติ
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    iconContainer: {
        backgroundColor: '#FFEBEE',
        padding: 12,
        borderRadius: 50,
    },
    hospitalName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    hospitalAddress: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    distanceText: {
        fontSize: 14,
        color: '#2E7D32',
        fontWeight: '600',
        marginTop: 6,
    },
    buttonGroup: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 8,
    },
    navButton: {
        backgroundColor: '#007AFF',
    },
    callButton: {
        backgroundColor: '#F5F5F5',
    },
    buttonText: {
        fontWeight: 'bold',
        fontSize: 16,
        color: 'white',
    }
});

export default HospitalMapScreen;