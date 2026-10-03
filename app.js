// app.js - Logik Teras FamiliPintar


// 1. Import Modul Firebase (Gunakan pautan CDN untuk MVP HTML pantas)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. Konfigurasi Firebase Anda (Dapatkan ini di Firebase Console -> Project Settings)
const firebaseConfig = {
  apiKey: "AIzaSyA7SW4U--evGtfRyPz5Feh3mEN8MF92gTg",
  authDomain: "familipintar.firebaseapp.com",
  databaseURL: "https://familipintar-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "familipintar",
  storageBucket: "familipintar.firebasestorage.app",
  messagingSenderId: "277029764059",
  appId: "1:277029764059:web:0a21bb2e01d868b1ed05fe",
  measurementId: "G-S3RP7E4460"
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

        // --- TAMBAH DUA BARIS INI ---
        const welcomeElement = document.getElementById('welcomeScreen');
        if (welcomeElement) welcomeElement.style.display = 'none'; 
        // ----------------------------
      
        // Dapatkan data profil dan baki kredit dari Firestore
        const refPengguna = doc(db, "mynasab_users", user.uid);
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
// FUNGSI LOG MASUK
// ==========================================
window.logMasuk = async (emel, kataLaluan) => {
    try {
        await signInWithEmailAndPassword(auth, emel, kataLaluan);
        alert("Log masuk berjaya!");
        document.getElementById('authModal').style.display = 'none'; // Sembunyikan modal
    } catch (error) {
        alert("Log masuk gagal. Sila semak emel dan kata laluan anda.");
        console.error(error);
    }
};

// ==========================================
// FUNGSI PENDAFTARAN & PEMBERIAN KREDIT PERCUMA
// ==========================================
window.daftarPengguna = async (emel, kataLaluan, namaKeluarga) => {
    try {
        const kredensial = await createUserWithEmailAndPassword(auth, emel, kataLaluan);
        const user = kredensial.user;

        // Cipta profil pengguna dan berikan 10 KREDIT PERCUMA di Firestore
        await setDoc(doc(db, "mynasab_users", user.uid), {
            name: namaKeluarga,
            email: emel,
            credit_balance: 10,
            created_at: new Date()
        });

        // Cipta rekod Family Tree utama untuk pengguna ini
        const kodJemputan = Math.random().toString(36).substring(2, 8).toUpperCase();
        await addDoc(collection(db, "mynasab_trees"), {
            tree_name: "Keluarga " + namaKeluarga,
            admin_uid: user.uid,
            invite_code: kodJemputan,
            created_at: new Date()
        });

        alert("Pendaftaran berjaya! Anda menerima 10 Kredit Kotak percuma.");
        
        // ---> TAMBAH BARIS INI UNTUK TUTUP KOTAK BORANG <---
        document.getElementById('authModal').style.display = 'none'; 

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

    const refPengguna = doc(db, "mynasab_users", penggunaSemasa.uid);
    
    try {
        const snapPengguna = await getDoc(refPengguna);
        const bakiTerkini = snapPengguna.data().credit_balance;

        if (bakiTerkini <= 0) {
            alert("Baki kredit tidak mencukupi. Sila Beli Kredit.");
            return;
        }

        if (confirm(`Gunakan 1 kredit untuk tambah kotak (${jenisKotak})?`)) {
            
            // 1. Tolak kredit di Firestore
            await updateDoc(refPengguna, { credit_balance: increment(-1) });

            // 2. Simpan kotak baharu ke Firestore
            const refKotakBaru = await addDoc(collection(db, "mynasab_nodes"), {
                owner_uid: penggunaSemasa.uid,
                node_type: jenisKotak,
                parent_node_id: idKotakInduk,
                name: "Ahli Baru",
                created_at: new Date()
            });

            // 3. Kemas kini paparan baki kredit
            document.getElementById('creditBalance').innerText = bakiTerkini - 1;
            
            // ==========================================
            // 4. LOGIK MELUKIS KOTAK BAHARU DI SKRIN
            // ==========================================
            const canvas = document.getElementById('treeCanvas');
            const kotakInduk = document.getElementById(idKotakInduk);
            
            // Dapatkan koordinat (posisi) kotak asal yang diklik
            let topInduk = parseInt(kotakInduk.style.top);
            let leftInduk = parseInt(kotakInduk.style.left);

            // Tentukan kedudukan kotak baharu berdasarkan jenis
            let topBaru = topInduk;
            let leftBaru = leftInduk;

            if (jenisKotak === 'parent') { topBaru -= 250; }     // Naik ke atas
            if (jenisKotak === 'child') { topBaru += 250; }      // Turun ke bawah
            if (jenisKotak === 'spouse') { leftBaru += 250; }    // Gerak ke kanan

            // Cipta elemen HTML (div) untuk kotak baharu
            const kotakBaru = document.createElement('div');
            kotakBaru.className = 'node-card';
            kotakBaru.id = refKotakBaru.id; // Gunakan ID dari pangkalan data
            kotakBaru.style.top = topBaru + 'px';
            kotakBaru.style.left = leftBaru + 'px';

            // Masukkan butang dan teks ke dalam kotak baharu
            kotakBaru.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 10px; color: #e74c3c;">Ahli Baru</div>
                <button class="add-btn add-top" onclick="tambahKotak('parent', '${refKotakBaru.id}')">+</button>
                <button class="add-btn add-right" onclick="tambahKotak('spouse', '${refKotakBaru.id}')">+</button>
                <button class="add-btn add-bottom" onclick="tambahKotak('child', '${refKotakBaru.id}')">+</button>
            `;

            // Tampal kotak baharu ke atas kanvas
            canvas.appendChild(kotakBaru);
            // ==========================================
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
