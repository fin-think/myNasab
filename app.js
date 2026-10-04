// ==========================================
// app.js - Logik Teras FamiliPintar (VERSI 4 - DASHBOARD)
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
let penggunaSemasa = null;

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

window.daftarPengguna = async (emel, kataLaluan, namaKeluarga) => {
    try {
        const kredensial = await createUserWithEmailAndPassword(auth, emel, kataLaluan);
        const user = kredensial.user;

        await setDoc(doc(db, "mynasab_users", user.uid), {
            name: namaKeluarga,
            email: emel,
            credit_balance: 10,
            created_at: new Date()
        });

        // Cipta Diri Sendiri (Root) secara automatik dalam database
        await setDoc(doc(db, "mynasab_nodes", "root_" + user.uid), {
            owner_uid: user.uid,
            name: namaKeluarga,
            relationship: "Diri Sendiri (Induk)",
            is_root: true,
            created_at: new Date()
        });

        alert("Pendaftaran berjaya! Anda menerima 10 Kredit Kotak percuma.");
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

// --- 5. FUNGSI TAMBAH AHLI BARU (DENGAN LOGIK KREDIT) ---
window.tambahAhliBaru = async (nama, hubungan, dob, telefon, bandar, negeri) => {
    if (!penggunaSemasa) return;
    const refPengguna = doc(db, "mynasab_users", penggunaSemasa.uid);
    
    try {
        const snapPengguna = await getDoc(refPengguna);
        const bakiTerkini = snapPengguna.data().credit_balance;
        
        let kosKredit = 0;
        if (hubungan === "Anak") kosKredit = 1;
        if (hubungan === "Bapa Mertua" || hubungan === "Ibu Mertua") kosKredit = 5;
        
        if (bakiTerkini < kosKredit) {
            alert(`Baki kredit tidak mencukupi! Anda perlukan ${kosKredit} kredit. Sila tambah nilai.`);
            return;
        }
        
        if (kosKredit > 0) {
            await updateDoc(refPengguna, { credit_balance: increment(-kosKredit) });
            document.getElementById('creditBalance').innerText = bakiTerkini - kosKredit;
        }
        
        await addDoc(collection(db, "mynasab_nodes"), {
            owner_uid: penggunaSemasa.uid,
            name: nama,
            relationship: hubungan,
            dob: dob,
            phone: telefon,
            city: bandar,
            state: negeri,
            is_root: false,
            created_at: new Date()
        });
        
        alert(`${nama} berjaya ditambah!`);
        document.getElementById('modalTambahAhli').classList.add('hidden');
        document.getElementById('formTambahAhli').reset();
        window.muatTurunSalasilah(); 
        
    } catch (error) {
        alert("Gagal menambah ahli: " + error.message);
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

const formEdit = document.getElementById('formEditAhli');
if(formEdit) {
    formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idKotak = document.getElementById('editAhliId').value;
        const groupAkaun = document.getElementById('groupEditAkaun');
        
        try {
            // Jika Diri Sendiri diedit, kita kemas kini Nama Akaun Keluarga di database berasingan
            if (!groupAkaun.classList.contains('hidden')) {
                const namaAkaunBaru = document.getElementById('editAkaunKeluarga').value;
                await updateDoc(doc(db, "mynasab_users", penggunaSemasa.uid), {
                    name: namaAkaunBaru
                });
                document.getElementById('treeNameDisplay').innerText = namaAkaunBaru; // Kemaskini nama di atas penjuru kanan
            }

            // Kemas kini data Individu
            await updateDoc(doc(db, "mynasab_nodes", idKotak), {
                name: document.getElementById('editAhliNama').value,
                dob: document.getElementById('editAhliDob').value,
                phone: document.getElementById('editAhliTelefon').value,
                city: document.getElementById('editAhliBandar').value,
                state: document.getElementById('editAhliNegeri').value,
                updated_at: new Date()
            });
            
            alert("Profil berjaya dikemas kini!");
            document.getElementById('modalEditAhli').classList.add('hidden');
            window.muatTurunSalasilah(); 
            
        } catch (error) {
            alert("Gagal mengemas kini profil: " + error.message);
        }
    });
}

// --- 7. FUNGSI PREVIEW & AUTO-LAYOUT (PREMIUM) ---
window.bukaPreview = async () => {
    if (!penggunaSemasa) return;
    
    document.getElementById('modalPreview').classList.remove('hidden');
    document.getElementById('ruangAutoLayout').innerHTML = '<p>Sedang melukis pokok salasilah...</p>';
    document.getElementById('namaAkaunCetak').innerText = document.getElementById('treeNameDisplay').innerText;

    try {
        const q = query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid));
        const querySnapshot = await getDocs(q);
        
        let diriSendiri = null;
        let pasangan = [];
        let ibuBapa = [];
        let anakAnak = [];

        // 1. Kategorikan Data
        querySnapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.is_root) diriSendiri = d;
            else if (d.relationship === "Suami" || d.relationship === "Isteri") pasangan.push(d);
            else if (d.relationship === "Ayah" || d.relationship === "Ibu" || d.relationship === "Bapa Mertua" || d.relationship === "Ibu Mertua") ibuBapa.push(d);
            else if (d.relationship === "Anak") anakAnak.push(d);
        });

        // 2. Pembina Kad Premium
        const binaKotak = (ahli, tema) => {
            let infoEkstra = '';
            if (ahli.dob) infoEkstra += `<p>🎂 ${ahli.dob}</p>`;
            if (ahli.phone) infoEkstra += `<p>📞 ${ahli.phone}</p>`;
            if (ahli.city || ahli.state) infoEkstra += `<p>📍 ${ahli.city || ''} ${ahli.state || ''}</p>`;

            return `
                <div class="node-card-premium theme-${tema}">
                    <span class="badge">${ahli.relationship}</span>
                    <h4>${ahli.name}</h4>
                    ${infoEkstra}
                </div>
            `;
        };

        // 3. Logik CSS Tree HTML
        let htmlLayout = '<div class="tree"><ul>';

        const renderDiriDanAnak = () => {
            let str = `<li>`;
            
            // Cantumkan Diri Sendiri & Pasangan dengan garisan putus-putus (dashed)
            const jumlahPasangan = pasangan.length + (diriSendiri ? 1 : 0);
            const classCouple = jumlahPasangan > 1 ? "couple-box connected" : "couple-box";
            
            str += `<div class="${classCouple}">`;
            if (diriSendiri) str += binaKotak(diriSendiri, 'diri');
            pasangan.forEach(p => str += binaKotak(p, 'pasangan'));
            str += `</div>`;
            
            // Jika ada anak, buka cawangan baharu di bawah mereka
            if (anakAnak.length > 0) {
                str += `<ul>`;
                anakAnak.forEach(anak => {
                    str += `<li>${binaKotak(anak, 'anak')}</li>`;
                });
                str += `</ul>`;
            }
            str += `</li>`;
            return str;
        }

        // Jika Ibu Bapa wujud, mereka adalah Akar (Root) utama
        if (ibuBapa.length > 0) {
            htmlLayout += `<li>`;
            const classCoupleIbuBapa = ibuBapa.length > 1 ? "couple-box connected" : "couple-box";
            htmlLayout += `<div class="${classCoupleIbuBapa}">`;
            ibuBapa.forEach(ib => htmlLayout += binaKotak(ib, 'ibubapa'));
            htmlLayout += `</div>`;
            
            htmlLayout += `<ul>`;
            htmlLayout += renderDiriDanAnak(); // Masukkan keluarga anda di bawah Ibu Bapa
            htmlLayout += `</ul>`;
            htmlLayout += `</li>`;
        } else {
            // Jika tiada Ibu Bapa, anda adalah Akar (Root) utama
            htmlLayout += renderDiriDanAnak();
        }

        htmlLayout += '</ul></div>';
        
        // Paparkan ke skrin
        document.getElementById('ruangAutoLayout').innerHTML = htmlLayout;

    } catch (error) {
        document.getElementById('ruangAutoLayout').innerHTML = `<p style="color:red;">Gagal menjana visual: ${error.message}</p>`;
    }
};

// Fungsi Print & Format Saiz Kertas
window.tukarSaizKertas = () => {
    const saiz = document.getElementById('pilihanSaizKertas').value;
    let styleCetak = document.getElementById('gayaCetakDinamik');
    if (!styleCetak) {
        styleCetak = document.createElement('style');
        styleCetak.id = 'gayaCetakDinamik';
        document.head.appendChild(styleCetak);
    }
    styleCetak.innerHTML = `@page { size: ${saiz} landscape; margin: 10mm; }`;
};

window.cetakSalasilah = () => {
    window.tukarSaizKertas(); 
    window.print(); 
};

