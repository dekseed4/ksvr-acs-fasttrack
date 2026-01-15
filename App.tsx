import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './app/context/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Map, BookOpen, Heart } from 'lucide-react-native';

import LoginScreen from './app/screens/LoginScreen';
import HomeScreen from './app/screens/HomeScreen';
import ProfileScreen from './app/screens/ProfileScreen';
import HospitalMapScreen from './app/screens/HospitalMapScreen';
import KnowledgeScreen from './app/screens/KnowledgeScreen';
import TermsConsentScreen from './app/screens/TermsConsentScreen';
import NotificationScreen from './app/screens/NotificationScreen';
import { ThemeProvider } from './app/context/ThemeContext';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { AppText } from './app/components/AppText';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AppTabs() {

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color, size }) => {
                    const iconProps = {
                    color: color,
                    size: size,
                    strokeWidth: focused ? 2.5 : 2, // เพิ่มความหนาเส้นเมื่อถูกเลือก (Optional)
                };

                    if (route.name === 'HomeTab') {
                        return <Home {...iconProps} />;
                    } else if (route.name === 'Knowledge') {
                        return <BookOpen {...iconProps} />;
                    } else if (route.name === 'HospitalMap') {
                        return <Map {...iconProps} />;
                    }
                },
                // tabBarActiveTintColor: 'tomato',
                // tabBarInactiveTintColor: 'gray',
                // ซ่อน Title ตรง Header แต่เก็บปุ่ม Logout ไว้
                headerTitle: '',
                tabBarActiveTintColor: '#EF4444', // สีแดงเมื่อเลือก
    tabBarInactiveTintColor: '#94A3B8', // สีเทาเมื่อไม่ได้เลือก
    tabBarStyle: {
      backgroundColor: '#FFFFFF', // พื้นหลังขาว
      borderTopWidth: 0, // ลบเส้นขอบด้านบนออก (ช่วยให้รอยต่อที่คุณวงหายไป)
      elevation: 10, // เงาสำหรับ Android
      shadowColor: '#000', // เงาสำหรับ iOS
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      height: Platform.OS === 'ios' ? 88 : 65, // ปรับความสูงให้เหมาะกับแต่ละระบบ
      paddingBottom: Platform.OS === 'ios' ? 30 : 10, // จัดระยะตัวอักษรไม่ให้จม
      paddingTop: 10,
    },
    tabBarLabelStyle: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 5,
    }
            })} 
        >
            <Tab.Screen 
                name="HomeTab" 
                component={HomeScreen} 
                options={{title: 'หน้าแรก' }}
            />
            <Tab.Screen 
                name="HospitalMap" 
                component={HospitalMapScreen} 
                options={{ title: 'รพ. ใกล้ฉัน' }} 
            />
            <Tab.Screen 
                name="Knowledge" 
                component={KnowledgeScreen} 
                options={{ title: 'แหล่งความรู้' }} 
            />
        </Tab.Navigator>
    );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
            <AuthProvider> 
                <ThemeProvider>
                    <Layout />
                </ThemeProvider>
            </AuthProvider>
        </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

export const Layout = () => {
    const { authState, isLoading } = useAuth();
    
    // เช็คเงื่อนไข (ต้องมั่นใจว่า authState.user ไม่ใช่ null ก่อนเช็ค term_accepted_at)
    const showConsentScreen = authState?.user && !authState.user.term_accepted_at;

    if (isLoading) {
        return (
           <View style={styles.loadingContainer}>
                <View style={styles.loadingIconContainer}>
                    <Heart size={80} color="#EF4444" fill="#FEF2F2" strokeWidth={1.5} />
                </View>
                <ActivityIndicator size="large" color="#EF4444" style={{ marginBottom: 20 }} />
                <AppText style={styles.loadingTitle}>KSVR ACS</AppText>
                <AppText style={styles.loadingText}>กำลังเตรียมระบบ...</AppText>
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {authState?.authenticated ? (
                    showConsentScreen ? (
                        <Stack.Screen name="TermsConsentScreen" component={TermsConsentScreen} />
                        
                    ) : (
                        <Stack.Group>
                            <Stack.Screen name="AppTabs" component={AppTabs} />
                            <Stack.Screen 
                                name="Profile" 
                                component={ProfileScreen} 
                                options={{ headerShown: false }} 
                            />
                            <Stack.Screen 
                                name="Notifications" 
                                component={NotificationScreen} 
                                options={{ headerShown: false }} // ซ่อน Header ของ Stack เพราะเราสร้างเองในไฟล์แล้ว
                            />
                        </Stack.Group>
                    )
                ) : (
                    <Stack.Screen name="Login" component={LoginScreen} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
    loadingIconContainer: { marginBottom: 30, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    loadingTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', letterSpacing: 1 },
    loadingText: { marginTop: 8, color: '#94A3B8', fontSize: 14, fontWeight: '500' }

});