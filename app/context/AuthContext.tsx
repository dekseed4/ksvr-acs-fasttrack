import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Alert, Platform } from 'react-native';

export interface UserProfile {
    name: string;
    hn: string;
    detail_genaral: any; // หรือจะระบุละเอียดก็ได้
    detail_medical: any;
    family_patient: any;
    addr: any;
}

interface AuthProps {
    authState? : { token: string | null; authenticated: boolean | null; user: UserProfile | null;};
    onLogin?: (phoneNumber: string, password: string) => Promise<any>;
    onLogout?: () => Promise<any>;
    setUserData?: (data: UserProfile) => void;
    isLoading?: boolean;
}

const TOKEN_KEY = "my-jwt";
import { API_URL } from '../config';
import { usePushNotifications } from "../hooks/usePushNotifications";
const AuthContext = createContext<AuthProps>({} as AuthProps);

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }: any) => {

    const [isLoading, setIsLoading] = useState(true);
    const { expoPushToken, notification } = usePushNotifications();

    const [authState, setAuthState] = useState<{ 
        token: string | null; 
        authenticated: boolean | null;
        user: UserProfile | null;
    }>({
        token: null,
        authenticated: null,
        user: null,
    });

    // เพิ่ม useEffect ตัวใหม่ สำหรับดักจับ Error 401
    useEffect(() => {
        // สร้าง Interceptor
        const interceptor = axios.interceptors.response.use(
            response => response, // ถ้าสำเร็จ ปล่อยผ่าน
            async (error) => {
                // ถ้าเจอ Error 401 (Token หมดอายุ หรือ โดนดีดออก)
                if (error.response?.status === 401) {
                    
                    // ป้องกันการ Loop logout ซ้ำๆ โดยเช็คว่าตอนนี้ Login อยู่ไหม
                    const currentToken = await SecureStore.getItemAsync(TOKEN_KEY);
                    if (currentToken) {
                        console.log("Session expired or logged in on another device.");
                        
                        // แจ้งเตือนผู้ใช้
                        Alert.alert(
                            "หมดเวลาการใช้งาน", 
                            "มีการเข้าสู่ระบบจากอุปกรณ์อื่น หรือเซสชั่นหมดอายุ กรุณาเข้าสู่ระบบใหม่",
                            [{ text: "ตกลง" }]
                        );

                        // สั่ง Logout (ล้างค่าในเครื่อง)
                        await SecureStore.deleteItemAsync(TOKEN_KEY);
                        delete axios.defaults.headers.common["Authorization"];
                        setAuthState({
                            token: null,
                            authenticated: false,
                            user: null,
                        });
                    }
                }
                return Promise.reject(error);
            }
        );

        // Cleanup function: ถอด interceptor เมื่อ component ถูกทำลาย
        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []); // ทำงานครั้งเดียวตอนเริ่มแอป
    
useEffect(() => {
    if (expoPushToken && authState?.authenticated && authState?.token) {
        console.log("Sending token:", expoPushToken); // 1. เช็คดูว่า Token หน้าตาเป็นยังไง

        axios.post(`${API_URL}/update-device-tokens`, { // <-- เช็ค URL ด้วยว่าใน Laravel มี s หรือไม่มี s
            token: typeof expoPushToken === 'object' ? expoPushToken.data : expoPushToken, // กันเหนียว
            platform: Platform.OS
        })
        .then((response) => {
             console.log("✅ Success:", response.data);
        })
        .catch(err => { 
            // --- แก้ตรงนี้ครับ เพื่อดูไส้ในของ Error 500 ---
            console.log("❌ Error Status:", err.response?.status);
            console.log("❌ Error Detail:", JSON.stringify(err.response?.data, null, 2)); 
            // มันจะพ่น Error จาก Laravel ออกมาตรงนี้เลย
        });
    }
}, [expoPushToken, authState?.authenticated]);
  
    useEffect(() => {
        const loadToken = async () => {
            try { // <--- ใส่ try-catch ครอบทั้งหมด
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
                    } catch (error) {
                        console.log("Token expired or invalid");
                        await SecureStore.deleteItemAsync(TOKEN_KEY);
                        delete axios.defaults.headers.common["Authorization"];
                        setAuthState({ token: null, authenticated: false, user: null });
                    }
                } else {
                    // ถ้าไม่มี Token ก็เซ็ตให้ชัดเจน
                    setAuthState({ token: null, authenticated: false, user: null });
                }
            } catch (e) {
                console.error("SecureStore Error:", e);
                setAuthState({ token: null, authenticated: false, user: null });
            } finally {
                // <--- 4. สำคัญที่สุด: โหลดเสร็จแล้ว (ไม่ว่าจะสำเร็จหรือล้มเหลว) ให้ปิด Loading
                setIsLoading(false); 
            }
        };
        
        loadToken();
    }, []);

    const login = async (phoneNumber, password) => {
        try {
            const result = await axios.post(`${API_URL}/login`, { phoneNumber, password });

            // ดึงข้อมูลที่จำเป็นออกมาจาก response.data
            const { token, user, require_consent } = result.data;

            // 1. ตรวจสอบ Token
            if (!token) {
                throw new Error("Token not found in response");
            }

            // 2. อัปเดต State (ใส่ข้อมูล user ลงไปด้วย)
            setAuthState({
                token: token,
                authenticated: true, 
                user: user || null, 
            });

            // 3. ตั้งค่า Header
            axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

            // 4. เก็บลง SecureStore
            await SecureStore.setItemAsync(TOKEN_KEY, token);

            // 5. [สำคัญ] ส่ง Data กลับไปให้ LoginScreen เช็ค require_consent
            return result.data; 

        } catch (e) {
            // จัดการ Error
            return { 
                error: true, 
                message: e.response?.data?.message || e.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ" 
            };
        }
    };
    
    const setUserData = (data: UserProfile) => {
        setAuthState((prev) => ({
            ...prev,
            user: data
        }));
    };

    const logout = async () => {
        try {
            // 1. บอก Laravel ให้ลบ Token นี้ทิ้ง (Security Best Practice)
            await axios.post(`${API_URL}/logout`);
        } catch (e) {
            console.log('Logout API error:', e);
        } finally {
            // 2. เคลียร์ข้อมูลในเครื่องแน่นอน แม้ API จะ Error
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            delete axios.defaults.headers.common["Authorization"];
            setAuthState({
                token: null,
                authenticated: false,
                user: null,
            });
        }
    };
    const value = {
        authState,
        setAuthState,
        onLogin: login,
        onLogout: logout,
        setUserData: setUserData,
        isLoading
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

};