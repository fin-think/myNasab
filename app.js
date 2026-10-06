// ==========================================
// app.js - Logik Teras FamiliPintar (VERSI 4 - DASHBOARD)
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// TAMBAH MODULE STORAGE INI
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // INISIALISASI STORAGE
let penggunaSemasa = null;

// --- JEMPUTAN: baca ?jemput=KOD dari pautan ---
const kodJemput = new URLSearchParams(location.search).get('jemput');
let jemputan = null;
if (kodJemput) {
    getDoc(doc(db, "mynasab_invites", kodJemput)).then(s => {
        if (!s.exists()) { alert("Pautan jemputan tidak sah atau telah tamat."); return; }
        jemputan = s.data();
        const b = document.getElementById('bannerJemput');
        b.innerText = `${jemputan.nama_pengundang} menjemput anda sebagai adik-beradik ${jemputan.nama_sasaran}. Anda akan ditempatkan di bawah ibu bapa yang sama. Dengan mendaftar, nama dan maklumat salasilah anda boleh dilihat oleh keluarga yang dipautkan.`;
        b.classList.remove('hidden');
    });
}

// --- 1. PENGURUSAN SESI ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        penggunaSemasa = user;
        
        // Sembunyikan skrin depan & borang login
        const welcomeElement = document.getElementById('welcomeScreen');
        if (welcomeElement) welcomeElement.style.display = 'none'; 
        
        const authModalElement = document.getElementById('authModal');
        if (authModalElement) authModalElement.style.display = 'none';
        
        // Munculkan Dashboard
        const dashboardUtama = document.getElementById('dashboardUtama');
        if (dashboardUtama) dashboardUtama.classList.remove('hidden');
        
        const refPengguna = doc(db, "mynasab_users", user.uid);
        const snapPengguna = await getDoc(refPengguna);

        if (snapPengguna.exists()) {
            const dataPengguna = snapPengguna.data();
            document.getElementById('creditBalance').innerText = dataPengguna.credit_balance;
            document.getElementById('treeNameDisplay').innerText = dataPengguna.name;
            window.muatTurunSalasilah(); // Load data masuk ke jadual
        }
    } else {
        penggunaSemasa = null;
        const dashboardUtama = document.getElementById('dashboardUtama');
        if (dashboardUtama) dashboardUtama.classList.add('hidden');
    }
});

// --- 2. FUNGSI LOG MASUK & DAFTAR ---
window.logMasuk = async (emel, kataLaluan) => {
    try {
        await signInWithEmailAndPassword(auth, emel, kataLaluan);
        alert("Log masuk berjaya!");
        document.getElementById('authModal').style.display = 'none';
    } catch (error) {
        alert("Log masuk gagal. Sila semak emel dan kata laluan anda.");
    }
};

window.daftarPengguna = async (emel, kataLaluan, namaKeluarga, jantina) => {
    try {
        const kredensial = await createUserWithEmailAndPassword(auth, emel, kataLaluan);
        const user = kredensial.user;

        if (kodJemput && !jemputan) { 
            alert("Sila tunggu sebentar, jemputan sedang disemak."); 
            return; 
        }
        const kreditAwal = jemputan ? 5 : 10;
        
        await setDoc(doc(db, "mynasab_users", user.uid), {
            name: namaKeluarga,
            email: emel,
            credit_balance: kreditAwal,
            pdpa: { setuju: true, tarikh: new Date(), versi: "1.0" },
            created_at: new Date()
        });

        // Cipta Diri Sendiri (Root) secara automatik dalam database
await setDoc(doc(db, "mynasab_nodes", "root_" + user.uid), {
    owner_uid: user.uid,
    name: namaKeluarga,
    relationship: "Diri Sendiri (Induk)",
    gender: jantina,
    is_root: true,
    created_at: new Date(),
    ...(jem ? { sibling_of: jem.sasaran_id, link_owner: jemputan.owner_uid } : {})
});

        if (jem) {
            await setDoc(doc(db, "mynasab_links", user.uid), {
                uid: user.uid,
                owner_uid: jemputan.owner_uid,
                sasaran_id: jemputan.sasaran_id,
                kod: kodJemput,
                created_at: new Date()
            });
        }
        
        alert(`Pendaftaran berjaya! Anda menerima ${kreditAwal} Kredit percuma.`);
        document.getElementById('authModal').style.display = 'none'; 
    } catch (error) {
        alert("Ralat pendaftaran: " + error.message);
    }
};

