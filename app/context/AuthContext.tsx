import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { usePushNotifications } from "../hooks/usePushNotifications";

const TOKEN_KEY = "my-jwt";

// 🌟 Global flag ป้องกัน Alert เด้งซ้ำซ้อน
let isSessionAlertShown = false;

// 🌟 TypeScript Interfaces ที่รัดกุมขึ้น
export interface UserProfile {
    name: string;
    hn: string;
    detail_genaral?: any;
    detail_medical?: any;
    family_patient?: any;
    addr?: any;
}

interface AuthState {
    token: string | null;
    authenticated: boolean | null;
    user: UserProfile | null;
}

interface AuthContextType {
    authState: AuthState;
    isLoading: boolean;
    onLogin: (phoneNumber: string, password: string) => Promise<any>;
    onLogout: () => Promise<void>;
    setUserData: (data: UserProfile) => void;
    updateUser: (newUserData: Partial<UserProfile>) => void; // ใช้ Partial เพื่อให้ส่งมาแค่อัปเดตบางฟิลด์ได้
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 🌟 Custom Hook แบบ Modern (เช็คว่ามีการเรียกใช้นอก Provider ไหม)
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [isLoading, setIsLoading] = useState(true);
    const { expoPushToken } = usePushNotifications();

    const [authState, setAuthState] = useState<AuthState>({
        token: null,
        authenticated: null,
        user: null,
    });

    // 🌟 1. ใช้ useCallback ครอบฟังก์ชัน เพื่อจำตำแหน่งหน่วยความจำเดิม ป้องกันการ Re-render
    const logout = useCallback(async () => {
        try {
            if (axios.defaults.headers.common["Authorization"]) {
                await axios.post(`${API_URL}/logout`).catch(() => {}); // ปล่อยผ่านเงียบๆ ถ้าเน็ตหลุด
            }
        } finally {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            delete axios.defaults.headers.common["Authorization"];
            await AsyncStorage.removeItem('use_biometric');
            
            setAuthState({
                token: null,
                authenticated: false,
                user: null,
            });
        }
    }, []);

    // 🌟 2. Interceptor ที่ปลอดภัยและพ่วง Dependency ถูกต้อง
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // ถ้าเจอ 401 และไม่ใช่หน้า Login
                if (error.response?.status === 401 && !originalRequest.url?.includes('/login')) {
                    if (!isSessionAlertShown) {
                        isSessionAlertShown = true;
                        
                        // 🌟 ล้างค่าในเครื่องทันทีโดย "ไม่ต้อง" ยิง API ไปที่เซิร์ฟเวอร์ (เพราะรู้ว่า Token ตายแล้ว)
                        await SecureStore.deleteItemAsync(TOKEN_KEY);
                        delete axios.defaults.headers.common["Authorization"];
                        
                        setAuthState({
                            token: null,
                            authenticated: false,
                            user: null,
                        });

                        Alert.alert(
                            "เซสชันหมดอายุ",
                            "มีการเข้าสู่ระบบจากอุปกรณ์อื่น กรุณาเข้าสู่ระบบใหม่",
                            [{ text: "ตกลง", onPress: () => { isSessionAlertShown = false; } }]
                        );
                    }
                    // สั่งตัดจบตรงนี้ ไม่ต้องส่ง Error ต่อไปหา Component อื่นๆ
                    return new Promise(() => {}); 
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, [logout]); // ผูกกับ logout อย่างปลอดภัย

    // 🌟 3. จัดการ Push Token เป็น Async/Await คลีนๆ
    useEffect(() => {
        const updatePushToken = async () => {
            if (expoPushToken && authState.authenticated && authState.token) {
                try {
                    const tokenString = typeof expoPushToken === 'object' ? expoPushToken.data : expoPushToken;
                    await axios.post(`${API_URL}/update-device-tokens`, {
                        token: tokenString,
                        platform: Platform.OS
                    });
                    console.log("✅ Push Token Updated");
                } catch (err: any) {
                    console.log("❌ Token Update Error:", err.response?.status);
                }
            }
        };
        
        updatePushToken();
    }, [expoPushToken, authState.authenticated, authState.token]);

    // 🌟 4. โหลด Token ตอนเริ่มแอป
    useEffect(() => {
        // 🌟 แก้ไขจุดที่ 4 ใน AuthContext.tsx
        const loadToken = async () => {
            try {
                const token = await SecureStore.getItemAsync(TOKEN_KEY);
                if (token) {
                    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
                    try {
                        const userResponse = await axios.get(`${API_URL}/profile`);
                        setAuthState({
                            token: token,
                            authenticated: true,
                            user: userResponse.data.data || userResponse.data,
                        });
                    } catch (error: any) {
                        // 🌟 ถ้าเป็น 401 ไม่ต้องพ่น Error ออกมา (เพราะเรารู้ว่ามันคือ Session หมดอายุ)
                        if (error.response?.status === 401) {
                            console.log("ℹ️ Session expired or logged in from another device.");
                        } else {
                            console.error("❌ Profile load failed:", error.message);
                        }
                        await logout(); // เตะออกเงียบๆ ไปหน้า Login
                    }
                } else {
                    setAuthState({ token: null, authenticated: false, user: null });
                }
            } catch (e) {
                setAuthState({ token: null, authenticated: false, user: null });
            } finally {
                setIsLoading(false);
            }
        };

        loadToken();
    }, [logout]);

    // 🌟 ฟังก์ชันอื่นๆ หุ้ม useCallback ไว้หมด
    const updateUser = useCallback((newUserData: Partial<UserProfile>) => {
        setAuthState((prevState) => ({
            ...prevState,
            user: prevState.user ? { ...prevState.user, ...newUserData } : null,
        }));
    }, []);

    const setUserData = useCallback((data: UserProfile) => {
        setAuthState((prevState) => ({
            ...prevState,
            user: data,
        }));
    }, []);

    const login = useCallback(async (phoneNumber: string, password: string) => {
        try {
            const result = await axios.post(`${API_URL}/login`, { phoneNumber, password });
            const { token, user } = result.data;

            if (!token) throw new Error("Token not found");

            isSessionAlertShown = false; // ปลดล็อค Alert กันเหนียว

            setAuthState({
                token: token,
                authenticated: true,
                user: user || null,
            });

            axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
            await SecureStore.setItemAsync(TOKEN_KEY, token);

            return result.data;
        } catch (e: any) {
            return {
                error: true,
                message: e.response?.data?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ"
            };
        }
    }, []);

    // 🌟 5. ใช้ useMemo ให้แพคเกจ Context Value ส่งลงไปหาลูกๆ แบบลื่นไหล
    const value = useMemo(() => ({
        authState,
        isLoading,
        onLogin: login,
        onLogout: logout,
        setUserData,
        updateUser
    }), [authState, isLoading, login, logout, setUserData, updateUser]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};