import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';

import { 
  Phone, 
  Lock, 
  Activity, 
  ChevronRight, 
  ShieldCheck, 
  Eye, 
  EyeOff,
  Stethoscope,
  Clock,
  Heart
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const LoginScreen = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const { onLogin } = useAuth();

  const [isSecure, setIsSecure] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();

  const handleLogin = async () => {
      if (!phoneNumber || !password) {
          Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบถ้วน');
          return;
      }

      setIsLoading(true);
      
      try {
        // 1. เรียก onLogin (ในนี้มีการ update setAuthState แล้ว)
        const result = await onLogin(phoneNumber, password);
        
        setIsLoading(false);

        if (result && result.status) {
          //  เช็คเงื่อนไข term_accepted_at
        } else {
          Alert.alert('เข้าสู่ระบบไม่สำเร็จ', result?.message || 'เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง');
        }

      } catch (error) {
        setIsLoading(false);
        Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
      }
  };

  // SOS Emergency Call Function
  const handleSOS = () => {
    Alert.alert(
      'ยืนยันการโทรฉุกเฉิน',
      'คุณกำลังจะโทรออกไปยังสายด่วน 1669',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'โทรออก', onPress: () => Linking.openURL('tel:1669'), style: 'destructive' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          
          {/* Header Section: Hospital Brand */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoBg}>
                <Activity size={70} color="rgba(255,255,255,0.15)" style={styles.bgIcon} />
                <Stethoscope size={50} color="#ffffff" strokeWidth={2.5} />
              </View>
              <View style={styles.pulseBadge}>
                <Activity size={14} color="#ffffff" strokeWidth={3} />
              </View>
            </View>
            
            <Text style={styles.hospitalName}>โรงพยาบาลค่ายกฤษณ์สีวะรา</Text>
            <View style={styles.appBadge}>
              <Text style={styles.appName}>KSVR ACS FASTTRACK</Text>
            </View>
          </View>

          {/* Login Form Section */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>เบอร์โทรศัพท์ผู้ป่วย</Text>
              <View style={styles.inputWrapper}>
                <Phone size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="0xx-xxx-xxxx"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholderTextColor="#cbd5e1"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>รหัสผ่าน</Text>
              <View style={styles.inputWrapper}>
                <Lock size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="กรอกรหัสผ่าน"
                  secureTextEntry={isSecure}
                  value={password}
                  onChangeText={setPassword}
                  placeholderTextColor="#cbd5e1"
                />
                <TouchableOpacity onPress={() => setIsSecure(!isSecure)} style={styles.eyeBtn}>
                  {isSecure ? <EyeOff size={20} color="#94a3b8" /> : <Eye size={20} color="#065f46" />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formFooter}>
              <View style={styles.rememberContainer}>
                <Clock size={14} color="#94a3b8" />
                <Text style={styles.rememberText}>จดจำข้อมูล</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.forgotText}>ลืมรหัสผ่าน?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.loginBtn, isLoading && styles.btnDisabled]} 
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={styles.loginBtnContent}>
                  <Text style={styles.loginBtnText}>เข้าสู่ระบบ</Text>
                  <ChevronRight size={22} color="#ffffff" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            {/* <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>หรือ</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity style={styles.registerBtn}>
              <Heart size={18} color="#059669" />
              <Text style={styles.registerBtnText}>ลงทะเบียนสมาชิกใหม่</Text>
            </TouchableOpacity> */}
          </View>

          {/* SOS Section: High Priority Emergency */}
          <View style={styles.sosCard}>
            <View style={styles.sosHeader}>
              <View style={styles.redDot} />
              <Text style={styles.sosSubtitle}>ระบบเรียกรถพยาบาลด่วน</Text>
            </View>
            <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
              <View style={styles.sosBtnContent}>
                <Phone size={26} color="#ffffff" fill="#ffffff" />
                <Text style={styles.sosBtnText}>โทร 1669 สายด่วน</Text>
              </View>
              <Text style={styles.sosTeam}>เบอร์ฉุกเฉินสำหรับผู้ป่วยที่มีอาการเจ็บป่วยวิกฤติ</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Security Section */}
          <View style={styles.footer}>
            <View style={styles.securityBadge}>
              <ShieldCheck size={14} color="#059669" />
              <Text style={styles.securityText}>PDPA SECURITY VERIFIED</Text>
            </View>
            <Text style={styles.copy}>Copyright © 2023 - 2025 FORT KRIT SIWARA HOSPTIAL.</Text>
            <Text style={styles.copySub}>มณฑลทหารบกที่ 29 | โรงพยาบาลค่ายกฤษณ์สีวะรา</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 20 : 40,
    paddingBottom: 50,
  },
  header: {
    alignItems: 'center',
    marginBottom: 35,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  logoBg: {
    width: 95,
    height: 95,
    backgroundColor: '#064e3b',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#064e3b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    transform: [{ rotate: '3deg' }],
  },
  bgIcon: {
    position: 'absolute',
  },
  pulseBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#dc2626',
    borderRadius: 20,
    padding: 8,
    borderWidth: 4,
    borderColor: '#ffffff',
    elevation: 4,
  },
  hospitalName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#064e3b',
    textAlign: 'center',
  },
  appBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  appName: {
    fontSize: 11,
    fontWeight: '900',
    color: '#065f46',
    letterSpacing: 2,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 30,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 54,
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
  eyeBtn: {
    padding: 8,
  },
  formFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 26,
    paddingHorizontal: 4,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 6,
    fontWeight: '700',
  },
  forgotText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '800',
  },
  loginBtn: {
    backgroundColor: '#064e3b',
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#064e3b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  loginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: 'bold',
    marginRight: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 26,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#cbd5e1',
    letterSpacing: 2,
  },
  registerBtn: {
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  registerBtnText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
  },
  sosCard: {
    marginTop: 26,
    backgroundColor: '#fff1f2',
    borderRadius: 30,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#ffe4e6',
  },
  sosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  redDot: {
    width: 6,
    height: 6,
    backgroundColor: '#e11d48',
    borderRadius: 3,
    marginRight: 8,
  },
  sosSubtitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#9f1239',
    letterSpacing: 1,
  },
  sosBtn: {
    backgroundColor: '#e11d48',
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  sosBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sosBtnText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  sosTeam: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 2,
  },
  footer: {
    marginTop: 35,
    alignItems: 'center',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  securityText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#059669',
    letterSpacing: 0.5,
  },
  copy: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  copySub: {
    fontSize: 10,
    color: '#cbd5e1',
    marginTop: 2,
    fontWeight: '700',
  }
});

export default LoginScreen;