window.logKeluar = async () => {
    try { await signOut(auth); location.reload(); } catch (error) {}
};

// --- 3. FUNGSI MUAT TURUN DATA KE JADUAL DASHBOARD ---
window.muatTurunSalasilah = async () => {
    if (!penggunaSemasa) return;
    try {
        const q = query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid));
        const querySnapshot = await getDocs(q);
        const tbody = document.getElementById('senaraiAhliTbody');
        
        tbody.innerHTML = ''; 
        
        // AUTO-PEMULIHAN: Jika jadual kosong, bina 'Diri Sendiri' secara automatik
        if (querySnapshot.empty) {
            const namaPenuh = document.getElementById('treeNameDisplay').innerText || "Ketua Keluarga";
            await setDoc(doc(db, "mynasab_nodes", "root_" + penggunaSemasa.uid), {
                owner_uid: penggunaSemasa.uid,
                name: namaPenuh,
                relationship: "Diri Sendiri (Induk)",
                is_root: true,
                created_at: new Date()
            });
            
            // Panggil fungsi ini semula untuk paparkan data yang baru dibina
            window.muatTurunSalasilah();
            return;
        }
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const idKotak = docSnap.id;
            
            let nama = data.name || "Tiada Nama";
            let hubungan = data.relationship || "Belum Ditetapkan";
            
            const tr = document.createElement('tr');
            
            // Susun butang tindakan
            let butangTindakan = `<a onclick="window.bukaModalEdit('${idKotak}')" class="action-link">✏️ Edit</a>`;
            if (!data.is_root) { // Halang Diri Sendiri dari dipadam
                butangTindakan += `<a onclick="padamAhli('${idKotak}')" class="action-link" style="color: #e74c3c;">🗑️ Padam</a>`;
            }

            tr.innerHTML = `
                <td><strong>${nama}</strong></td>
                <td><span style="background: #e8f8f5; color: #117a65; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">${hubungan}</span></td>
                <td>${butangTindakan}</td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) { console.error("Gagal memuat turun senarai:", error); }
};

// --- 4. FUNGSI PADAM AHLI (FUNGSI BARU) ---
window.padamAhli = async (idAhli) => {
    if(confirm("Anda pasti mahu memadam rekod ahli ini?")) {
        try {
            await deleteDoc(doc(db, "mynasab_nodes", idAhli));
            window.muatTurunSalasilah(); // Refresh jadual selepas padam
        } catch (e) {
            alert("Gagal memadam ahli: " + e.message);
        }
    }
};

// --- 5. FUNGSI TAMBAH AHLI BARU (PANTAS & TANPA NOTIFIKASI MENYEMAK) ---
window.tambahAhliBaru = async (nama, hubungan, jantina, dob, telefon, bandar, negeri, failGambar, rujukanId) => {
    if (!penggunaSemasa) return;
    
    const btnSubmit = document.querySelector('#formTambahAhli button[type="submit"]');
    let teksAsalButang = "Simpan Ahli";
    
    // Kunci butang dan tukar teks secara senyap (tanpa popup alert)
    if(btnSubmit) {
        teksAsalButang = btnSubmit.innerText;
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Menyimpan..."; 
    }

    const refPengguna = doc(db, "mynasab_users", penggunaSemasa.uid);
    
    try {
        const snapPengguna = await getDoc(refPengguna);
        const bakiTerkini = parseInt(snapPengguna.data().credit_balance, 10) || 0; 
       
        let kosAhli = 0;
        let hubLower = hubungan.toLowerCase();
        
        // Pengiraan Caj Ahli
        if (hubungan === "Anak") {
            const qAnak = query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid), where("relationship", "==", "Anak"));
            const snapAnak = await getDocs(qAnak);
            if (snapAnak.size >= 5) kosAhli = 1;
        }
        else if (hubungan === "Bapa Mertua" || hubungan === "Ibu Mertua") {
            kosAhli = 5;
        }
        else if (hubLower.includes("cucu") || hubLower.includes("cicit") || hubLower.includes("piut") || hubLower.includes("cece") || hubLower.includes("oneng")) {
            kosAhli = 1; 
        }

        if (RUJUKAN[hubungan] && !rujukanId) {
            alert("Sila pilih ibu/bapa kepada siapa. Jika senarai kosong, tambah orang tu dahulu.");
            return;
        }
        
       if (rujukanId) {
            const qSama = query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid), where("ref_id", "==", rujukanId));
            const snapSama = await getDocs(qSama);
            if (snapSama.size >= 2) { alert("Orang ini sudah ada 2 ibu bapa dalam salasilah."); return; }
        }
        
        // Pengiraan Caj Gambar (Hanya jika gambar wujud dan bersaiz lebih 0)
        let kosGambar = (failGambar && failGambar.size > 0) ? 1 : 0;
        let jumlahKos = kosAhli + kosGambar;
        
        // ALERT HANYA KELUAR JIKA KREDIT TIDAK CUKUP
        if (jumlahKos > 0 && bakiTerkini < jumlahKos) {
            alert(`Baki kredit tidak mencukupi!\n\nSistem perlukan: ${jumlahKos} Kredit\n(Caj Ahli: ${kosAhli} + Caj Gambar: ${kosGambar})\n\nBaki semasa anda: ${bakiTerkini} Kredit.`);
            if(btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerText = teksAsalButang;
            }
            return; 
        }
        
        // POTONG KREDIT TERUS TANPA NOTIFIKASI (Senyap)
        if (jumlahKos > 0) {
            await updateDoc(refPengguna, { credit_balance: increment(-jumlahKos) });
            document.getElementById('creditBalance').innerText = bakiTerkini - jumlahKos;
        }

        // UPLOAD GAMBAR SECARA SENYAP (Tiada lagi alert "Sedang memuat naik...")
        let urlGambar = "";
        if (failGambar && failGambar.size > 0) {
            const storageRef = ref(storage, `profil_pictures/${penggunaSemasa.uid}_${Date.now()}_${failGambar.name}`);
            await uploadBytes(storageRef, failGambar);
            urlGambar = await getDownloadURL(storageRef);
        }
        
        // SIMPAN DATA KE DATABASE
        await addDoc(collection(db, "mynasab_nodes"), {
            owner_uid: penggunaSemasa.uid,
            name: nama,
            relationship: hubungan,
            gender: jantina,
            ref_id: rujukanId || "",
            dob: dob,
            phone: telefon,
            city: bandar,
            state: negeri,
            photo_url: urlGambar,
            is_root: false,
            created_at: new Date()
        });
        
        // Hanya satu notifikasi dihujung untuk beritahu proses selesai
        alert(`Berjaya! ${nama} direkodkan.`);
        document.getElementById('modalTambahAhli').classList.add('hidden');
        document.getElementById('formTambahAhli').reset();
        document.getElementById('groupRujukan').classList.add('hidden');
        window.muatTurunSalasilah(); 
        
    } catch (error) {
        alert("Gagal menambah data: " + error.message);
    } finally {
        // Kembalikan butang kepada asal
        if(btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = teksAsalButang;
        }
    }
};

// --- 6. FUNGSI KEMASKINI PROFIL AHLI (EDIT) ---
window.bukaModalEdit = async (idKotak) => {
    try {
        const docSnap = await getDoc(doc(db, "mynasab_nodes", idKotak));
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            document.getElementById('editAhliId').value = idKotak;
            document.getElementById('editAhliNama').value = data.name || "";
            document.getElementById('editAhliHubungan').value = data.relationship || "";
            document.getElementById('editAhliDob').value = data.dob || "";
            document.getElementById('editAhliTelefon').value = data.phone || "";
            document.getElementById('editAhliBandar').value = data.city || "";
            document.getElementById('editAhliNegeri').value = data.state || "";
            document.getElementById('editAhliJantina').value = data.gender || "";
            
            // Logik Khas: Jika ini 'Diri Sendiri', benarkan dia edit Nama Akaun Keluarga
            const groupAkaun = document.getElementById('groupEditAkaun');
            if (data.is_root) {
                groupAkaun.classList.remove('hidden');
                // Tarik nama akaun dari data pengguna (user)
                const snapPengguna = await getDoc(doc(db, "mynasab_users", penggunaSemasa.uid));
                document.getElementById('editAkaunKeluarga').value = snapPengguna.data().name || "";
            } else {
                groupAkaun.classList.add('hidden');
            }
            
            document.getElementById('modalEditAhli').classList.remove('hidden');
        }
    } catch (error) {
        alert("Gagal memuat turun data profil: " + error.message);
    }
};

// --- LOGIK EDIT AHLI (UNTUK GAMBAR) ---
const formEdit = document.getElementById('formEditAhli');
if(formEdit) {
    formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idKotak = document.getElementById('editAhliId').value;
        const groupAkaun = document.getElementById('groupEditAkaun');
        const failGambarEdit = document.getElementById('editAhliGambar').files[0];
        
        try {
            let dataUpdate = {
                name: document.getElementById('editAhliNama').value,
                dob: document.getElementById('editAhliDob').value,
                phone: document.getElementById('editAhliTelefon').value,
                city: document.getElementById('editAhliBandar').value,
                state: document.getElementById('editAhliNegeri').value,
                gender: document.getElementById('editAhliJantina').value,
                updated_at: new Date()
            };

            // JIKA DIA UPLOAD GAMBAR BARU MASA EDIT
            if (failGambarEdit) {
                const refPengguna = doc(db, "mynasab_users", penggunaSemasa.uid);
                const snapPengguna = await getDoc(refPengguna);
                const bakiTerkini = snapPengguna.data().credit_balance;
                
                if (bakiTerkini < 1) {
                    alert("Anda tiada kredit yang cukup (1 Kredit diperlukan) untuk menukar gambar.");
                    return;
                }
                
                alert("Sedang memuat naik gambar baru. Sila tunggu...");
                // Tolak 1 kredit
                await updateDoc(refPengguna, { credit_balance: increment(-1) });
                document.getElementById('creditBalance').innerText = bakiTerkini - 1;

                // Upload
                const storageRef = ref(storage, `profil_pictures/${penggunaSemasa.uid}_${Date.now()}_${failGambarEdit.name}`);
                await uploadBytes(storageRef, failGambarEdit);
                dataUpdate.photo_url = await getDownloadURL(storageRef);
            }

            // Kemas kini Nama Akaun Jika Diri Sendiri
            if (!groupAkaun.classList.contains('hidden')) {
                const namaAkaunBaru = document.getElementById('editAkaunKeluarga').value;
                await updateDoc(doc(db, "mynasab_users", penggunaSemasa.uid), { name: namaAkaunBaru });
                document.getElementById('treeNameDisplay').innerText = namaAkaunBaru; 
            }

            // Kemas kini Firestore
            await updateDoc(doc(db, "mynasab_nodes", idKotak), dataUpdate);
            
            alert("Profil berjaya dikemas kini!");
            document.getElementById('modalEditAhli').classList.add('hidden');
            window.muatTurunSalasilah(); 
            
        } catch (error) {
            alert("Gagal mengemas kini profil: " + error.message);
        }
    });
}

// --- 7. FUNGSI PREVIEW & AUTO-LAYOUT (GENERASI PENUH & UMUR) ---
window.bukaPreview = async () => {
    if (!penggunaSemasa) return;
    
    document.getElementById('modalPreview').classList.remove('hidden');
    document.getElementById('ruangAutoLayout').innerHTML = '<p>Sedang melukis pokok keturunan...</p>';
    document.getElementById('namaAkaunCetak').innerText = document.getElementById('treeNameDisplay').innerText;

    try {
        const q = query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid));
        const querySnapshot = await getDocs(q);
        
        let diriSendiri = null;
        let pasangan = [];
        let ibuBapa = [], datukNenek = [], moyang = [], buyut = [], cakawari = [], cilawagi = [];
        let mertua = [];
        let anakAnak = [], cucu = [], cicit = [], piut = [], oneng = [];

        const semuaId = new Set(querySnapshot.docs.map(s => s.id));
        
        // Agihan Baldi Generasi
        querySnapshot.forEach((docSnap) => {
            const d = { ...docSnap.data(), id: docSnap.id };
            let hub = d.relationship.toLowerCase();
            if (d.is_root) diriSendiri = d;
            else if (hub.includes("suami") || hub.includes("isteri")) pasangan.push(d);
            else if (hub === "ayah" || hub === "ibu") ibuBapa.push(d);
            else if (hub.includes("mertua")) mertua.push(d);
            else if (hub.includes("datuk") || hub.includes("nenek")) datukNenek.push(d);
            else if (hub.includes("moyang")) moyang.push(d);
            else if (hub.includes("buyut")) buyut.push(d);
            else if (hub.includes("cakawari")) cakawari.push(d);
            else if (hub.includes("cilawagi")) cilawagi.push(d);
            else if (hub === "anak") anakAnak.push(d);
            else if (hub === "cucu") cucu.push(d);
            else if (hub === "cicit") cicit.push(d);
            else if (hub.includes("piut") || hub.includes("cece")) piut.push(d);
            else if (hub.includes("oneng")) oneng.push(d);
        });

        // Pengiraan Umur Berdasarkan 2026
        const kiraUmur = (dobStr) => {
            if (!dobStr) return '';
            const tahunLahir = parseInt(dobStr.split('-')[0], 10);
            const umur = 2026 - tahunLahir;
            return `Lahir: ${tahunLahir} (${umur} thn)`;
        };

        const binaKotak = (ahli, kategory) => {
            let tema = 'theme-neutral'; 
            let hub = ahli.relationship.toLowerCase();
            
            if (ahli.gender === 'L') tema = 'theme-lelaki';
            else if (ahli.gender === 'P') tema = 'theme-perempuan';
            else if (hub.match(/ayah|suami|bapa|datuk|moyang|buyut|cakawari|cilawagi/)) tema = 'theme-lelaki';
            else if (hub.match(/ibu|isteri|nenek/)) tema = 'theme-perempuan';
            else if (kategory === 'diri' || hub.includes('anak') || hub.includes('cucu') || hub.includes('cicit') || hub.includes('piut') || hub.includes('oneng')) tema = 'theme-neutral';

            let paparanAvatar = `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            if (ahli.photo_url && ahli.photo_url !== "") {
                paparanAvatar = `<img src="${ahli.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }

            return `
                <div class="mh-card ${tema}">
                    <div class="badge-mini">${ahli.relationship}</div>
                    <div class="mh-avatar">${paparanAvatar}</div>
                    <div class="mh-details">
                        <p class="mh-name" title="${ahli.name}">${ahli.name}</p>
                        <p class="mh-info" style="font-size: 10px;">${kiraUmur(ahli.dob)}</p>
                    </div>
                </div>
            `;
        };

               // Cari ibu bapa seseorang di peringkat atas seterusnya
        // utama = orang yang dapat data lama (tiada ref_id)
        const cariIbuBapa = (ahli, levels, utama) => {
            const idx = levels.findIndex(arr => arr.length > 0);
            if (idx === -1) return { senarai: [], sisa: [] };
            const senarai = levels[idx].filter(x =>
                (x.ref_id && semuaId.has(x.ref_id)) ? x.ref_id === ahli.id : utama
            );
            return { senarai, sisa: levels.slice(idx + 1) };
        };

        const lelaki = x => x.gender
    ? x.gender === 'L'   // kalau jantina dah ditetapkan, ikut jantina
    : /ayah|bapa|datuk|suami|moyang|buyut|cakawari|cilawagi/.test(x.relationship.toLowerCase()); // data lama sahaja

        const binaTiangAtasan = (ahli, levels = [], kategoryAhli = 'neutral', utama = true) => {
            let str = `<div class="pillar">`;
            const { senarai, sisa } = cariIbuBapa(ahli, levels, utama);

            if (senarai.length > 0) {
                const bapa = senarai.find(lelaki) || senarai[0];
                const ibu = senarai.find(x => x !== bapa);

                let kelas = "couple-wrapper ancestor-couple has-children";
                if (ibu) kelas += " has-spouse";
                // Kedua-dua belah ada ibu bapa: jarakkan supaya tak bertindih
                const bapaAda = cariIbuBapa(bapa, sisa, true).senarai.length > 0;
                const ibuAda = ibu && cariIbuBapa(ibu, sisa, false).senarai.length > 0;
                if (bapaAda && ibuAda) kelas += " anc-both";

                str += `<div class="${kelas}">`;
                str += binaTiangAtasan(bapa, sisa, 'ibubapa', true);
                if (ibu) str += binaTiangAtasan(ibu, sisa, 'ibubapa', false);
                str += `</div>`;
            }

            str += binaKotak(ahli, kategoryAhli);
            str += `</div>`;
            return str;
        };

        // Fungsi Membina Keturunan Ke Bawah Secara Automatik Ikut Umur
        const renderKeturunan = (levels) => {
            let firstLevelIndex = levels.findIndex(arr => arr.length > 0);
            if (firstLevelIndex === -1) return '';
            
            let levelData = levels[firstLevelIndex];
            
            // Susun dari paling tua ke muda (kiri ke kanan)
            levelData.sort((a, b) => {
                if (!a.dob) return 1;
                if (!b.dob) return -1;
                return new Date(a.dob) - new Date(b.dob);
            });
            
            let remainingLevels = levels.slice(firstLevelIndex + 1);
            let hasLower = remainingLevels.some(arr => arr.length > 0);

            let str = `<ul>`;
            levelData.forEach((anak, index) => {
                // Cantumkan generasi bawah pada anak yang berada di tengah supaya pokok seimbang
                let showLowerHere = (index === Math.floor(levelData.length / 2)) && hasLower;
                let classW = "couple-wrapper" + (showLowerHere ? " has-children" : "");
                
                str += `<li>`;
                str += `<div class="${classW}"><div class="pillar">${binaKotak(anak, 'anak')}</div></div>`;
                if (showLowerHere) str += renderKeturunan(remainingLevels);
                str += `</li>`;
            });
            str += `</ul>`;
            return str;
        };

        let htmlLayout = '<div class="tree"><ul><li>';
        
        let senaraiKeturunan = [anakAnak, cucu, cicit, piut, oneng];
        let adaKeturunan = senaraiKeturunan.some(arr => arr.length > 0);
        let adaPasangan = pasangan.length > 0;
        
        let classWrapper = "couple-wrapper main-couple";
        if (adaPasangan) classWrapper += " has-spouse";
        if (adaKeturunan) classWrapper += " has-children";
        
        htmlLayout += `<div class="${classWrapper}">`;
        
        // --- SUSUNAN PASANGAN UTAMA (Suami sentiasa KIRI, Isteri KANAN) ---
        let mainArray = [];
        if (diriSendiri) mainArray.push(diriSendiri);
        pasangan.forEach(p => mainArray.push(p));
        
        mainArray.sort((a, b) => {
            let aLelaki = a.gender === 'L' || a.relationship.toLowerCase().match(/suami|ayah|bapa/);
            let bLelaki = b.gender === 'L' || b.relationship.toLowerCase().match(/suami|ayah|bapa/);
            if (aLelaki && !bLelaki) return -1;
            if (!aLelaki && bLelaki) return 1;
            return 0;
        });

        mainArray.forEach((p, idx) => {
            if (p.is_root) {
                // Masukkan semua senarai nenek moyang ke atas
                htmlLayout += binaTiangAtasan(p, [ibuBapa, datukNenek, moyang, buyut, cakawari, cilawagi], 'diri');
            } else {
                // Mertua: ikut ref_id; data lama pergi ke pasangan pertama
                htmlLayout += binaTiangAtasan(p, [mertua], 'pasangan', p === pasangan[0]);
            }
        });
        
        htmlLayout += `</div>`;
        
        // --- JANA CUCU CICIT PIUT ONENG (Ikut umur) ---
        if (adaKeturunan) {
            htmlLayout += renderKeturunan(senaraiKeturunan);
        }
        
        htmlLayout += `</li></ul></div>`;
        document.getElementById('ruangAutoLayout').innerHTML = htmlLayout;

    } catch (error) {
        document.getElementById('ruangAutoLayout').innerHTML = `<p style="color:red;">Gagal menjana visual: ${error.message}</p>`;
    }
};

// --- 8. SAIZ KERTAS & CETAK ---
const SAIZ_KERTAS = { A4: { w: 297, h: 210 }, A3: { w: 420, h: 297 }, A1: { w: 841, h: 594 } }; // landscape (mm)
const MM = 3.78; // 1mm ≈ 3.78px

window.tukarSaizKertas = () => {
    const saiz = document.getElementById('pilihanSaizKertas').value;
    let st = document.getElementById('stylePage');
    if (!st) {
        st = document.createElement('style');
        st.id = 'stylePage';
        document.head.appendChild(st);
    }
    st.textContent = `@page { size: ${saiz} landscape; margin: 10mm; }`;
};

window.cetakSalasilah = () => {
    window.tukarSaizKertas();

    const saiz = document.getElementById('pilihanSaizKertas').value;
    const ruang = document.getElementById('ruangAutoLayout');
    const pokok = ruang.querySelector('.tree');
    const tajuk = document.getElementById('tajukKeluargaCetak');

    // Sesuaikan pokok ikut lebar DAN tinggi kertas (besar/kecil ikut saiz kertas)
    ruang.style.zoom = 1;
    if (pokok) {
        const lebarMuat = (SAIZ_KERTAS[saiz].w - 20) * MM;
        const tinggiMuat = (SAIZ_KERTAS[saiz].h - 20) * MM - tajuk.offsetHeight - 40;
        const skala = Math.min(lebarMuat / pokok.scrollWidth, tinggiMuat / pokok.scrollHeight, 3) * 0.95;
        ruang.style.zoom = skala;
    }

    window.addEventListener('afterprint', () => { ruang.style.zoom = 1; }, { once: true });
    setTimeout(() => window.print(), 100); // bagi masa browser susun semula
};

// --- 9. DROPDOWN "IBU/BAPA KEPADA SIAPA" ---
const RUJUKAN = {
    "Datuk": ["Ayah","Ibu"], "Nenek": ["Ayah","Ibu"],
    "Moyang": ["Datuk","Nenek"], "Buyut": ["Moyang"],
    "Cakawari": ["Buyut"], "Cilawagi": ["Cakawari"],
    "Bapa Mertua": ["Isteri","Suami"], "Ibu Mertua": ["Isteri","Suami"]
};

window.siapkanRujukan = async (hubungan) => {
    const kumpulan = document.getElementById('groupRujukan');
    const sel = document.getElementById('tambahRujukan');
    const sasaran = RUJUKAN[hubungan];
    if (!sasaran || !penggunaSemasa) { kumpulan.classList.add('hidden'); sel.innerHTML = ''; return; }

    const snap = await getDocs(query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid)));
    const pilihan = snap.docs.filter(s => sasaran.includes(s.data().relationship));
    sel.innerHTML = pilihan.length
        ? pilihan.map(s => `<option value="${s.id}">${s.data().name} (${s.data().relationship})</option>`).join('')
        : `<option value="">-- Tambah ${sasaran[0]} dahulu --</option>`;
    kumpulan.classList.remove('hidden');
};

// --- 10. JEMPUT ADIK-BERADIK ---
window.bukaJemput = async () => {
    const snap = await getDocs(query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid)));
    const calon = snap.docs.filter(s => s.data().is_root || /suami|isteri/i.test(s.data().relationship));
    document.getElementById('jemputSasaran').innerHTML =
        calon.map(s => `<option value="${s.id}">Adik-beradik ${s.data().name}</option>`).join('');
    document.getElementById('hasilPautan').classList.add('hidden');
    document.getElementById('modalJemput').classList.remove('hidden');
};

window.janaPautan = async () => {
    const sel = document.getElementById('jemputSasaran');
    if (!sel.value) return;
    const kod = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await setDoc(doc(db, "mynasab_invites", kod), {
        owner_uid: penggunaSemasa.uid,
        sasaran_id: sel.value,
        nama_sasaran: sel.options[sel.selectedIndex].text.replace('Adik-beradik ', ''),
        nama_pengundang: document.getElementById('treeNameDisplay').innerText,
        created_at: new Date()
    });
    document.getElementById('inputPautan').value = `${location.origin}${location.pathname}?jemput=${kod}`;
    document.getElementById('hasilPautan').classList.remove('hidden');
};

window.salinPautan = () => {
    navigator.clipboard.writeText(document.getElementById('inputPautan').value);
    alert("Pautan disalin!");
};
