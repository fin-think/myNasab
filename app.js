// app.js - Logik Teras FamiliPintar

// 1. Import Modul Firebase (Gunakan pautan CDN untuk MVP HTML pantas)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. Konfigurasi Firebase Anda (Dapatkan ini di Firebase Console -> Project Settings)
const firebaseConfig = {
    apiKey: "GANTIKAN_DENGAN_API_KEY_ANDA",
    authDomain: "familipintar-xxxx.firebaseapp.com",
    projectId: "familipintar-xxxx",
    storageBucket: "familipintar-xxxx.appspot.com",
    messagingSenderId: "GANTIKAN_DENGAN_SENDER_ID",
    appId: "GANTIKAN_DENGAN_APP_ID"
};

// 3. Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let penggunaSemasa = null;

// ==========================================
// PENGURUSAN SESI (AUTH STATE)
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        penggunaSemasa = user;
        // Dapatkan data profil dan baki kredit dari Firestore
        const refPengguna = doc(db, "users", user.uid);
        const snapPengguna = await getDoc(refPengguna);

        if (snapPengguna.exists()) {
            const dataPengguna = snapPengguna.data();
            // Kemas kini UI di top-bar
            document.getElementById('creditBalance').innerText = dataPengguna.credit_balance;
            document.getElementById('treeNameDisplay').innerText = dataPengguna.name;
        }
    } else {
        penggunaSemasa = null;
        // Jika tidak log masuk, arahkan ke halaman log masuk / paparkan modal login
        console.log("Pengguna belum log masuk");
    }
});

// ==========================================
// FUNGSI PENDAFTARAN & PEMBERIAN KREDIT PERCUMA
// ==========================================
window.daftarPengguna = async (emel, kataLaluan, namaKeluarga) => {
    try {
        const kredensial = await createUserWithEmailAndPassword(auth, emel, kataLaluan);
        const user = kredensial.user;

        // Cipta profil pengguna dan berikan 10 KREDIT PERCUMA di Firestore
        await setDoc(doc(db, "users", user.uid), {
            name: namaKeluarga,
            email: emel,
            credit_balance: 10,
            created_at: new Date()
        });

        // Cipta rekod Family Tree utama untuk pengguna ini
        const kodJemputan = Math.random().toString(36).substring(2, 8).toUpperCase();
        await addDoc(collection(db, "trees"), {
            tree_name: "Keluarga " + namaKeluarga,
            admin_uid: user.uid,
            invite_code: kodJemputan,
            created_at: new Date()
        });

        alert("Pendaftaran berjaya! Anda menerima 10 Kredit Kotak percuma.");
    } catch (error) {
        alert("Ralat pendaftaran: " + error.message);
    }
};

// ==========================================
// FUNGSI TAMBAH KOTAK & TOLAK KREDIT (WALLET LOGIC)
// ==========================================
window.tambahKotak = async (jenisKotak, idKotakInduk) => {
    if (!penggunaSemasa) {
        alert("Sila log masuk untuk membina salasilah.");
        return;
    }

    const refPengguna = doc(db, "users", penggunaSemasa.uid);
    
    try {
        // Semak baki terkini dari pangkalan data (bukan dari UI untuk elak hack/manipulasi)
        const snapPengguna = await getDoc(refPengguna);
        const bakiTerkini = snapPengguna.data().credit_balance;

        if (bakiTerkini <= 0) {
            alert("Baki kredit tidak mencukupi. Sila Beli Kredit (RM5/RM10/RM20).");
            // window.location.href = "/topup.html"; // Arahkan ke halaman bayaran (ToyyibPay)
            return;
        }

        if (confirm(`Gunakan 1 kredit untuk tambah kotak (${jenisKotak})?`)) {
            
            // 1. Tolak 1 kredit menggunakan 'increment(-1)'. 
            // Ini sangat penting supaya transaksi selamat jika diklik bertubi-tubi.
            await updateDoc(refPengguna, {
                credit_balance: increment(-1)
            });

            // 2. Simpan kotak baharu ke dalam collection 'nodes'
            const refKotakBaru = await addDoc(collection(db, "nodes"), {
                owner_uid: penggunaSemasa.uid,
                node_type: jenisKotak,
                parent_node_id: idKotakInduk,
                name: "Ahli Baru", // Default name, pengguna akan edit kemudian
                created_at: new Date()
            });

            // 3. Kemas kini baki di skrin secara manual agar responsif
            document.getElementById('creditBalance').innerText = bakiTerkini - 1;
            
            alert(`Berjaya dipotong 1 kredit. Sila isi maklumat untuk kotak baharu ini.`);
            
            // Logik untuk papar Modal/Borang isian nama dan gambar akan diletakkan di sini.
            // ...
        }
    } catch (error) {
        alert("Gagal memproses transaksi: " + error.message);
    }
};

// ==========================================
// FUNGSI LOG KELUAR
// ==========================================
window.logKeluar = async () => {
    try {
        await signOut(auth);
        alert("Log keluar berjaya.");
        location.reload();
    } catch (error) {
        console.error("Ralat log keluar:", error);
    }
};
