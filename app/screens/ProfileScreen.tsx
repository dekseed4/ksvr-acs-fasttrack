import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
} from 'react-native';
import {
  User,
  AlertTriangle,
  Phone,
  ChevronLeft
} from 'lucide-react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { AppText } from '../components/AppText'; 

const ProfileScreen = ({ navigation }) => {
  const { authState } = useAuth();
  const user = authState?.user;
  
  const [imageLoadError, setImageLoadError] = useState(false);

  // Helper: แปลง array ของโรคเป็น string
  const getCongenitalDiseases = () => {
    if (!user?.detail_medical?.patient_congenital_disease) return '-';
    if (Array.isArray(user.detail_medical.patient_congenital_disease)) {
       return user.detail_medical.patient_congenital_disease.map(d => d.name).join(', ') || 'ไม่มีโรคประจำตัว';
    }
    return '-';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        >
            <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>ข้อมูลส่วนตัว</AppText>
        <View style={{ width: 24 }} /> 
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
        <View style={{ padding: 20 }}>
          
          {/* Medical Card Section */}
          <View style={styles.medicalCard}>
            <View style={styles.medicalHeaderCenter}>
              <View style={styles.medicalAvatarLarge}>
                {user?.detail_genaral?.picture_profile &&
                 user?.detail_genaral?.picture_profile !== 'default.jpg' &&
                 !imageLoadError ? (
                  <Image 
                    source={{ uri: `https://ksvrhospital.go.th/krit-siwara_smart_heart/files/avatars/${user.detail_genaral?.picture_profile}` }}
                    style={{ width: '100%', height: '100%', borderRadius: 30 }}
                    resizeMode="cover"
                    onError={() => setImageLoadError(true)}
                  />
                ) : (
                  <User size={40} color="white" />
                )}
              </View>
              <View style={{alignItems: 'center', marginTop: 10}}>
                <AppText style={styles.medicalNameCenter}>{user?.name || 'ไม่ระบุชื่อ'}</AppText>
                <AppText style={styles.medicalHNCenter}>HN: {user?.hn || user?.username || '-'}</AppText>
              </View>
            </View>

            <View style={styles.medicalGrid}>
              <View style={styles.medicalItem}>
                <AppText style={styles.medicalLabel}>กรุ๊ปเลือด</AppText>
                <AppText style={styles.medicalValueRed}>{user?.detail_medical?.blood_type || '-'}</AppText>
              </View>
              <View style={styles.medicalLine} />
              <View style={styles.medicalItem}>
                <AppText style={styles.medicalLabel}>อายุ</AppText>
                <AppText style={styles.medicalValue}>{user?.detail_genaral?.age ? `${user.detail_genaral.age} ปี` : '-'}</AppText>
              </View>
              <View style={styles.medicalLine} />
              <View style={styles.medicalItem}>
                <AppText style={styles.medicalLabel}>โรคประจำตัว</AppText>
                <AppText style={styles.medicalValue} numberOfLines={1}>{getCongenitalDiseases()}</AppText>
              </View>
            </View>

            <View style={styles.allergyBox}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 5}}>
                <AlertTriangle size={16} color="#F59E0B" />
                <AppText style={styles.allergyTitle}> ประวัติการแพ้ยา</AppText>
              </View>
              <AppText style={styles.allergyText}>{user?.detail_medical?.drug_allergy_history || 'ไม่มีประวัติการแพ้ยา'}</AppText>
            </View>

            {/* General Info Section */}
            <View style={styles.infoSection}>
              <AppText style={styles.infoSectionTitle}>ข้อมูลทั่วไป</AppText>
              
              <View style={styles.infoRowSimple}>
                <AppText style={styles.infoLabelSimple}>เลขบัตรประชาชน</AppText>
                <AppText style={styles.infoValueSimple}>{user?.detail_genaral?.cid || '-'}</AppText>
              </View>
              
              <View style={styles.infoRowSimple}>
                <AppText style={styles.infoLabelSimple}>วันเกิด</AppText>
                <AppText style={styles.infoValueSimple}>{user?.detail_genaral?.birthday || '-'}</AppText>
              </View>

              <View style={styles.infoRowSimple}>
                <AppText style={styles.infoLabelSimple}>อีเมล</AppText>
                <AppText style={styles.infoValueSimple} numberOfLines={1}>{user?.detail_genaral?.email || '-'}</AppText>
              </View>

              <View style={styles.infoRowSimple}>
                <AppText style={styles.infoLabelSimple}>เบอร์โทรศัพท์</AppText>
                <AppText style={styles.infoValueSimple}>{user?.detail_genaral?.phonenumber || '-'}</AppText>
              </View>
              
              <View style={styles.infoRowSimple}>
                <AppText style={styles.infoLabelSimple}>ที่อยู่</AppText>
                <AppText style={styles.infoValueSimple}>{user?.addr?.address1 || '-'}</AppText>
              </View>

              <View style={styles.infoRowSimple}>
                <AppText style={styles.infoLabelSimple}>หน่วย/สังกัด</AppText>
                <AppText style={styles.infoValueSimple}>
                  {user?.detail_genaral?.unit || '-'} {user?.detail_genaral?.sub ? `(${user.detail_genaral.sub})` : ''}
                </AppText>
              </View>
            </View>

            {/* Medical Rights Section */}
            <View style={styles.infoSection}>
              <AppText style={styles.infoSectionTitle}>ข้อมูลสิทธิและการรักษา</AppText>

              <View style={styles.infoRowSimple}>
                <AppText style={styles.infoLabelSimple}>สิทธิการรักษา</AppText>
                <AppText style={styles.infoValueSimple}>{user?.detail_medical?.claim_patient || '-'}</AppText>
              </View>
              
              <View style={styles.infoRowSimple}>
                <AppText style={styles.infoLabelSimple}>แพทย์เจ้าของไข้</AppText>
                <AppText style={styles.infoValueSimple}>{user?.detail_medical?.doctor || '-'}</AppText>
              </View>

              <View style={styles.infoRowSimple}>
                <AppText style={styles.infoLabelSimple}>สถานะสูบบุหรี่</AppText>
                <AppText style={styles.infoValueSimple}>{user?.detail_medical?.cigarette || '-'}</AppText>
              </View>
            </View>

            {/* Emergency Contact */}
            <View style={styles.infoSection}>
              <AppText style={styles.infoSectionTitle}>ผู้ติดต่อฉุกเฉิน</AppText>
              <View style={styles.contactRow}>
                <View style={styles.contactIcon}><Phone size={16} color="white" /></View>
                <View>
                  <AppText style={styles.contactName}>{user?.family_patient?.relation_name || 'ไม่ได้ระบุ'}</AppText>
                  <AppText style={styles.contactRelation}>
                    {user?.family_patient?.relationship ? `(${user.family_patient.relationship})` : ''} {user?.family_patient?.relation_tel || ''}
                  </AppText>
                </View>
              </View>
            </View>

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15, 
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0' },
  medicalCard: { backgroundColor: '#F8FAFC', borderRadius: 25, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 20 },
  medicalHeaderCenter: { alignItems: 'center', marginBottom: 20, paddingTop: 10 },
  medicalAvatarLarge: { width: 80, height: 80, borderRadius: 30, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  medicalNameCenter: { fontSize: 22, fontWeight: '900', color: '#1E293B', textAlign: 'center' },
  medicalHNCenter: { fontSize: 14, color: '#64748B', marginTop: 4 },
  medicalGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  medicalItem: { alignItems: 'center', flex: 1 },
  medicalLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', marginBottom: 4 },
  medicalValue: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
  medicalValueRed: { fontSize: 16, fontWeight: 'bold', color: '#EF4444' },
  medicalLine: { width: 1, height: 25, backgroundColor: '#E2E8F0' },
  allergyBox: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 15, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 20 },
  allergyTitle: { fontSize: 12, fontWeight: 'bold', color: '#D97706' },
  allergyText: { fontSize: 12, color: '#B45309', marginTop: 2, fontWeight: '500' },
  contactRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  contactIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  contactName: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  contactRelation: { fontSize: 11, color: '#64748B' },
  infoSection: { marginBottom: 20 },
  infoSectionTitle: { fontSize: 12, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 },
  infoRowSimple: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 8 },
  infoLabelSimple: { fontSize: 13, color: '#64748B', flex: 1 },
  infoValueSimple: { fontSize: 13, fontWeight: '600', color: '#1E293B', flex: 1.5, textAlign: 'right' },
});

export default ProfileScreen;