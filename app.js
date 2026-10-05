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
            gender: jantina,
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

// --- 5. FUNGSI TAMBAH AHLI BARU (ANTI-DOUBLE CLICK) ---
window.tambahAhliBaru = async (nama, hubungan, dob, telefon, bandar, negeri, failGambar) => {
    if (!penggunaSemasa) return;
    
    // Kunci butang supaya pengguna tak tertekan banyak kali (punca notis pelik)
    const btnSubmit = document.querySelector('#formTambahAhli button[type="submit"]');
    if(btnSubmit) btnSubmit.disabled = true;

    const refPengguna = doc(db, "mynasab_users", penggunaSemasa.uid);
    
    try {
        const snapPengguna = await getDoc(refPengguna);
        const bakiTerkini = parseInt(snapPengguna.data().credit_balance, 10) || 0; 
        
        let kosAhli = 0;
        
        if (hubungan === "Anak") {
            const qAnak = query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid), where("relationship", "==", "Anak"));
            const snapAnak = await getDocs(qAnak);
            if (snapAnak.size >= 5) kosAhli = 1;
        }
        else if (hubungan === "Bapa Mertua" || hubungan === "Ibu Mertua") {
            kosAhli = 5;
        }
        
        let kosGambar = failGambar ? 1 : 0;
        let jumlahKos = kosAhli + kosGambar;
        
        if (bakiTerkini < jumlahKos) {
            alert(`Baki kredit anda tidak mencukupi!\n\n• Caj Tambah Ahli: ${kosAhli} Kredit\n• Caj Muat Naik Gambar: ${kosGambar} Kredit\n• Jumlah Diperlukan: ${jumlahKos} Kredit\n\nBaki Kredit Anda: ${bakiTerkini} Kredit\nSila tambah nilai kredit anda.`);
            if(btnSubmit) btnSubmit.disabled = false;
            return; // Hentikan fungsi terus di sini
        }
        
        if (jumlahKos > 0) {
            await updateDoc(refPengguna, { credit_balance: increment(-jumlahKos) });
            document.getElementById('creditBalance').innerText = bakiTerkini - jumlahKos;
        }

        let urlGambar = "";
        if (failGambar) {
            const storageRef = ref(storage, `profil_pictures/${penggunaSemasa.uid}_${Date.now()}_${failGambar.name}`);
            await uploadBytes(storageRef, failGambar);
            urlGambar = await getDownloadURL(storageRef);
        }
        
        await addDoc(collection(db, "mynasab_nodes"), {
            owner_uid: penggunaSemasa.uid,
            name: nama,
            relationship: hubungan,
            dob: dob,
            phone: telefon,
            city: bandar,
            state: negeri,
            photo_url: urlGambar,
            is_root: false,
            created_at: new Date()
        });
        
        alert(`Berjaya! ${nama} telah ditambah ke dalam salasilah.`);
        document.getElementById('modalTambahAhli').classList.add('hidden');
        document.getElementById('formTambahAhli').reset();
        window.muatTurunSalasilah(); 
        
    } catch (error) {
        alert("Gagal menambah data: " + error.message);
    } finally {
        // Buka balik kunci butang selepas proses tamat
        if(btnSubmit) btnSubmit.disabled = false;
    }
};

