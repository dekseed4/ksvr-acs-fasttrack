import { Button } from 'react-native';
import { AuthProvider } from './app/context/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from './app/context/AuthContext';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './app/screens/LoginScreen';
import HomeScreen from './app/screens/HomeScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AuthProvider>
      <Layout></Layout>
    </AuthProvider>
  );
}

export const Layout = () => {
    const { authState, onLogout} = useAuth();

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{headerShown: false}}>{
                authState?.authenticated ? 
                   ( 
                   <Stack.Screen 
                        name="Home" 
                        component={HomeScreen}
                        options={{
                            headerRight: () => (
                                <Button onPress={onLogout} title="Logout" />
                            ),
                        }} ></Stack.Screen>
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
