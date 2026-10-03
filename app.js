// app.js - Logik Teras FamiliPintar


// 1. Import Modul Firebase (Gunakan pautan CDN untuk MVP HTML pantas)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

        // ---> TAMBAH BARIS INI JUGA (Sembunyikan modal jika terbuka) <---
        const authModalElement = document.getElementById('authModal');
        if (authModalElement) authModalElement.style.display = 'none';
      
        // Dapatkan data profil dan baki kredit dari Firestore
        const refPengguna = doc(db, "mynasab_users", user.uid);
        const snapPengguna = await getDoc(refPengguna);

        if (snapPengguna.exists()) {
            const dataPengguna = snapPengguna.data();
            // Kemas kini UI di top-bar
            document.getElementById('creditBalance').innerText = dataPengguna.credit_balance;
            document.getElementById('treeNameDisplay').innerText = dataPengguna.name;
          // Panggil fungsi load kotak dari database
            window.muatTurunSalasilah();
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

            // 2. Simpan kotak baharu ke Firestore (BESERTA KOORDINAT)
            const refKotakBaru = await addDoc(collection(db, "mynasab_nodes"), {
                owner_uid: penggunaSemasa.uid,
                node_type: jenisKotak,
                parent_node_id: idKotakInduk,
                name: "Ahli Baru",
                pos_x: leftBaru,  // <-- TAMBAH NI
                pos_y: topBaru,   // <-- TAMBAH NI
                created_at: new Date()
            });

            // 3. Kemas kini paparan baki kredit
            document.getElementById('creditBalance').innerText = bakiTerkini - 1;
            
            // ==========================================
            // 4. LOGIK MELUKIS KOTAK BAHARU DI SKRIN
            // ==========================================
            const canvas = document.getElementById('treeCanvas');
            const kotakInduk = document.getElementById(idKotakInduk);
            
            let topInduk = parseInt(kotakInduk.style.top);
            let leftInduk = parseInt(kotakInduk.style.left);

            let topBaru = topInduk;
            let leftBaru = leftInduk;

            // Tambah sedikit anjakan rawak supaya kotak tak bertindih 100% jika ditekan banyak kali
            let anjakKiriKanan = Math.floor(Math.random() * 160) - 80; // Anjak antara -80px ke 80px

            if (jenisKotak === 'parent') { topBaru -= 260; leftBaru += anjakKiriKanan; } 
            if (jenisKotak === 'child') { topBaru += 260; leftBaru += anjakKiriKanan; }  
            if (jenisKotak === 'spouse') { leftBaru += 280; } // Pasangan biasa di sebelah kanan terus

            const kotakBaru = document.createElement('div');
            kotakBaru.className = 'node-card';
            kotakBaru.id = refKotakBaru.id;
            kotakBaru.style.top = topBaru + 'px';
            kotakBaru.style.left = leftBaru + 'px';

            // Jadikan teks nama boleh diklik (cursor: pointer)
            kotakBaru.innerHTML = `
                <div id="nama_${refKotakBaru.id}" onclick="bukaProfil('${refKotakBaru.id}')" style="font-weight: bold; margin-bottom: 10px; color: #2980b9; cursor: pointer; text-decoration: underline;">
                    Ahli Baru (Klik Edit)
                </div>
                <button class="add-btn add-top" onclick="tambahKotak('parent', '${refKotakBaru.id}')">+</button>
                <button class="add-btn add-right" onclick="tambahKotak('spouse', '${refKotakBaru.id}')">+</button>
                <button class="add-btn add-bottom" onclick="tambahKotak('child', '${refKotakBaru.id}')">+</button>
            `;

            canvas.appendChild(kotakBaru);
            
            // Terus buka borang profil bila kotak baharu tercipta
            window.bukaProfil(refKotakBaru.id);
            // ==========================================

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

// ==========================================
// FUNGSI KEMAS KINI PROFIL AHLI (NAMA & LOKASI)
// ==========================================
window.bukaProfil = (idKotak) => {
    // Masukkan ID kotak ke dalam form supaya sistem tahu kotak mana nak diupdate
    document.getElementById('editNodeId').value = idKotak;
    document.getElementById('editNama').value = ""; // Kosongkan form
    document.getElementById('editLokasi').value = "";
    
    // Tunjukkan Modal Profil
    document.getElementById('profilModal').style.display = 'flex';
};

// Fungsi ini dipanggil bila borang profil ditekan "Simpan Profil"
document.getElementById('profilForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Halang page dari refresh
    
    const idKotak = document.getElementById('editNodeId').value;
    const namaBaru = document.getElementById('editNama').value;
    const lokasiBaru = document.getElementById('editLokasi').value;
    
    try {
        // 1. Simpan (Update) data ke dalam Firestore
        const refKotak = doc(db, "mynasab_nodes", idKotak);
        await updateDoc(refKotak, {
            name: namaBaru,
            city: lokasiBaru
        });
        
        // 2. Tukar nama pada kotak di skrin supaya pengguna terus nampak perubahan
        document.getElementById('nama_' + idKotak).innerText = namaBaru;
        document.getElementById('nama_' + idKotak).style.textDecoration = "none"; // Buang garisan underline lepas dah edit
        document.getElementById('nama_' + idKotak).style.color = "#2c3e50";
        
        // 3. Tutup modal
        document.getElementById('profilModal').style.display = 'none';
        
    } catch (error) {
        alert("Gagal menyimpan profil: " + error.message);
    }
});
      