// --- 7. FUNGSI PREVIEW & AUTO-LAYOUT (LOGIK POLIGAMI) ---
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
        let mertua = [];
        let datukNenek = [];

        querySnapshot.forEach((docSnap) => {
            const d = docSnap.data();
            let hub = d.relationship.toLowerCase();
            if (d.is_root) diriSendiri = d;
            else if (hub.includes("suami") || hub.includes("isteri")) pasangan.push(d);
            else if (hub === "ayah" || hub === "ibu") ibuBapa.push(d);
            else if (hub.includes("mertua")) mertua.push(d);
            else if (hub.includes("datuk") || hub.includes("nenek")) datukNenek.push(d);
            else if (hub.includes("anak")) anakAnak.push(d);
        });

        const binaKotak = (ahli, kategory) => {
            let tema = 'theme-neutral'; 
            let hub = ahli.relationship.toLowerCase();
            
            if (ahli.gender === 'L') tema = 'theme-lelaki';
            else if (ahli.gender === 'P') tema = 'theme-perempuan';
            else if (hub.includes('ayah') || hub.includes('suami') || hub.includes('bapa') || hub.includes('datuk')) tema = 'theme-lelaki';
            else if (hub.includes('ibu') || hub.includes('isteri') || hub.includes('nenek')) tema = 'theme-perempuan';
            else if (kategory === 'diri' || hub.includes('anak')) tema = 'theme-neutral';

            let infoTahun = ahli.dob ? `Lahir: ${ahli.dob.split('-')[0]}` : '';
            
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
                        <p class="mh-info">${infoTahun}</p>
                    </div>
                </div>
            `;
        };

        const binaTiang = (ahli, senaraiIbubapa = [], kategoryAhli = 'neutral', senaraiDatukNenek = []) => {
            let str = `<div class="pillar">`;
            
            if (senaraiIbubapa.length > 0) {
                let classIbuBapa = "couple-wrapper has-children";
                if (senaraiIbubapa.length > 1) classIbuBapa += " has-spouse";
                
                str += `<div class="${classIbuBapa}">`;
                
                let bapa = senaraiIbubapa.find(ib => ib.relationship.toLowerCase().match(/ayah|bapa/)) || senaraiIbubapa[0];
                let ibu = senaraiIbubapa.find(ib => ib !== bapa);
                
                str += binaTiang(bapa, senaraiDatukNenek, 'ibubapa', []); 
                if (ibu) str += binaTiang(ibu, [], 'ibubapa', []);
                
                str += `</div>`;
            }
            
            str += binaKotak(ahli, kategoryAhli);
            str += `</div>`;
            return str;
        };

        let htmlLayout = '<div class="tree"><ul><li>';
        
        let adaAnak = anakAnak.length > 0;
        let adaPasangan = pasangan.length > 0;
        
        let classWrapper = "couple-wrapper";
        if (adaPasangan) classWrapper += " has-spouse";
        if (adaAnak) classWrapper += " has-children";
        
        htmlLayout += `<div class="${classWrapper}">`;
        
        // 1. Tiang Diri Sendiri 
        if (diriSendiri) {
            htmlLayout += binaTiang(diriSendiri, ibuBapa, 'diri', datukNenek);
        }
        
        // 2. Tiang Pasangan (Isu Poligami Diselesaikan Di Sini)
        if (adaPasangan) {
            pasangan.forEach((p, index) => {
                // Berikan mertua kepada isteri PERTAMA sahaja. Isteri kedua akan dapat tiang kosong di atasnya.
                let mertuaIsteriIni = (index === 0) ? mertua : [];
                htmlLayout += binaTiang(p, mertuaIsteriIni, 'pasangan', []);
            });
        }
        
        htmlLayout += `</div>`;
        
        // 3. Senarai Anak-anak
        if (adaAnak) {
            htmlLayout += `<ul>`;
            anakAnak.forEach(anak => {
                htmlLayout += `<li><div class="couple-wrapper">${binaTiang(anak, [], 'anak', [])}</div></li>`;
            });
            htmlLayout += `</ul>`;
        }
        
        htmlLayout += `</li></ul></div>`;
        document.getElementById('ruangAutoLayout').innerHTML = htmlLayout;

    } catch (error) {
        document.getElementById('ruangAutoLayout').innerHTML = `<p style="color:red;">Gagal menjana visual: ${error.message}</p>`;
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

// --- 7. FUNGSI PREVIEW & AUTO-LAYOUT (FIX JARAK PASANGAN & ATUK NENEK) ---
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
        let mertua = [];
        let datukNenek = [];

        querySnapshot.forEach((docSnap) => {
            const d = docSnap.data();
            let hub = d.relationship.toLowerCase();
            if (d.is_root) diriSendiri = d;
            else if (hub.includes("suami") || hub.includes("isteri")) pasangan.push(d);
            else if (hub === "ayah" || hub === "ibu") ibuBapa.push(d);
            else if (hub.includes("mertua")) mertua.push(d);
            else if (hub.includes("datuk") || hub.includes("nenek")) datukNenek.push(d);
            else if (hub.includes("anak")) anakAnak.push(d);
        });

        const binaKotak = (ahli, kategory) => {
            let tema = 'theme-neutral'; 
            let hub = ahli.relationship.toLowerCase();
            
            if (ahli.gender === 'L') tema = 'theme-lelaki';
            else if (ahli.gender === 'P') tema = 'theme-perempuan';
            else if (hub.includes('ayah') || hub.includes('suami') || hub.includes('bapa') || hub.includes('datuk')) tema = 'theme-lelaki';
            else if (hub.includes('ibu') || hub.includes('isteri') || hub.includes('nenek')) tema = 'theme-perempuan';
            else if (kategory === 'diri' || hub.includes('anak')) tema = 'theme-neutral';

            let infoTahun = ahli.dob ? `Lahir: ${ahli.dob.split('-')[0]}` : '';
            
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
                        <p class="mh-info">${infoTahun}</p>
                    </div>
                </div>
            `;
        };

        // FUNGSI BINA TIANG (DIKEMASKINI UNTUK ELAK TOLAK PASANGAN)
        const binaTiang = (ahli, senaraiIbubapa = [], kategoryAhli = 'neutral', senaraiDatukNenek = []) => {
            let str = `<div class="pillar" style="position: relative;">`;
            
            if (senaraiIbubapa.length > 0) {
                let classIbuBapa = "couple-wrapper has-children";
                if (senaraiIbubapa.length > 1) classIbuBapa += " has-spouse";
                
                // Tambah position: absolute supaya atuk/nenek terapung dan tak tolak kotak isteri di bawah!
                str += `<div class="${classIbuBapa}" style="position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); padding-bottom: 25px; z-index: 10;">`;
                
                let bapa = senaraiIbubapa.find(ib => ib.relationship.toLowerCase().match(/ayah|bapa/)) || senaraiIbubapa[0];
                let ibu = senaraiIbubapa.find(ib => ib !== bapa);
                
                str += binaTiang(bapa, senaraiDatukNenek, 'ibubapa', []); 
                if (ibu) str += binaTiang(ibu, [], 'ibubapa', []);
                
                str += `</div>`;
            }
            
            str += binaKotak(ahli, kategoryAhli);
            str += `</div>`;
            return str;
        };

        // TAMBAH padding-top: 130px supaya kotak atuk/nenek tak terpotong kat atas skrin
        let htmlLayout = '<div class="tree" style="padding-top: 130px;"><ul><li>';
        
        let adaAnak = anakAnak.length > 0;
        let adaPasangan = pasangan.length > 0;
        
        let classWrapper = "couple-wrapper";
        if (adaPasangan) classWrapper += " has-spouse";
        if (adaAnak) classWrapper += " has-children";
        
        htmlLayout += `<div class="${classWrapper}">`;
        
        // 1. Tiang Diri Sendiri 
        if (diriSendiri) {
            htmlLayout += binaTiang(diriSendiri, ibuBapa, 'diri', datukNenek);
        }
        
        // 2. Tiang Pasangan 
        if (adaPasangan) {
            pasangan.forEach((p, index) => {
                let mertuaIsteriIni = (index === 0) ? mertua : [];
                htmlLayout += binaTiang(p, mertuaIsteriIni, 'pasangan', []);
            });
        }
        
        htmlLayout += `</div>`;
        
        // 3. Senarai Anak-anak
        if (adaAnak) {
            htmlLayout += `<ul>`;
            anakAnak.forEach(anak => {
                htmlLayout += `<li><div class="couple-wrapper">${binaTiang(anak, [], 'anak', [])}</div></li>`;
            });
            htmlLayout += `</ul>`;
        }
        
        htmlLayout += `</li></ul></div>`;
        document.getElementById('ruangAutoLayout').innerHTML = htmlLayout;

    } catch (error) {
        document.getElementById('ruangAutoLayout').innerHTML = `<p style="color:red;">Gagal menjana visual: ${error.message}</p>`;
    }
};
