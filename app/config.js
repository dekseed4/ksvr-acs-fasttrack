// URL ของ Server จริง (Production)
const PROD_URL = process.env.EXPO_PUBLIC_API_URL_PROD;

// URL ของเครื่องเรา (Development) - เผื่อคุณรัน Laravel ในเครื่องตัวเอง
// อย่าลืมเปลี่ยน IP เป็น IPv4 ของเครื่องคอมคุณนะครับ (ถ้าใช้ Emulator)
const DEV_URL = process.env.EXPO_PUBLIC_API_URL_DEV;

const HOSPITAL_COORDS = {
    id: 'fort_krit_main',
    name: "โรงพยาบาลค่ายกฤษณ์สีวะรา",
    address: "ถ.นิตโย ต.แวง อ.เมือง จ.สกลนคร",
    latitude: 17.187368,
    longitude: 104.105749,
    phone: "042712860",
    isMain: true,
    rating: 5.0,
    user_ratings_total: 'รพ.หลัก',
    open_now: true,
};

export { HOSPITAL_COORDS };
// Logic การเลือก URL อัตโนมัติ
// __DEV__ เป็นตัวแปรพิเศษของ React Native ที่เป็น true เมื่อเรา debug อยู่
export const API_URL = process.env.EXPO_PUBLIC_API_URL_PROD; 
// export const API_URL = __DEV__ ? PROD_URL : PROD_URL;
// หมายเหตุ: ถ้าช่วงนี้อยากใช้ Server จริงตลอด ให้ใส่ PROD_URL ทั้งคู่ไปก่อนได้ครับ

