// ===== ตั้งค่า Firebase ของวัด =====
// คัดลอกค่าจาก Firebase Console > Project settings > General > Your apps > Web app > SDK setup and configuration (Config)
// ค่าเหล่านี้เปิดเผยในหน้าเว็บได้ตามปกติ ความปลอดภัยของข้อมูลอยู่ที่ไฟล์ firestore.rules

export const firebaseConfig = {
  apiKey: "AIzaSyCGOUoVcdQN4KuP2B2RC5tq6IuZEYDNbys",
  authDomain: "wat-suakham.firebaseapp.com",
  projectId: "wat-suakham",
  storageBucket: "wat-suakham.firebasestorage.app",
  messagingSenderId: "658156507671",
  appId: "1:658156507671:web:160c33e43592646f720252"
};

// อีเมล Google ของแอดมินหลัก (ใส่ให้ตรงกับในไฟล์ firestore.rules)
// เจ้าหน้าที่คนอื่นไม่ต้องใส่ที่นี่ ให้เพิ่มจากเมนู "เจ้าหน้าที่" ในหน้าเว็บ
export const ADMIN_EMAILS = [
  "krusossocial5344@gmail.com"
];

// (ไม่บังคับ) กันบอทส่งสลิปปลอมด้วย Firebase App Check + reCAPTCHA v3
// สร้าง site key ที่ https://www.google.com/recaptcha/admin แล้วเปิด App Check ใน Firebase Console ตาม README
export const RECAPTCHA_SITE_KEY = "";
