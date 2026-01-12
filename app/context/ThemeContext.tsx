import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. กำหนดค่าคงที่ (Constants)
export const FONT_SCALES = {
    SMALL: 0.85,
    NORMAL: 1.0, 
    LARGE: 1.2,
    EXTRA_LARGE: 1.4
};

interface ThemeContextProps {
    fontScale: number;
    changeFontScale: (scale: number) => void;
}

const ThemeContext = createContext<ThemeContextProps>({
    fontScale: FONT_SCALES.NORMAL,
    changeFontScale: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: any) => {

    const [fontScale, setFontScale] = useState<number>(FONT_SCALES.NORMAL);

    useEffect(() => {
        const loadScale = async () => {
            try {
                const savedScale = await AsyncStorage.getItem('user_font_scale');
                
                if (savedScale !== null) {
                    // 4. ถ้ามีค่าที่บันทึกไว้ ให้ใช้ค่านั้น
                    setFontScale(parseFloat(savedScale));
                } else {
                    // 5. กรณีเปิดแอปครั้งแรก (ยังไม่มีค่าในเครื่อง)
                    // ระบบจะใช้ค่าจาก useState (คือ NORMAL) โดยอัตโนมัติอยู่แล้ว
                    // หรือจะสั่งบันทึกค่า Normal ลงเครื่องไปเลยก็ได้เพื่อความชัวร์ในครั้งหน้า
                    // await AsyncStorage.setItem('user_font_scale', FONT_SCALES.NORMAL.toString());
                }
            } catch (error) {
                console.log("Error loading font scale:", error);
                // ถ้า Error ให้กลับไปใช้ค่าปกติ
                setFontScale(FONT_SCALES.NORMAL);
            }
        };

        loadScale();
    }, []);

    const changeFontScale = async (scale: number) => {
        setFontScale(scale);
        await AsyncStorage.setItem('user_font_scale', scale.toString());
    };

    return (
        <ThemeContext.Provider value={{ fontScale, changeFontScale }}>
            {children}
        </ThemeContext.Provider>
    );
};