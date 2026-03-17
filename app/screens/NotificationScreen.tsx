import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  StatusBar,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, AlertTriangle, Calendar, FileHeart } from 'lucide-react-native';
import { AppText } from '../components/AppText'; 
import { FlashList } from "@shopify/flash-list";
import * as Notifications from 'expo-notifications'; 

// ✅ 1. Import Reanimated สำหรับทำ Slide Animation
import Animated, { SlideInRight, SlideOutRight } from 'react-native-reanimated';

// Helper เลือกไอคอน
const getNotifIcon = (type: string) => {
    switch (type) {
        case 'emergency': return { icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2' };
        case 'appointment': return { icon: Calendar, color: '#3B82F6', bg: '#EFF6FF' };
        case 'manual_announcement': return { icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB' };
        case 'info': 
        default: return { icon: FileHeart, color: '#10B981', bg: '#F0FDF4' };
    }
};

const NotificationScreen = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    
    const [notificationList, setNotificationList] = useState(route.params?.notifications || []);
    const [selectedNotification, setSelectedNotification] = useState<any>(null);
    const notificationListRef = useRef(notificationList);

    useEffect(() => {
        const initialId = route.params?.initialId;
        if (initialId) {
            const targetNotif = notificationList.find((n: any) => n.id === initialId);
            if (targetNotif) {
                setSelectedNotification(targetNotif);
                
                const updatedList = notificationList.map((n: any) => 
                    n.id === initialId ? { ...n, read: true } : n
                );
                setNotificationList(updatedList);
            }
        }
    }, [route.params?.initialId]); 

    useEffect(() => {
        notificationListRef.current = notificationList;
    }, [notificationList]);

    useEffect(() => {
        const subscription = Notifications.addNotificationReceivedListener(notification => {
            const content = notification.request.content;
            const identifier = notification.request.identifier;

            const isDuplicate = notificationListRef.current.some((n: any) => n.id === identifier);
            if (isDuplicate) return;

            const now = new Date();
            const timeString = now.toLocaleDateString('th-TH', {
                year: '2-digit', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            }) + ' น.';

            const newNotif = {
                id: identifier, 
                type: content.data?.type || 'info',
                title: content.title || 'การแจ้งเตือนใหม่',
                body: content.body || '',
                time: timeString,
                read: false 
            };

            setNotificationList((prev: any) => [newNotif, ...prev]);
        });

        return () => subscription.remove();
    }, []);

    const handleNotificationPress = (item: any) => {
        const updatedList = notificationList.map((n: any) => 
                n.id === item.id ? { ...n, read: true } : n
            );
        setNotificationList(updatedList);
        setSelectedNotification(item);

        DeviceEventEmitter.emit('notificationRead', item.id);
    };

    const renderItem = ({ item }: { item: any }) => {
        const style = getNotifIcon(item.type);
        const IconComponent = style.icon;
        const isRead = item.read;

        return (
            <TouchableOpacity 
                style={[
                    styles.itemContainer, 
                    { backgroundColor: isRead ? '#FFFFFF' : '#F0F9FF' }
                ]}
                activeOpacity={0.7}
                onPress={() => handleNotificationPress(item)}
            >
                <View style={[styles.iconBox, { backgroundColor: style.bg }]}>
                    <IconComponent size={24} color={style.color} />
                </View>
                
                <View style={{ flex: 1 }}>
                    <View style={styles.itemHeader}>
                        <AppText style={[styles.itemTitle, !isRead && styles.boldText]} numberOfLines={1}>
                            {item.title}
                        </AppText>
                        
                        {!isRead ? (
                            <View style={styles.redDot} />
                        ) : (
                            <AppText style={styles.readText}>อ่านแล้ว</AppText>
                        )}
                    </View>
                    
                    <AppText style={styles.itemBody} numberOfLines={2}>
                        {item.body}
                    </AppText>
                    
                    <AppText style={styles.itemTime}>{item.time}</AppText>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            
            {/* --- หน้าจอหลัก (รายการแจ้งเตือน) --- */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={28} color="#1E293B" />
                </TouchableOpacity>
                <AppText style={styles.headerTitle}>การแจ้งเตือน</AppText>
                <View style={{ width: 28 }} /> 
            </View>

            <FlashList
                data={notificationList}
                renderItem={renderItem}
                estimatedItemSize={80} 
                keyExtractor={(item: any) => item.id.toString()}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <FileHeart size={50} color="#CBD5E1" />
                        <AppText style={styles.emptyText}>ไม่มีการแจ้งเตือนใหม่</AppText>
                    </View>
                }
            />

            {/* ✅ 2. หน้าต่างรายละเอียด (ใช้ Reanimated Slide ทับเต็มจอ) */}
            {selectedNotification && (
                <Animated.View 
                    entering={SlideInRight.duration(250)} 
                    exiting={SlideOutRight.duration(250)}
                    style={styles.detailOverlayView}
                >
                    {/* Header ของหน้ารายละเอียด */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => setSelectedNotification(null)} style={styles.backButton}>
                            <ChevronLeft size={28} color="#1E293B" />
                        </TouchableOpacity>
                        <AppText style={styles.headerTitle}>รายละเอียด</AppText>
                        <View style={{ width: 28 }} /> 
                    </View>

                    {/* เนื้อหา */}
                    <ScrollView contentContainerStyle={styles.detailContent}>
                        <View style={[styles.detailIconCircle, { backgroundColor: getNotifIcon(selectedNotification.type).bg }]}>
                            {(() => {
                                const Icon = getNotifIcon(selectedNotification.type).icon;
                                return <Icon size={32} color={getNotifIcon(selectedNotification.type).color} />;
                            })()}
                        </View>

                        <AppText style={styles.detailTitle}>{selectedNotification.title}</AppText>
                        <AppText style={styles.detailTime}>{selectedNotification.time}</AppText>
                        
                        <View style={styles.divider} />
                        
                        <AppText style={styles.detailBody}>{selectedNotification.body}</AppText>
                    </ScrollView>
                </Animated.View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    backButton: { padding: 5 },
    itemContainer: { flexDirection: 'row', padding: 16, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    itemTitle: { fontSize: 16, color: '#334155', flex: 1, marginRight: 10 },
    boldText: { fontWeight: 'bold', color: '#0F172A' },
    itemBody: { fontSize: 14, color: '#64748B', lineHeight: 20 },
    itemTime: { fontSize: 12, color: '#94A3B8', marginTop: 6 },
    redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
    readText: { fontSize: 10, color: '#94A3B8' },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { marginTop: 10, color: '#94A3B8' },
    
    // ✅ 3. สไตล์สำหรับหน้าต่าง Slide 
    detailOverlayView: {
        ...StyleSheet.absoluteFillObject, // คลุมเต็มพื้นที่หน้าจอเป๊ะๆ
        backgroundColor: '#FFFFFF',
        zIndex: 10, // ให้อยู่เลเยอร์บนสุด
    },
    detailContent: {
        padding: 24,
        alignItems: 'center', // จัดให้อยู่ตรงกลางนิดหน่อย
    },
    detailIconCircle: {
        width: 70, 
        height: 70, 
        borderRadius: 35, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: 20,
        marginTop: 10,
    },
    detailTitle: { 
        fontSize: 22, 
        fontWeight: 'bold', 
        color: '#1E293B', 
        marginBottom: 8,
        textAlign: 'center'
    },
    detailTime: { 
        fontSize: 14, 
        color: '#94A3B8', 
        marginBottom: 20 
    },
    divider: { 
        height: 1, 
        backgroundColor: '#F1F5F9', 
        marginBottom: 20,
        width: '100%' 
    },
    detailBody: { 
        fontSize: 16, 
        color: '#334155', 
        lineHeight: 26,
        width: '100%',
        textAlign: 'left' // ให้เนื้อหาชิดซ้ายอ่านง่าย
    },
});

export default NotificationScreen;