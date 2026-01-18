import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  Modal, 
  ScrollView, 
  StatusBar,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, X, AlertTriangle, Calendar, FileHeart } from 'lucide-react-native';
import { AppText } from '../components/AppText'; 
import * as Notifications from 'expo-notifications'; // ✅ 1. Import เพิ่ม

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
    
    // รับข้อมูลจากหน้า Home (เป็นค่าเริ่มต้น)
    const [notificationList, setNotificationList] = useState(route.params?.notifications || []);
    const [selectedNotification, setSelectedNotification] = useState<any>(null);
    const notificationListRef = useRef(notificationList); // Ref ช่วยจำค่าล่าสุด

    useEffect(() => {
        const initialId = route.params?.initialId;
        if (initialId) {
            // หาข้อความที่มี ID ตรงกับที่กดมา
            const targetNotif = notificationList.find((n: any) => n.id === initialId);
            if (targetNotif) {
                // 1. เปิด Modal
                setSelectedNotification(targetNotif);
                
                // 2. อัปเดตสถานะเป็นอ่านแล้ว (ในกรณีที่ยังไม่ได้แก้จากหน้า Home)
                const updatedList = notificationList.map((n: any) => 
                    n.id === initialId ? { ...n, read: true } : n
                );
                setNotificationList(updatedList);
            }
        }
    }, [route.params?.initialId]); // ทำงานเมื่อมีการเปลี่ยนค่า initialId
    // Sync Ref กับ State เสมอ
    useEffect(() => {
        notificationListRef.current = notificationList;
    }, [notificationList]);

    // ✅ 2. เพิ่ม useEffect ดักฟังข้อความใหม่ (Real-time)
    useEffect(() => {
        // Listener: เมื่อมีข้อความใหม่เข้ามาขณะเปิดหน้านี้อยู่
        const subscription = Notifications.addNotificationReceivedListener(notification => {
            const content = notification.request.content;
            const identifier = notification.request.identifier;

            // เช็คว่ามีอยู่แล้วหรือยัง (กันซ้ำ)
            const isDuplicate = notificationListRef.current.some((n: any) => n.id === identifier);
            if (isDuplicate) return;

            const now = new Date();
            const timeString = now.toLocaleDateString('th-TH', {
                year: '2-digit', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            }) + ' น.';

            const newNotif = {
                id: identifier, // ใช้ ID จริง
                type: content.data?.type || 'info',
                title: content.title || 'การแจ้งเตือนใหม่',
                body: content.body || '',
                time: timeString,
                read: false // เข้ามาใหม่ยังไม่ได้อ่าน
            };

            // เพิ่มเข้า list ทันที
            setNotificationList(prev => [newNotif, ...prev]);
        });

        return () => subscription.remove();
    }, []);

    // ฟังก์ชันเมื่อกดอ่าน
    const handleNotificationPress = (item: any) => {
        const updatedList = notificationList.map((n: any) => 
                n.id === item.id ? { ...n, read: true } : n
            );
        setNotificationList(updatedList);
        setSelectedNotification(item);

        // ✅ 2. ส่งสัญญาณกลับไปบอก HomeScreen ว่า "ID นี้อ่านแล้วนะ"
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
                {/* ไอคอน */}
                <View style={[styles.iconBox, { backgroundColor: style.bg }]}>
                    <IconComponent size={24} color={style.color} />
                </View>
                
                {/* เนื้อหา */}
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
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={28} color="#1E293B" />
                </TouchableOpacity>
                <AppText style={styles.headerTitle}>การแจ้งเตือน</AppText>
                <View style={{ width: 28 }} /> 
            </View>

            <FlatList
                data={notificationList}
                keyExtractor={(item: any) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <FileHeart size={50} color="#CBD5E1" />
                        <AppText style={styles.emptyText}>ไม่มีการแจ้งเตือนใหม่</AppText>
                    </View>
                }
            />

            <Modal
                transparent={true}
                visible={!!selectedNotification}
                animationType="fade"
                onRequestClose={() => setSelectedNotification(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedNotification && (
                            <>
                                <View style={styles.modalHeaderRow}>
                                    <View style={[styles.iconBox, { backgroundColor: getNotifIcon(selectedNotification.type).bg }]}>
                                        {(() => {
                                            const Icon = getNotifIcon(selectedNotification.type).icon;
                                            return <Icon size={24} color={getNotifIcon(selectedNotification.type).color} />;
                                        })()}
                                    </View>
                                    <TouchableOpacity onPress={() => setSelectedNotification(null)} style={styles.closeBtn}>
                                        <X size={22} color="#94A3B8" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={{ maxHeight: 400 }}>
                                    <AppText style={styles.modalTitle}>{selectedNotification.title}</AppText>
                                    <AppText style={styles.modalTime}>{selectedNotification.time}</AppText>
                                    <View style={styles.divider} />
                                    <AppText style={styles.modalBody}>{selectedNotification.body}</AppText>
                                </ScrollView>

                                <TouchableOpacity style={styles.okButton} onPress={() => setSelectedNotification(null)}>
                                    <AppText style={styles.okText}>ปิดหน้าต่าง</AppText>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
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
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', maxWidth: 340, backgroundColor: 'white', borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
    closeBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 6 },
    modalTime: { fontSize: 13, color: '#94A3B8', marginBottom: 15 },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 15 },
    modalBody: { fontSize: 15, color: '#334155', lineHeight: 24 },
    okButton: { marginTop: 25, backgroundColor: '#F1F5F9', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    okText: { color: '#475569', fontWeight: 'bold', fontSize: 15 }
});

export default NotificationScreen;