import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Image } from 'react-native';
import { AlertTriangle, ShieldCheck, Phone, Activity } from 'lucide-react-native';
import { AppText } from '../components/AppText';

const KnowledgeScreen = () => {

    // ฟังก์ชันสำหรับกดโทรออกฉุกเฉิน
    const handleCallEmergency = () => {
        Linking.openURL('tel:1669');
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            
            {/* Header Image (ใส่รูปปกสวยๆ) */}
            <View style={styles.headerContainer}>
                {/* คุณสามารถเปลี่ยน uri เป็นรูปจาก Project ของคุณเองได้ */}
                <Image 
                    source={{ uri: 'https://img.freepik.com/free-vector/human-heart-concept-illustration_114360-8354.jpg' }} 
                    style={styles.headerImage} 
                />
                <View style={styles.headerOverlay} />
                <AppText style={styles.headerTitle}>รู้จักโรค ACS{"\n"}(กล้ามเนื้อหัวใจขาดเลือด)</AppText>
            </View>
            
            {/* ส่วนที่ 1: อาการที่ต้องระวัง */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <AlertTriangle color="#FF9800" size={24} />
                    <AppText style={styles.cardTitle}>สัญญาณเตือนอันตราย!</AppText>
                </View>
                <AppText style={styles.description}>
                    หากมีอาการเหล่านี้ "เฉียบพลัน" ควรรีบไปโรงพยาบาล หรือโทร 1669 ทันที
                </AppText>
                <View style={styles.listContainer}>
                    <ListItem text="เจ็บแน่นหน้าอก เหมือนมีของหนักทับ" />
                    <ListItem text="ปวดร้าวไปที่ ไหล่ซ้าย, กราม หรือหลัง" />
                    <ListItem text="เหงื่อแตก ตัวเย็น ใจสั่น" />
                    <ListItem text="หายใจไม่อิ่ม เหนื่อยหอบ นอนราบไม่ได้" />
                    <ListItem text="หน้ามืด วูบ หรือหมดสติ" />
                </View>
            </View>

            {/* ส่วนที่ 2: ปุ่มฉุกเฉิน */}
            <View style={[styles.card, styles.emergencyCard]}>
                <AppText style={styles.emergencyAppText}>พบผู้ป่วยหรือมีอาการฉุกเฉิน?</AppText>
                <TouchableOpacity style={styles.callButton} onPress={handleCallEmergency}>
                    <Phone color="white" size={24} style={{ marginRight: 10 }} />
                    <AppText style={styles.callButtonAppText}>โทร 1669 ทันที</AppText>
                </TouchableOpacity>
                <AppText style={styles.subAppText}>ให้บริการฟรี ตลอด 24 ชั่วโมง</AppText>
            </View>

            {/* ส่วนที่ 3: การปฏิบัติตัวและป้องกัน */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <ShieldCheck color="#4CAF50" size={24} />
                    <AppText style={styles.cardTitle}>การป้องกันและดูแลตัวเอง</AppText>
                </View>
                <AppText style={styles.description}>
                    ปรับเปลี่ยนพฤติกรรมเพื่อลดความเสี่ยงการเกิดโรคซ้ำ
                </AppText>
                <View style={styles.listContainer}>
                    <PreventionItem 
                        title="งดสูบบุหรี่" 
                        desc="บุหรี่เป็นปัจจัยเสี่ยงหลักที่ทำให้หลอดเลือดหัวใจตีบ" 
                    />
                    <PreventionItem 
                        title="คุมอาหาร" 
                        desc="ลดหวาน มัน เค็ม ทานผักผลไม้ให้มากขึ้น" 
                    />
                    <PreventionItem 
                        title="ออกกำลังกาย" 
                        desc="แอโรบิคเบาๆ อย่างน้อย 150 นาที/สัปดาห์ (ตามแพทย์สั่ง)" 
                    />
                    <PreventionItem 
                        title="ทานยาตรงเวลา" 
                        desc="ห้ามหยุดยาเองโดยเด็ดขาด แม้อาการจะดีขึ้นแล้ว" 
                    />
                </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Activity color="#ccc" size={20} />
                <AppText style={styles.footerAppText}>ด้วยความปรารถนาดีจาก รพ.ค่ายกฤษณ์สีวะรา</AppText>
            </View>

        </ScrollView>
    );
};

// Component ย่อยสำหรับ List รายการอาการ
const ListItem = ({ text }: { text: string }) => (
    <View style={styles.row}>
        <View style={styles.bullet} />
        <AppText style={styles.itemAppText}>{text}</AppText>
    </View>
);

// Component ย่อยสำหรับ List การป้องกัน
const PreventionItem = ({ title, desc }: { title: string, desc: string }) => (
    <View style={styles.preventionContainer}>
        <AppText style={styles.preventionTitle}>• {title}</AppText>
        <AppText style={styles.preventionDesc}>{desc}</AppText>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    headerContainer: {
        height: 200,
        justifyContent: 'flex-end',
        padding: 20,
        position: 'relative',
    },
    headerImage: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    headerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)', // สีดำโปร่งแสงเพื่อให้ตัวหนังสือชัด
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        zIndex: 1,
    },
    card: {
        backgroundColor: 'white',
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        borderRadius: 12,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
        color: '#333',
    },
    description: {
        fontSize: 14,
        color: '#666',
        marginBottom: 15,
        lineHeight: 22,
    },
    listContainer: {
        marginTop: 5,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FF5252',
        marginTop: 8,
        marginRight: 10,
    },
    itemAppText: {
        fontSize: 15,
        color: '#444',
        flex: 1,
        lineHeight: 22,
    },
    // Emergency Card Styles
    emergencyCard: {
        backgroundColor: '#FFEBEE', // สีพื้นหลังแดงอ่อนๆ
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFCDD2',
    },
    emergencyAppText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#D32F2F',
        marginBottom: 12,
    },
    callButton: {
        flexDirection: 'row',
        backgroundColor: '#D32F2F',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 50,
        alignItems: 'center',
        shadowColor: '#D32F2F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    callButtonAppText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    subAppText: {
        marginTop: 8,
        fontSize: 12,
        color: '#D32F2F',
    },
    // Prevention Styles
    preventionContainer: {
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: '#eee',
    },
    preventionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2E7D32',
        marginBottom: 4,
    },
    preventionDesc: {
        fontSize: 14,
        color: '#555',
        paddingLeft: 12,
    },
    footer: {
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    footerAppText: {
        color: '#999',
        fontSize: 12,
    }
});

export default KnowledgeScreen;