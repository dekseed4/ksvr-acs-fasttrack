// URL ของ Server จริง (Production)
const PROD_URL = "https://ksvrhospital.go.th/krit-siwara_smart_heart/api";

// URL ของเครื่องเรา (Development) - เผื่อคุณรัน Laravel ในเครื่องตัวเอง
// อย่าลืมเปลี่ยน IP เป็น IPv4 ของเครื่องคอมคุณนะครับ (ถ้าใช้ Emulator)
const DEV_URL = "http://192.168.1.XX:8000/api"; 


const HOSPITAL_COORDS = {
    latitude: 17.187368,
    longitude: 104.105749,
    name: 'รพ.ค่ายกฤษณ์สีวะรา'
};

export { HOSPITAL_COORDS };
// Logic การเลือก URL อัตโนมัติ
// __DEV__ เป็นตัวแปรพิเศษของ React Native ที่เป็น true เมื่อเรา debug อยู่
export const API_URL = __DEV__ ? PROD_URL : PROD_URL; 
// หมายเหตุ: ถ้าช่วงนี้อยากใช้ Server จริงตลอด ให้ใส่ PROD_URL ทั้งคู่ไปก่อนได้ครับ

