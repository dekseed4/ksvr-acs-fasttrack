import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, FileText, Check, LogOut, AlertTriangle, Square, CheckSquare } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; 
import { API_URL } from '../config';

const { width } = Dimensions.get('window');

const TermsConsentScreen = () => {
  const navigation = useNavigation();
  const { onLogout } = useAuth(); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 🌟 เพิ่ม State สำหรับ Checkbox 2 ข้อ
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [isPrivacyAccepted, setIsPrivacyAccepted] = useState(false);

  const { authState, setAuthState } = useAuth();

  // ฟังก์ชันเปิดเว็บ Privacy Policy ฉบับเต็ม
  const openPrivacyPolicy = () => {
    // 🔗 เปลี่ยน URL ด้านล่างนี้เป็นลิงก์หน้าเว็บจริงของโรงพยาบาลคุณครับ
    Linking.openURL('https://ksvrhospital.rta.mi.th/ksvr/privacy_policy'); 
  };

  // ฟังก์ชันกดยอมรับเงื่อนไข
  const handleAccept = async () => {
    // 🌟 เช็คว่าติ๊กถูกครบ 2 ข้อหรือยัง
    if (!isTermsAccepted || !isPrivacyAccepted) {
      Alert.alert('กรุณายืนยัน', 'โปรดทำเครื่องหมายถูกทั้ง 2 ช่อง เพื่อยืนยันการยอมรับเงื่อนไขและนโยบายความเป็นส่วนตัว');
      return;
    }

    setIsSubmitting(true);
    try {
      // 🌟 ดึง Token จาก authState (ปรับชื่อตัวแปร token ตามที่คุณเก็บไว้ใน AuthContext จริงๆ นะครับ)
      const token = authState?.token || authState?.user?.api_token; 

      // 🌟 เพิ่ม Header ข้อมูล Token ลงไปใน axios
      const response = await axios.post(
        `${API_URL}/accept-terms`,
        {}, // ส่ง Body ว่างเปล่าไป (ถ้ามีข้อมูลจะส่งให้ใส่ตรงนี้)
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

        if (response.data.status) {
            setAuthState(prev => ({
                ...prev, 
                user: {
                    ...prev.user, 
                    term_accepted_at: new Date().toISOString() 
                }
            }));
        } 
    } catch (error) {
      // 🌟 เพิ่มการ Log Error ให้ละเอียดขึ้น เพื่อให้รู้ว่าพังที่ไหนแน่
      console.error("API Error: ", error.response?.data || error.message);
      
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ โปรดลองอีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'ยืนยันการปฏิเสธ',
      'หากท่านไม่ยอมรับเงื่อนไข ท่านจะไม่สามารถใช้งานแอปพลิเคชันได้ ระบบจะนำท่านออกจากระบบ',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { 
          text: 'ยืนยัน', 
          style: 'destructive',
          onPress: async () => {
            await onLogout(); 
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <ShieldCheck size={32} color="#064e3b" />
        </View>
        <Text style={styles.title}>ข้อกำหนดและนโยบาย</Text>
        <Text style={styles.subtitle}>กรุณาอ่านและยอมรับก่อนเริ่มใช้งาน</Text>
      </View>

      {/* Content Area */}
      <View style={styles.cardContainer}>
        <View style={styles.documentHeader}>
           <FileText size={18} color="#64748b" />
           <Text style={styles.documentTitle}>KSVR ACS FAST TRACK TERMS</Text>
        </View>
        
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* กล่องแจ้งเตือน */}
          <View style={styles.section}>
             <View style={styles.warningBox}>
                <AlertTriangle size={16} color="#b91c1c" style={{marginTop: 2}}/>
                <Text style={styles.warningText}>
                   ข้อสำคัญ: แอปพลิเคชันนี้เป็นเพียงเครื่องมือช่วยเหลือ หากแอปไม่ตอบสนอง หรือไม่มีสัญญาณอินเทอร์เน็ต กรุณาโทรสายด่วน 1669 ทันที
                </Text>
             </View>
          </View>

          {/* ส่วนที่ 1: ข้อตกลงการใช้งาน */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>1. ขอบเขตการให้บริการ</Text>
            <Text style={styles.paragraph}>
              แอปพลิเคชันนี้ใช้สำหรับแจ้งเหตุฉุกเฉินทางการแพทย์ (โรคหลอดเลือดหัวใจเฉียบพลัน) และติดตามพิกัดรถพยาบาลของ รพ.ค่ายกฤษณ์สีวะรา ความรวดเร็วในการให้บริการขึ้นอยู่กับสภาพการจราจรและเครือข่ายอินเทอร์เน็ต โรงพยาบาลจะไม่รับผิดชอบต่อความล่าช้าที่เกิดจากเหตุสุดวิสัย
            </Text>
          </View>

          {/* ส่วนที่ 2: นโยบายความเป็นส่วนตัว (PDPA) */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>2. การคุ้มครองข้อมูลส่วนบุคคล (PDPA)</Text>
            <Text style={styles.paragraph}>
              เพื่อให้การช่วยเหลือชีวิตเป็นไปอย่างรวดเร็วและแม่นยำ ข้าพเจ้ายินยอมให้โรงพยาบาลรวบรวมและประมวลผลข้อมูลดังต่อไปนี้:
            </Text>
            <View style={styles.bulletItem}>
              <View style={styles.dot} />
              <Text style={styles.bulletText}>ข้อมูลยืนยันตัวตน และข้อมูลสุขภาพ (เช่น โรคประจำตัว, ประวัติการแพ้ยา)</Text>
            </View>
            <View style={styles.bulletItem}>
              <View style={styles.dot} />
              <Text style={styles.bulletText}>พิกัดตำแหน่ง (Location): ทั้งในขณะใช้งานแอปพลิเคชัน และทำงานอยู่เบื้องหลัง (Background Location) เพื่อให้ทีมแพทย์สามารถติดตามการเคลื่อนที่ของท่านได้แบบเรียลไทม์ระหว่างรอการช่วยเหลือ</Text>
            </View>
            <View style={styles.bulletItem}>
              <View style={styles.dot} />
              <Text style={styles.bulletText}>การยืนยันตัวตนด้วย Face ID / Fingerprint เพื่อรักษาความปลอดภัยของข้อมูลสุขภาพ</Text>
            </View>
          </View>

          {/* 🌟 ปุ่มสำหรับกดอ่านฉบับเต็ม */}
          <TouchableOpacity style={styles.readMoreButton} onPress={openPrivacyPolicy}>
            <Text style={styles.readMoreText}>อ่านนโยบายความเป็นส่วนตัว (ฉบับเต็ม)</Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>
        <View style={styles.fadeOverlay} />
      </View>

      {/* 🌟 ส่วนสำหรับ Checkbox ยืนยัน */}
      <View style={styles.checkboxContainer}>
        <TouchableOpacity 
          style={styles.checkboxRow} 
          onPress={() => setIsTermsAccepted(!isTermsAccepted)}
          activeOpacity={0.7}
        >
          {isTermsAccepted ? <CheckSquare size={24} color="#064e3b" /> : <Square size={24} color="#94a3b8" />}
          <Text style={styles.checkboxText}>
            ข้าพเจ้าได้อ่านและยอมรับ <Text style={{fontWeight: 'bold'}}>ข้อกำหนดการใช้งาน</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.checkboxRow} 
          onPress={() => setIsPrivacyAccepted(!isPrivacyAccepted)}
          activeOpacity={0.7}
        >
          {isPrivacyAccepted ? <CheckSquare size={24} color="#064e3b" /> : <Square size={24} color="#94a3b8" />}
          <Text style={styles.checkboxText}>
            ข้าพเจ้ายินยอมให้ประมวลผลข้อมูลสุขภาพและตำแหน่งที่ตั้งตาม <Text style={{fontWeight: 'bold'}}>นโยบายความเป็นส่วนตัว</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          // 🌟 ปรับสีปุ่มให้เทาลงถ้ายังติ๊กไม่ครบ
          style={[styles.acceptButton, (!isTermsAccepted || !isPrivacyAccepted) && styles.acceptButtonDisabled]} 
          onPress={handleAccept}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.acceptText}>ยอมรับและเริ่มต้นใช้งาน</Text>
              <Check size={20} color="#ffffff" strokeWidth={3} />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.declineButton} 
          onPress={handleDecline}
          disabled={isSubmitting}
        >
          <LogOut size={16} color="#64748b" />
          <Text style={styles.declineText}>ไม่ยอมรับ และออกจากระบบ</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ... (เก็บ styles เดิมของคุณไว้ทั้งหมด และเพิ่มส่วนล่างนี้เข้าไปครับ) ...
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20, alignItems: 'center' },
  iconContainer: { width: 60, height: 60, backgroundColor: '#d1fae5', borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#064e3b', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b' },
  cardContainer: { flex: 1, backgroundColor: '#ffffff', marginHorizontal: 20, borderRadius: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  documentHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 8 },
  documentTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1 },
  scrollView: { flex: 1, backgroundColor: '#ffffff' },
  scrollContent: { padding: 20 },
  section: { marginBottom: 20 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  paragraph: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 8 },
  bulletItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingLeft: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#059669', marginRight: 10 },
  bulletText: { fontSize: 14, color: '#475569', flex: 1 },
  warningBox: { flexDirection: 'row', backgroundColor: '#fef2f2', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', gap: 10 },
  warningText: { flex: 1, fontSize: 13, color: '#991b1b', fontWeight: '600', lineHeight: 20 },
  
  // 🌟 Styles ใหม่ที่เพิ่มเข้ามา
  readMoreButton: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  readMoreText: {
    color: '#0369a1', // สีน้ำเงินเหมือนลิงก์
    fontWeight: 'bold',
    fontSize: 14,
  },
  checkboxContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#f1f5f9',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  acceptButtonDisabled: {
    backgroundColor: '#cbd5e1', // สีเทาเมื่อยังไม่ติ๊ก
    shadowOpacity: 0,
    elevation: 0,
  },
  
  footer: { paddingHorizontal: 24, paddingBottom: 24, backgroundColor: '#f1f5f9' },
  acceptButton: { backgroundColor: '#064e3b', flexDirection: 'row', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 4, shadowColor: '#064e3b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, marginBottom: 16 },
  acceptText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  declineButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 8 },
  declineText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  fadeOverlay: { height: 20, backgroundColor: 'transparent' }
});

export default TermsConsentScreen;