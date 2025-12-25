import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import * as SecureStore from "expo-secure-store";

interface AuthProps {
    authState? : { token: string | null; authenticated: boolean | null};
    onRegister?: (phoneNumber: string, password: string) => Promise<any>;
    onLogin?: (phoneNumber: string, password: string) => Promise<any>;
    onLogout?: () => Promise<any>;
}

const TOKEN_KEY = "my-jwt";
export const API_URL = "https://ksvrhospital.go.th/krit-siwara_smart_heart/api";
const AuthContext = createContext<AuthProps>({});

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }: any) => {
    const [authState, setAuthState] = useState<{ 
        token: string | null; 
        authenticated: boolean | null;
    }>({
        token: null,
        authenticated: null,
    });

    useEffect(() => {
        const loadToken = async () => {

            const token = await SecureStore.getItemAsync(TOKEN_KEY);    
            console.log("stored:", token);
            if (token) {
                axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
                
                setAuthState({
                    token: token,
                    authenticated: true,
                });
            }
        };
        loadToken();
    }, []);

    const register = async (phoneNumber: string, password: string) => {
        try {
            return await axios.post(`${API_URL}/users`, { phoneNumber, password });
        } catch (e) {
            return { error: true, msg: (e as any).response?.data.message || "Registration failed" };
        }

    };

    const login = async (phoneNumber: string, password: string) => {
        try {
            const result = await axios.post(`${API_URL}/login`, { phoneNumber, password });
  
            // 1. ตรวจสอบว่ามี token หรือไม่
            const token = result.data.token;
            if (!token) {
                throw new Error("Token not found in response");
            }

            // 2. อัปเดต State ภายในแอป
            setAuthState({
                token: token,
                authenticated: true,
            });

            // 3. ตั้งค่า Header สำหรับการเรียก API ครั้งต่อๆ ไป
            axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

            // 4. เก็บลง SecureStore (แนะนำให้ใช้ await เพื่อความชัวร์ก่อน return)
            await SecureStore.setItemAsync(TOKEN_KEY, token);

            return result; // ส่งค่ากลับไปเพื่อให้หน้า Login จัดการ Alert ต่อ

        } catch (e: any) {
            // จัดการ Error ให้ละเอียดขึ้น
            return { 
                error: true, 
                msg: e.response?.data?.message || e.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ" 
            };
        }
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
            });
        }
    };
    const value = {
        authState,
        onRegister: register,
        onLogin: login,
        onLogout: logout
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

};