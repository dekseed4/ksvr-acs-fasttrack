import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './app/context/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Map, BookOpen, Heart } from 'lucide-react-native';

// 🌟 1. Import SafeAreaProvider และ useSafeAreaInsets
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import LoginScreen from './app/screens/LoginScreen';
import HomeScreen from './app/screens/HomeScreen';
import ProfileScreen from './app/screens/ProfileScreen';
import HospitalMapScreen from './app/screens/HospitalMapScreen';
import KnowledgeScreen from './app/screens/KnowledgeScreen';
import TermsConsentScreen from './app/screens/TermsConsentScreen';
import NotificationScreen from './app/screens/NotificationScreen';
import { LoadingProvider, useLoading } from './app/context/LoadingContext';
import { ThemeProvider } from './app/context/ThemeContext';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { AppText } from './app/components/AppText';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AppTabs() {
    // 🌟 2. เรียกใช้งาน insets เพื่อดึงค่าระยะขอบจอด้านล่างของมือถือแต่ละเครื่อง
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color, size }) => {
                    const iconProps = {
                        color: color,
                        size: size,
                        strokeWidth: focused ? 2.5 : 2, 
                    };

                    if (route.name === 'HomeTab') {
                        return <Home {...iconProps} />;
                    } else if (route.name === 'Knowledge') {
                        return <BookOpen {...iconProps} />;
                    } else if (route.name === 'HospitalMap') {
                        return <Map {...iconProps} />;
                    }
                    return null;
                },
                headerTitle: '',
                tabBarActiveTintColor: '#EF4444', 
                tabBarInactiveTintColor: '#94A3B8', 
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 0,
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.05,
                    shadowRadius: 10,
                    
                    // 🌟 3. ปรับความสูงและ padding ให้ยืดหยุ่นตาม insets.bottom 
                    // 65 คือความสูงมาตรฐาน แล้วบวกด้วยระยะขอบล่างของหน้าจอ
                    height: 65 + (insets.bottom > 0 ? insets.bottom : Platform.OS === 'ios' ? 20 : 10), 
                    
                    // ดันไอคอนและตัวหนังสือขึ้นมาให้พ้นแถบ Navigation Bar
                    paddingBottom: insets.bottom > 0 ? insets.bottom : Platform.OS === 'ios' ? 20 : 10, 
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
    // 🌟 1. GestureHandlerRootView ต้องอยู่ "นอกสุด" และต้องมี flex: 1 เสมอ
    <GestureHandlerRootView style={{ flex: 1 }}>
      
      {/* 🌟 2. SafeAreaProvider ต้องมี flex: 1 เพื่อไม่ให้มันยุบตัวบน iPad */}
      <SafeAreaProvider style={{ flex: 1 }}>
        
        <LoadingProvider>
          <ThemeProvider>
            <AuthProvider>
              {/* 🌟 3. ย้าย BottomSheetModalProvider มาไว้ในนี้ (หรือถ้ายังกดไม่ได้ ลองคอมเมนต์บรรทัดนี้ออกชั่วคราว) */}
              <BottomSheetModalProvider>
                <Layout />
              </BottomSheetModalProvider>
            </AuthProvider>
          </ThemeProvider>
        </LoadingProvider>

      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export const Layout = () => {
    const { authState, isLoading } = useAuth();
    
    const showConsentScreen = authState?.user && !authState.user.term_accepted_at;


    if (isLoading) {
        return (
           <View style={styles.loadingContainer}>
                <View style={styles.loadingIconContainer}>
                    <Heart size={80} color="#EF4444" fill="#FEF2F2" strokeWidth={1.5} />
                </View>
                <ActivityIndicator size="large" color="#EF4444" style={{ marginBottom: 20 }} />
                <AppText style={styles.loadingTitle}>KSVR ACS</AppText>
                <AppText style={styles.loadingText}>กำลังตรวจสอบสิทธิ์...</AppText>
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
                                options={{ headerShown: false }} 
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