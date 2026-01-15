import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // ให้เด้งเตือนด้านบน
    shouldShowList: true,   // ให้เก็บในลิสต์แจ้งเตือน
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const usePushNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    // ฟังเหตุการณ์ตอนได้รับแจ้งเตือน (ขณะเปิดแอป)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    // ฟังเหตุการณ์ตอน "กด" ที่แจ้งเตือน
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        const notificationContent = response.notification.request.content;
        const data = notificationContent.data; // นี่คือข้อมูลที่ส่งมาจาก Laravel

        console.log("📦 Data from Server:", JSON.stringify(data, null, 2));
        if (data?.type === 'manual_announcement') {
            // ตัวอย่าง: ถ้าคุณใช้ Expo Router หรือ React Navigation
            // router.push('/notifications'); 
            // หรือ
            // navigation.navigate('NotificationHistory');
            console.log("👉 User should go to Announcement Screen");
        } 
        else if (data?.emergency_id) {
            console.log("👉 User should go to Tracking Screen ID:", data.emergency_id);
        }
    });

    return () => {
      // ใช้ .remove() แทน
        if (notificationListener.current) {
            notificationListener.current.remove();
        }
        if (responseListener.current) {
            responseListener.current.remove();
        }
    };
  }, []);

  return { expoPushToken, notification };
};

// ฟังก์ชันขอ Permission และดึง Token
async function registerForPushNotificationsAsync() {
    const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? 
    Constants?.expoConfig?.extra?.projectId;

    if (!projectId) {
        console.log('Project ID not found'); 
        // ถ้ามันขึ้นว่าไม่เจอ Project ID ให้ไปดูไฟล์ app.json (ข้อ 3 ด้านล่าง)
    }

    // 3. ใส่ projectId เข้าไปในวงเล็บ
    token = (await Notifications.getExpoPushTokenAsync({ 
        projectId: projectId 
    })).data;

    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX, // แจ้งเตือนระดับสูงสุด (มีเสียง+สั่น)
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return;
        }

        // ดึง Token (ต้องใช้ Project ID จาก eas config)
        token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig.extra.eas.projectId,
        })).data;
        
    } else {
        alert('Must use physical device for Push Notifications');
    }

  return token;
}