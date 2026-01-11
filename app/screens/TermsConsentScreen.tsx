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
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, FileText, Check, LogOut, AlertTriangle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; 
import { API_URL } from '../config';


const { width } = Dimensions.get('window');

const TermsConsentScreen = () => {
  const navigation = useNavigation();
  const { onLogout } = useAuth(); // เรียกใช้ logout กรณีผู้ใช้กดปฏิเสธ
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { authState, setAuthState } = useAuth();

  // ฟังก์ชันกดยอมรับเงื่อนไข
  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      // เรียก API เพื่อบันทึกว่า User คนนี้ยอมรับแล้ว
      // หมายเหตุ: ต้องมี Route 'accept-terms' ใน Laravel ตามที่คุยกันไว้
      const response = await axios.post(`${API_URL}/accept-terms`);
        if (response.data.status) {
        // ✅ แก้ไขตรงนี้: ใช้ prev เพื่อดึงค่าล่าสุดชัวร์ๆ
            setAuthState(prev => ({
                ...prev, // เก็บ token และ authenticated เดิมไว้
                user: {
                    ...prev.user, // เก็บข้อมูล user เดิม (ชื่อ, hn ฯลฯ)
                    term_accepted_at: new Date().toISOString() // เพิ่มวันที่ยอมรับเข้าไป
                }
            }));

            // ไม่ต้องทำอะไรต่อ เดี๋ยว App.js จะดีดไปหน้า Home เองเมื่อ State เปลี่ยน
        } 
    } catch (error) {
      console.error(error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ฟังก์ชันปฏิเสธ (ออกจากระบบ)
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
            // 1. สั่ง Logout เพื่อเคลียร์ Token และ State
            await onLogout(); 
            
            // 2. ❌ ลบบรรทัดนี้ทิ้งได้เลยครับ! ไม่ต้องสั่ง navigate
            // navigation.replace('LoginScreen'); 
            
            // สาเหตุ: พอ onLogout ทำงาน -> authState จะเป็น false 
            // -> App.js จะ render ใหม่ -> และแสดงหน้า Login ให้เองอัตโนมัติครับ
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
           <Text style={styles.documentTitle}>KSVR ACS FASTTRACK TERMS</Text>
        </View>
        
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* ข้อที่ 1 */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>1. วัตถุประสงค์การให้บริการ</Text>
            <Text style={styles.paragraph}>
              แอปพลิเคชันนี้จัดทำขึ้นเพื่อเป็น "เครื่องมือช่วยอำนวยความสะดวก" ในการแจ้งเหตุฉุกเฉินและส่งพิกัดตำแหน่งของผู้ป่วยกลุ่มเสี่ยง ไปยังศูนย์รับแจ้งเหตุ เพื่อให้ทีมแพทย์เข้าช่วยเหลือได้รวดเร็วขึ้น
            </Text>
          </View>

          {/* ข้อที่ 2 */}
          <View style={styles.section}>
             <View style={styles.warningBox}>
                <AlertTriangle size={16} color="#b91c1c" style={{marginTop: 2}}/>
                <Text style={styles.warningText}>
                   ข้อสำคัญ: หากแอปพลิเคชันไม่ตอบสนอง หรือไม่มีสัญญาณอินเทอร์เน็ต ผู้ใช้งานต้องโทรแจ้งสายด่วน 1669 ทันที
                </Text>
             </View>
          </View>

          {/* ข้อที่ 3 */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>2. การคุ้มครองข้อมูลส่วนบุคคล (PDPA)</Text>
            <Text style={styles.paragraph}>
              ข้าพเจ้ายินยอมให้เปิดเผยข้อมูลดังต่อไปนี้เพื่อการรักษาพยาบาลฉุกเฉิน:
            </Text>
            <View style={styles.bulletItem}>
              <View style={styles.dot} />
              <Text style={styles.bulletText}>ข้อมูลสุขภาพ (โรคประจำตัว, ยา, การแพ้ยา)</Text>
            </View>
            <View style={styles.bulletItem}>
              <View style={styles.dot} />
              <Text style={styles.bulletText}>พิกัดตำแหน่งปัจจุบัน (GPS Location)</Text>
            </View>
            <Text style={styles.paragraph}>
              ข้อมูลของท่านจะถูกเก็บรักษาเป็นความลับและใช้เพื่อการช่วยเหลือชีวิตเท่านั้น
            </Text>
          </View>

          {/* ข้อที่ 4 */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>3. การยอมรับเงื่อนไข</Text>
            <Text style={styles.paragraph}>
              การกดปุ่ม "ยอมรับเงื่อนไข" ถือว่าท่านได้อ่าน เข้าใจ และตกลงที่จะปฏิบัติตามข้อกำหนดและเงื่อนไขข้างต้นทุกประการ
            </Text>
          </View>

          {/* พื้นที่ว่างด้านล่างเพื่อให้ Scroll สุดแล้วไม่ติดปุ่ม */}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Shadow Overlay ด้านล่างของกระดาษเพื่อให้ดูมีมิติ */}
        <View style={styles.fadeOverlay} />
      </View>

      {/* Action Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.acceptButton} 
          onPress={handleAccept}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.acceptText}>ยอมรับเงื่อนไข</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9', // สีพื้นหลังเดียวกับ Login
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#d1fae5',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#064e3b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  documentTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingLeft: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    marginRight: 10,
  },
  bulletText: {
    fontSize: 14,
    color: '#475569',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#991b1b',
    fontWeight: '600',
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    backgroundColor: '#f1f5f9',
  },
  acceptButton: {
    backgroundColor: '#064e3b', // สีเขียวเข้ม Theme โรงพยาบาล
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    elevation: 4,
    shadowColor: '#064e3b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    marginBottom: 16,
  },
  acceptText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  declineButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  declineText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  fadeOverlay: {
    height: 20,
    backgroundColor: 'transparent',
    // สามารถใส่ LinearGradient ตรงนี้ได้ถ้าต้องการให้สวยขึ้น
    // แต่เพื่อความง่ายใช้แค่ View ธรรมดา
  }
});

export default TermsConsentScreen;