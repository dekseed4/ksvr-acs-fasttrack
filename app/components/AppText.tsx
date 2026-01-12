import React from 'react';
import { Text, TextProps, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface AppTextProps extends TextProps {
    children: React.ReactNode;
}

export const AppText = (props: AppTextProps) => {
    const { fontScale } = useTheme();
    
    // ดึง style ที่ส่งมาเพื่อหา fontSize เดิม (ถ้ามี)
    const incomingStyle = StyleSheet.flatten(props.style || {}) as TextStyle;
    const baseFontSize = incomingStyle.fontSize || 16; // ถ้าไม่ได้กำหนด ให้เริ่มที่ 16

    // คำนวณขนาดใหม่ = ขนาดเดิม * ตัวคูณ
    const scaledFontSize = baseFontSize * fontScale;

    return (
        <Text 
            {...props} 
            style={[
                props.style, 
                { fontSize: scaledFontSize } // ทับค่า fontSize เดิม
            ]}
        >
            {props.children}
        </Text>
    );
};