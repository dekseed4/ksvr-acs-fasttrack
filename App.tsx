import React from 'react';
import { AuthProvider, useAuth } from './app/context/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Map, BookOpen, Heart } from 'lucide-react-native';

import LoginScreen from './app/screens/LoginScreen';
import HomeScreen from './app/screens/HomeScreen';
import HospitalMapScreen from './app/screens/HospitalMapScreen';
import KnowledgeScreen from './app/screens/KnowledgeScreen';
import TermsConsentScreen from './app/screens/TermsConsentScreen';
import { ThemeProvider } from './app/context/ThemeContext';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { AppText } from './app/components/AppText';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
                tabBarActiveTintColor: 'tomato',
                tabBarInactiveTintColor: 'gray',
                // ซ่อน Title ตรง Header แต่เก็บปุ่ม Logout ไว้
                headerTitle: '',
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
        <AuthProvider>
            <ThemeProvider>
                <Layout></Layout>
            </ThemeProvider>
        </AuthProvider>
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
                    // 🟢 กรณี: เข้าสู่ระบบแล้ว (Authenticated)
                    showConsentScreen ? (
                        // ⚠️ ถ้ายังไม่ยอมรับเงื่อนไข -> บังคับไปหน้า Consent
                        <Stack.Screen name="TermsConsentScreen" component={TermsConsentScreen} />
                    ) : (
                        // ✅ ถ้ายอมรับแล้ว -> เข้าใช้งาน AppTabs ได้ตามปกติ
                        <Stack.Screen name="AppTabs" component={AppTabs} />
                    )
                ) : (
                    // 🔴 กรณี: ยังไม่เข้าสู่ระบบ
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