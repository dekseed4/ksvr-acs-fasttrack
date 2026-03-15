import React, { createContext, useState, useContext, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { Heart } from 'lucide-react-native';
import { AppText } from '../components/AppText'; // ตรวจสอบพาธให้ถูกต้อง

const LoadingContext = createContext({
    setIsLoading: (value) => {},
});

export const LoadingProvider = ({ children }) => {
    const [loading, setLoading] = useState(false);

    const setIsLoading = useCallback((value) => {
        setLoading(value);
    }, []);

    return (
        <LoadingContext.Provider value={{ setIsLoading }}>
            {children}
            
            {/* 🌟 หน้าจอ Loading ตามดีไซน์ของคุณ */}
            <Modal transparent={false} visible={loading} animationType="fade">
                <View style={styles.loadingContainer}>
                    <View style={styles.loadingIconContainer}>
                        <Heart size={80} color="#EF4444" fill="#FEF2F2" strokeWidth={1.5} />
                    </View>
                    <ActivityIndicator size="large" color="#EF4444" style={{ marginBottom: 20 }} />
                    <AppText style={styles.loadingTitle}>KSVR ACS</AppText>
                    <AppText style={styles.loadingText}>กำลังเตรียมระบบ...</AppText>
                </View>
            </Modal>
        </LoadingContext.Provider>
    );
};

export const useLoading = () => useContext(LoadingContext);

const styles = StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
    loadingIconContainer: { marginBottom: 30, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    loadingTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', letterSpacing: 1 },
    loadingText: { marginTop: 8, color: '#94A3B8', fontSize: 14, fontWeight: '500' }
});