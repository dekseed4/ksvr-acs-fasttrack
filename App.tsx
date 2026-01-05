import React from 'react';
import { AuthProvider, useAuth } from './app/context/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Map, BookOpen } from 'lucide-react-native';

import LoginScreen from './app/screens/LoginScreen';
import HomeScreen from './app/screens/HomeScreen';
import HospitalMapScreen from './app/screens/HospitalMapScreen';
import KnowledgeScreen from './app/screens/KnowledgeScreen';


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
    <AuthProvider>
      <Layout></Layout>
    </AuthProvider>
  );
}

export const Layout = () => {
    const { authState} = useAuth();

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{headerShown: false}}>{
                authState?.authenticated ? 
                   ( 
                    <Stack.Screen name="AppTabs" component={AppTabs} ></Stack.Screen>
                    )
                :
                    (
                    <Stack.Screen name="Login" component={LoginScreen} ></Stack.Screen>
                    )
                }
            </Stack.Navigator>
        </NavigationContainer>
        );
};