// ==========================================
// FUNGSI MUAT TURUN (LOAD) DATA SALASILAH
// ==========================================
window.muatTurunSalasilah = async () => {
    if (!penggunaSemasa) return;

    try {
        // Cari kotak dalam database yang sepadan dengan ID pengguna (owner_uid)
        const q = query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid));
        const querySnapshot = await getDocs(q);
        
        const canvas = document.getElementById('treeCanvas');
        
        // Padam semua kotak kecuali 'Diri Sendiri' untuk pastikan kanvas bersih sebelum dilukis semula
        canvas.innerHTML = `
            <div class="node-card" style="top: 2500px; left: 2500px;" id="node_root">
                <div style="font-weight: bold; margin-bottom: 10px;">Diri Sendiri</div>
                <button class="add-btn add-top" onclick="tambahKotak('parent', 'node_root')">+</button>
                <button class="add-btn add-right" onclick="tambahKotak('spouse', 'node_root')">+</button>
                <button class="add-btn add-bottom" onclick="tambahKotak('child', 'node_root')">+</button>
            </div>
        `;
        
        // Lukis setiap kotak yang dijumpai dalam database
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const idKotak = doc.id;
            
            const kotakBaru = document.createElement('div');
            kotakBaru.className = 'node-card';
            kotakBaru.id = idKotak;
            
            // Guna koordinat dari database. Kalau takde (data lama), letak kat tengah (2500px)
            kotakBaru.style.top = (data.pos_y || 2500) + 'px';
            kotakBaru.style.left = (data.pos_x || 2500) + 'px';
            
            let namaPaparan = data.name || "Ahli Baru";
            let gayaNama = data.name !== "Ahli Baru" 
                ? "color: #2c3e50; text-decoration: none;" 
                : "color: #2980b9; text-decoration: underline;";

            kotakBaru.innerHTML = `
                <div id="nama_${idKotak}" onclick="bukaProfil('${idKotak}')" style="font-weight: bold; margin-bottom: 10px; cursor: pointer; ${gayaNama}">
                    ${namaPaparan}
                </div>
                <button class="add-btn add-top" onclick="tambahKotak('parent', '${idKotak}')">+</button>
                <button class="add-btn add-right" onclick="tambahKotak('spouse', '${idKotak}')">+</button>
                <button class="add-btn add-bottom" onclick="tambahKotak('child', '${idKotak}')">+</button>
            `;
            
            canvas.appendChild(kotakBaru);
        });
        
    } catch (error) {
        console.error("Gagal memuat turun salasilah:", error);
    }
};
