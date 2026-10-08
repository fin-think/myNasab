// ==========================================
// app.js - Logik Teras FamiliPintar (VERSI 5 - DIBETULKAN)
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, arrayUnion, arrayRemove, collection, addDoc, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
const storage = getStorage(app);
let penggunaSemasa = null;

// --- BANTU: escape teks (elak skrip berniat jahat) ---
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// --- BANTU: teks "Lahir" / "Meninggal dunia" pada kad ---
const infoLahir = (a) => {
    if (a.status === 'meninggal') return 'Meninggal dunia';
    if (!a.dob) return '';
    const t = parseInt(a.dob.split('-')[0], 10);
    return `Lahir: ${t} (${new Date().getFullYear() - t} thn)`;
};

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

        const welcomeElement = document.getElementById('welcomeScreen');
        if (welcomeElement) welcomeElement.style.display = 'none';

        const authModalElement = document.getElementById('authModal');
        if (authModalElement) authModalElement.style.display = 'none';

        const dashboardUtama = document.getElementById('dashboardUtama');
        if (dashboardUtama) dashboardUtama.classList.remove('hidden');

        const refPengguna = doc(db, "mynasab_users", user.uid);
        const snapPengguna = await getDoc(refPengguna);

        if (snapPengguna.exists()) {
            const dataPengguna = snapPengguna.data();
            document.getElementById('creditBalance').innerText = dataPengguna.credit_balance;
            document.getElementById('treeNameDisplay').innerText = dataPengguna.name;
            window.muatTurunSalasilah();
            window.muatMenunggu();   // kad "Menunggu Kelulusan" untuk akaun induk
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
    if (kodJemput && !jemputan) {
        alert("Pautan jemputan tidak sah atau belum siap dimuatkan. Cuba lagi sebentar.");
        return;
    }
    const jem = jemputan;
    const kreditAwal = jem ? 5 : 10;

    try {
        const kredensial = await createUserWithEmailAndPassword(auth, emel, kataLaluan);
        const user = kredensial.user;

        await setDoc(doc(db, "mynasab_users", user.uid), {
            name: namaKeluarga,
            email: emel,
            credit_balance: kreditAwal,
            pdpa: { setuju: true, tarikh: new Date(), versi: "1.0" },
            created_at: new Date()
        });

        await setDoc(doc(db, "mynasab_nodes", "root_" + user.uid), {
            owner_uid: user.uid,
            name: namaKeluarga,
            relationship: "Diri Sendiri (Induk)",
            gender: jantina,
            is_root: true,
            ...(jem ? { sibling_of: jem.sasaran_id, link_owner: jem.owner_uid } : {}),
            created_at: new Date()
        });

        if (jem) {
            await setDoc(doc(db, "mynasab_links", user.uid), {
                uid: user.uid,
                owner_uid: jem.owner_uid,
                sasaran_id: jem.sasaran_id,
                kod: kodJemput,
                status: 'menunggu',
                nama: namaKeluarga,
                created_at: new Date()
            });
        }

        alert(jem
            ? `Pendaftaran berjaya! Anda menerima ${kreditAwal} Kredit. Pautan keluarga anda menunggu kelulusan ${jem.nama_pengundang}.`
            : `Pendaftaran berjaya! Anda menerima ${kreditAwal} Kredit percuma.`);
        location.href = location.pathname;
    } catch (error) {
        alert("Ralat pendaftaran: " + error.message);
    }
};

window.logKeluar = async () => {
    try {
        await signOut(auth);
        location.href = "https://familipintar.com";
    } catch (error) {
        alert("Gagal log keluar: " + error.message);
    }
};

// --- 3. FUNGSI MUAT TURUN DATA KE JADUAL DASHBOARD ---
window.muatTurunSalasilah = async () => {
    if (!penggunaSemasa) return;
    try {
        const q = query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid));
        const querySnapshot = await getDocs(q);
        
        const tbody = document.getElementById('senaraiAhliTbody'); 
        if (tbody) tbody.innerHTML = ''; 
        
        // --- TAMBAHAN BARU: Kumpul Data Global & Bina Dropdown Faraid ---
        window.dataAhliFaraid = []; 
        let htmlPilihan = `<option value="root">Diri Sendiri (Induk)</option>`;
        
        // AUTO-PEMULIHAN: Jika jadual kosong
        if (querySnapshot.empty) {
            const namaPenuh = document.getElementById('treeNameDisplay').innerText || "Ketua Keluarga";
            await setDoc(doc(db, "mynasab_nodes", "root_" + penggunaSemasa.uid), {
                owner_uid: penggunaSemasa.uid,
                name: namaPenuh,
                relationship: "Diri Sendiri (Induk)",
                is_root: true,
                created_at: new Date()
            });
            window.muatTurunSalasilah();
            return;
        }
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id; // Simpan ID
            
            window.dataAhliFaraid.push(data); // Masukkan ke senarai Faraid
            
            let rel = (data.relationship || '').toLowerCase();
            
            // Masukkan Pasangan, Ibubapa, dan Mertua ke dalam Dropdown
            if(rel === 'isteri' || rel === 'suami' || rel === 'ayah' || rel === 'ibu' || rel.includes('mertua')) {
                htmlPilihan += `<option value="${data.id}">${data.name} (${data.relationship})</option>`;
            }
            
            // --- BINA JADUAL (KOD SEDIA ADA) ---
            let nama = data.name || "Tiada Nama";
            let hubungan = data.relationship || "Belum Ditetapkan";
            let jantina = data.gender === 'L' ? 'Lelaki' : (data.gender === 'P' ? 'Perempuan' : '-');
            let telefon = data.phone || '-';
            
            let lokasi = [data.city, data.state].filter(Boolean).join(', ') || '-';
            
            // Kira Umur (Automatik ikut tahun semasa. Jika tiada DOB = Meninggal Dunia)
            let paparanUmur = '<span style="color: #e74c3c; font-weight: bold; font-size: 11px; background: #fadbd8; padding: 3px 6px; border-radius: 6px; white-space: nowrap;">Meninggal dunia</span>';
            
            if (data.dob && data.dob.trim() !== '') {
                const tahunLahir = parseInt(data.dob.split('-')[0], 10);
                const tahunSemasa = new Date().getFullYear(); // Sistem kesan tahun secara automatik (cth: 2026, 2027...)
                const umur = tahunSemasa - tahunLahir;
                paparanUmur = `${data.dob} <br><small style="color:#7f8c8d; font-weight:bold;">(${umur} tahun)</small>`;
            }

            let gambarMini = data.photo_url
                ? `<img src="${data.photo_url}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid #bdc3c7;">` 
                : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #ecf0f1; display: flex; justify-content: center; align-items: center; font-size: 16px; border: 1px solid #bdc3c7;">👤</div>`;
            
            const tr = document.createElement('tr');
            let butangTindakan = `<a onclick="window.bukaModalEdit('${data.id}')" class="action-link">✏️ Edit</a>`;
            if (!data.is_root) { 
                butangTindakan += `<a onclick="padamAhli('${data.id}')" class="action-link" style="color: #e74c3c; margin-left: 10px;">🗑️ Padam</a>`;
            }

            tr.innerHTML = `
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${gambarMini}
                        <strong style="color: #2c3e50;">${nama}</strong>
                    </div>
                </td>
                <td><span style="background: #e8f8f5; color: #117a65; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; white-space: nowrap;">${hubungan}</span></td>
                <td style="color: #576574;">${jantina}</td>
                <td style="color: #576574; font-size: 13px;">${paparanUmur}</td>
                <td style="color: #576574; font-size: 13px;">${telefon}</td>
                <td style="color: #576574; font-size: 13px;">${lokasi}</td>
                <td style="white-space: nowrap;">${butangTindakan}</td>
            `;
            if(tbody) tbody.appendChild(tr);
        });
        
        // --- KEMAS KINI DROPDOWN & PANGGIL ENJIN FARAID ---
        const dropdownFaraid = document.getElementById('pilihanMatiFaraid');
        if(dropdownFaraid) {
            let nilaiSemasa = dropdownFaraid.value; 
            dropdownFaraid.innerHTML = htmlPilihan;
            if(htmlPilihan.includes(`value="${nilaiSemasa}"`)) dropdownFaraid.value = nilaiSemasa; 
        }
        
        if(window.jalankanFaraid) window.jalankanFaraid();
        
    } catch (error) { console.error("Gagal memuat turun senarai:", error); }
};

// --- 4. PADAM AHLI ---
window.padamAhli = async (idAhli) => {
    if (confirm("Anda pasti mahu memadam rekod ahli ini?")) {
        try {
            await deleteDoc(doc(db, "mynasab_nodes", idAhli));
            window.muatTurunSalasilah();
        } catch (e) {
            alert("Gagal memadam ahli: " + e.message);
        }
    }
};

// --- 5. TAMBAH AHLI BARU ---
window.tambahAhliBaru = async (nama, hubungan, jantina, dob, telefon, bandar, negeri, failGambar, rujukanId, status = 'hidup') => {
    if (!penggunaSemasa) return;

    const sPautanSaya = await getDoc(doc(db, "mynasab_links", penggunaSemasa.uid));
    if (sPautanSaya.exists() && ["Ayah","Ibu","Datuk","Nenek","Moyang","Buyut","Cakawari","Cilawagi"].includes(hubungan)) {
        alert("Ibu bapa dan leluhur diambil daripada pokok pengundang, jadi tidak perlu ditambah di sini.");
        return;
    }

    const btnSubmit = document.querySelector('#formTambahAhli button[type="submit"]');
    let teksAsalButang = "Simpan Ahli";

    if (btnSubmit) {
        teksAsalButang = btnSubmit.innerText;
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Menyimpan...";
    }

    const refPengguna = doc(db, "mynasab_users", penggunaSemasa.uid);

    try {
        const snapPengguna = await getDoc(refPengguna);
        const bakiTerkini = parseInt(snapPengguna.data().credit_balance, 10) || 0;

        let kosAhli = 0;
        const hubLower = hubungan.toLowerCase();

        if (hubungan === "Anak") {
            const qAnak = query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid), where("relationship", "==", "Anak"));
            const snapAnak = await getDocs(qAnak);
            if (snapAnak.size >= 5) kosAhli = 1;
        }
        else if (hubungan === "Bapa Mertua" || hubungan === "Ibu Mertua") {
            kosAhli = 5;
        }
        else if (hubLower.includes("cucu") || hubLower.includes("cicit") || hubLower.includes("piut") || hubLower.includes("cece") || hubLower.includes("oneng") || hubLower.includes("menantu")) {
            kosAhli = 1;
        }

        if (RUJUKAN[hubungan] && !rujukanId) {
            alert("Sila pilih ibu/bapa (atau pasangan) kepada siapa. Jika senarai kosong, tambah orang tu dahulu.");
            return;
        }

        // Had 2 ibu bapa — TIDAK terpakai untuk Menantu / Pasangan Cucu
        const adalahPasanganKeturunan = (hubungan === "Menantu" || hubungan === "Pasangan Cucu");
        if (rujukanId && !adalahPasanganKeturunan) {
            const qSama = query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid), where("ref_id", "==", rujukanId));
            const snapSama = await getDocs(qSama);
            if (snapSama.size >= 2) { alert("Orang ini sudah ada 2 ibu bapa dalam salasilah."); return; }
        }

        const kosGambar = (failGambar && failGambar.size > 0) ? 1 : 0;
        const jumlahKos = kosAhli + kosGambar;

        if (jumlahKos > 0 && bakiTerkini < jumlahKos) {
            alert(`Baki kredit tidak mencukupi!\n\nSistem perlukan: ${jumlahKos} Kredit\n(Caj Ahli: ${kosAhli} + Caj Gambar: ${kosGambar})\n\nBaki semasa anda: ${bakiTerkini} Kredit.`);
            return;
        }

        let urlGambar = "";
        if (failGambar && failGambar.size > 0) {
            const storageRef = ref(storage, `profil_pictures/${penggunaSemasa.uid}_${Date.now()}_${failGambar.name}`);
            await uploadBytes(storageRef, failGambar);
            urlGambar = await getDownloadURL(storageRef);
        }

        await addDoc(collection(db, "mynasab_nodes"), {
            owner_uid: penggunaSemasa.uid,
            name: nama,
            relationship: hubungan,
            gender: jantina,
            ref_id: rujukanId || "",
            dob: status === 'meninggal' ? '' : dob,
            status: status,
            phone: telefon,
            city: bandar,
            state: negeri,
            photo_url: urlGambar,
            is_root: false,
            created_at: new Date()
        });

        if (jumlahKos > 0) {
            await updateDoc(refPengguna, { credit_balance: increment(-jumlahKos) });
            document.getElementById('creditBalance').innerText = bakiTerkini - jumlahKos;
        }

        alert(`Berjaya! ${nama} direkodkan.`);
        document.getElementById('modalTambahAhli').classList.add('hidden');
        document.getElementById('formTambahAhli').reset();
        document.getElementById('groupRujukan').classList.add('hidden');
        window.muatTurunSalasilah();

    } catch (error) {
        alert("Gagal menambah data: " + error.message);
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = teksAsalButang;
        }
    }
};

// --- 6. KEMASKINI PROFIL AHLI (EDIT) ---
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

            const radioStatus = document.querySelector(`input[name="editStatus"][value="${data.status === 'meninggal' ? 'meninggal' : 'hidup'}"]`);
            if (radioStatus) radioStatus.checked = true;
            if (window.tukarStatus) window.tukarStatus('edit');

            const groupAkaun = document.getElementById('groupEditAkaun');
            if (data.is_root) {
                groupAkaun.classList.remove('hidden');
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
if (formEdit) {
    formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idKotak = document.getElementById('editAhliId').value;
        const groupAkaun = document.getElementById('groupEditAkaun');
        const failGambarEdit = document.getElementById('editAhliGambar').files[0];
        const radioTerpilih = document.querySelector('input[name="editStatus"]:checked');

        try {
            let dataUpdate = {
                name: document.getElementById('editAhliNama').value,
                dob: document.getElementById('editAhliDob').value,
                phone: document.getElementById('editAhliTelefon').value,
                city: document.getElementById('editAhliBandar').value,
                state: document.getElementById('editAhliNegeri').value,
                gender: document.getElementById('editAhliJantina').value,
                status: radioTerpilih ? radioTerpilih.value : 'hidup',
                updated_at: new Date()
            };

            if (failGambarEdit) {
                const refPengguna = doc(db, "mynasab_users", penggunaSemasa.uid);
                const snapPengguna = await getDoc(refPengguna);
                const bakiTerkini = snapPengguna.data().credit_balance;

                if (bakiTerkini < 1) {
                    alert("Anda tiada kredit yang cukup (1 Kredit diperlukan) untuk menukar gambar.");
                    return;
                }

                alert("Sedang memuat naik gambar baru. Sila tunggu...");
                await updateDoc(refPengguna, { credit_balance: increment(-1) });
                document.getElementById('creditBalance').innerText = bakiTerkini - 1;

                const storageRef = ref(storage, `profil_pictures/${penggunaSemasa.uid}_${Date.now()}_${failGambarEdit.name}`);
                await uploadBytes(storageRef, failGambarEdit);
                dataUpdate.photo_url = await getDownloadURL(storageRef);
            }

            if (!groupAkaun.classList.contains('hidden')) {
                const namaAkaunBaru = document.getElementById('editAkaunKeluarga').value;
                await updateDoc(doc(db, "mynasab_users", penggunaSemasa.uid), { name: namaAkaunBaru });
                document.getElementById('treeNameDisplay').innerText = namaAkaunBaru;
            }

            await updateDoc(doc(db, "mynasab_nodes", idKotak), dataUpdate);

            alert("Profil berjaya dikemas kini!");
            document.getElementById('modalEditAhli').classList.add('hidden');
            window.muatTurunSalasilah();

        } catch (error) {
            alert("Gagal mengemas kini profil: " + error.message);
        }
    });
}

// --- 7. PREVIEW "KELUARGA SAYA" ---
window.bukaPreview = async () => {
    if (!penggunaSemasa) return;

    const pp = document.getElementById('pilihanPaparan'); if (pp) pp.value = 'saya';

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
        let menantuKeturunan = [];

        const semuaId = new Set(querySnapshot.docs.map(s => s.id));

        querySnapshot.forEach((docSnap) => {
            const d = { ...docSnap.data(), id: docSnap.id };
            const hub = (d.relationship || '').toLowerCase();
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
            else if (hub.includes("menantu") || hub.includes("pasangan cucu")) menantuKeturunan.push(d);
        });

        const binaKotak = (ahli, kategory) => {
            let tema = 'theme-neutral';
            const hub = (ahli.relationship || '').toLowerCase();

            if (ahli.gender === 'L') tema = 'theme-lelaki';
            else if (ahli.gender === 'P') tema = 'theme-perempuan';
            else if (hub.match(/ayah|suami|bapa|datuk|moyang|buyut|cakawari|cilawagi/)) tema = 'theme-lelaki';
            else if (hub.match(/ibu|isteri|nenek/)) tema = 'theme-perempuan';

            let paparanAvatar = `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            if (ahli.photo_url && ahli.photo_url !== "") {
                paparanAvatar = `<img src="${esc(ahli.photo_url)}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }

            return `
                <div class="mh-card ${tema}">
                    <div class="badge-mini">${esc(ahli.relationship)}</div>
                    <div class="mh-avatar">${paparanAvatar}</div>
                    <div class="mh-details">
                        <p class="mh-name" title="${esc(ahli.name)}">${esc(ahli.name)}</p>
                        <p class="mh-info" style="font-size: 10px;">${infoLahir(ahli)}</p>
                    </div>
                </div>
            `;
        };

        const cariIbuBapa = (ahli, levels, utama) => {
            const idx = levels.findIndex(arr => arr.length > 0);
            if (idx === -1) return { senarai: [], sisa: [] };
            const senarai = levels[idx].filter(x =>
                (x.ref_id && semuaId.has(x.ref_id)) ? x.ref_id === ahli.id : utama
            );
            return { senarai, sisa: levels.slice(idx + 1) };
        };

        const lelaki = x => x.gender
            ? x.gender === 'L'
            : /ayah|bapa|datuk|suami|moyang|buyut|cakawari|cilawagi/.test((x.relationship || '').toLowerCase());

        const binaTiangAtasan = (ahli, levels = [], kategoryAhli = 'neutral', utama = true) => {
            let str = `<div class="pillar">`;
            const { senarai, sisa } = cariIbuBapa(ahli, levels, utama);

            if (senarai.length > 0) {
                const bapa = senarai.find(lelaki) || senarai[0];
                const ibu = senarai.find(x => x !== bapa);

                let kelas = "couple-wrapper ancestor-couple has-children";
                if (ibu) kelas += " has-spouse";
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

        const renderKeturunan = (levels) => {
            const firstLevelIndex = levels.findIndex(arr => arr.length > 0);
            if (firstLevelIndex === -1) return '';

            const levelData = levels[firstLevelIndex];

            levelData.sort((a, b) => {
                if (!a.dob) return 1;
                if (!b.dob) return -1;
                return new Date(a.dob) - new Date(b.dob);
            });

            const remainingLevels = levels.slice(firstLevelIndex + 1);
            const hasLower = remainingLevels.some(arr => arr.length > 0);

            let str = `<ul>`;
            levelData.forEach((anak, index) => {
                const showLowerHere = (index === Math.floor(levelData.length / 2)) && hasLower;

                const pasanganAnakIni = menantuKeturunan.filter(m => m.ref_id === anak.id);

                let classW = "couple-wrapper" + (showLowerHere ? " has-children" : "");
                if (pasanganAnakIni.length > 0) classW += " has-spouse";

                // Lelaki kiri, perempuan kanan
                const gabung = [anak, ...pasanganAnakIni].sort((a, b) => (b.gender === 'L') - (a.gender === 'L'));

                let htmlKumpulan = '';
                gabung.forEach(p => htmlKumpulan += `<div class="pillar">${binaKotak(p, 'anak')}</div>`);

                str += `<li>`;
                str += `<div class="${classW}">${htmlKumpulan}</div>`;
                if (showLowerHere) str += renderKeturunan(remainingLevels);
                str += `</li>`;
            });
            str += `</ul>`;
            return str;
        };

        let htmlLayout = '<div class="tree"><ul><li>';

        const senaraiKeturunan = [anakAnak, cucu, cicit, piut, oneng];
        const adaKeturunan = senaraiKeturunan.some(arr => arr.length > 0);
        const adaPasangan = pasangan.length > 0;

        let classWrapper = "couple-wrapper main-couple";
        if (adaPasangan) classWrapper += " has-spouse";
        if (adaKeturunan) classWrapper += " has-children";

        htmlLayout += `<div class="${classWrapper}">`;

        const mainArray = [];
        if (diriSendiri) mainArray.push(diriSendiri);
        pasangan.forEach(p => mainArray.push(p));

        mainArray.sort((a, b) => {
            const aLelaki = a.gender === 'L' || (a.relationship || '').toLowerCase().match(/suami|ayah|bapa/);
            const bLelaki = b.gender === 'L' || (b.relationship || '').toLowerCase().match(/suami|ayah|bapa/);
            if (aLelaki && !bLelaki) return -1;
            if (!aLelaki && bLelaki) return 1;
            return 0;
        });

        mainArray.forEach((p) => {
            if (p.is_root) {
                htmlLayout += binaTiangAtasan(p, [ibuBapa, datukNenek, moyang, buyut, cakawari, cilawagi], 'diri');
            } else {
                htmlLayout += binaTiangAtasan(p, [mertua], 'pasangan', p === pasangan[0]);
            }
        });

        htmlLayout += `</div>`;

        if (adaKeturunan) {
            htmlLayout += renderKeturunan(senaraiKeturunan);
        }

        htmlLayout += `</li></ul></div>`;
        document.getElementById('ruangAutoLayout').innerHTML = htmlLayout;
        window.autoMuat();   // SELEPAS pokok dilukis

    } catch (error) {
        document.getElementById('ruangAutoLayout').innerHTML = `<p style="color:red;">Gagal menjana visual: ${esc(error.message)}</p>`;
    }
};

// --- 8. SAIZ KERTAS & CETAK ---
const SAIZ_KERTAS = { A4: { w: 297, h: 210 }, A3: { w: 420, h: 297 }, A1: { w: 841, h: 594 } };
const MM = 3.78;

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

    ruang.style.zoom = 1;
    if (pokok) {
        const lebarMuat = (SAIZ_KERTAS[saiz].w - 20) * MM;
        const tinggiMuat = (SAIZ_KERTAS[saiz].h - 20) * MM - tajuk.offsetHeight - 40;
        const skala = Math.min(lebarMuat / pokok.scrollWidth, tinggiMuat / pokok.scrollHeight, 3) * 0.95;
        ruang.style.zoom = skala;
    }

    window.addEventListener('afterprint', () => { ruang.style.zoom = zoomSemasa; }, { once: true });
    setTimeout(() => window.print(), 100);
};

// --- 9. DROPDOWN "IBU/BAPA KEPADA SIAPA" (+ PASANGAN ANAK/CUCU) ---
const RUJUKAN = {
    "Datuk": ["Ayah","Ibu"], "Nenek": ["Ayah","Ibu"],
    "Moyang": ["Datuk","Nenek"], "Buyut": ["Moyang"],
    "Cakawari": ["Buyut"], "Cilawagi": ["Cakawari"],
    "Bapa Mertua": ["Isteri","Suami"], "Ibu Mertua": ["Isteri","Suami"],
    "Menantu": ["Anak"], "Pasangan Cucu": ["Cucu"]
};

window.siapkanRujukan = async (hubungan) => {
    const kumpulan = document.getElementById('groupRujukan');
    const sel = document.getElementById('tambahRujukan');
    const labelRujukan = kumpulan.querySelector('label');
    const sasaran = RUJUKAN[hubungan];

    if (!sasaran || !penggunaSemasa) { kumpulan.classList.add('hidden'); sel.innerHTML = ''; return; }

    if (hubungan === "Menantu" || hubungan === "Pasangan Cucu") {
        labelRujukan.innerText = `Suami/Isteri kepada ${sasaran[0]} yang mana?`;
    } else {
        labelRujukan.innerText = `Ibu/bapa kepada siapa?`;
    }

    const snap = await getDocs(query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid)));
    const pilihan = snap.docs.filter(s => sasaran.includes(s.data().relationship));
    sel.innerHTML = pilihan.length
        ? pilihan.map(s => `<option value="${esc(s.id)}">${esc(s.data().name)} (${esc(s.data().relationship)})</option>`).join('')
        : `<option value="">-- Tambah ${esc(sasaran[0])} dahulu --</option>`;
    kumpulan.classList.remove('hidden');
};

// Serasi dengan pengendali lama dalam index.html (jika masih digunakan)
window.muatSenaraiRujukan = async (hubungan) => {
    if (!penggunaSemasa) return [];
    const snap = await getDocs(query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid)));
    return snap.docs
        .filter(s => s.data().relationship === hubungan)
        .map(s => ({ id: s.id, name: s.data().name }));
};

// --- 10. JEMPUT ADIK-BERADIK ---
window.bukaJemput = async () => {
    const snap = await getDocs(query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid)));
    const calon = snap.docs.filter(s => s.data().is_root || /suami|isteri/i.test(s.data().relationship));
    document.getElementById('jemputSasaran').innerHTML =
        calon.map(s => `<option value="${esc(s.id)}">Adik-beradik ${esc(s.data().name)}</option>`).join('');
    document.getElementById('hasilPautan').classList.add('hidden');
    window.muatMenunggu();
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

window.muatMenunggu = async () => {
    if (!penggunaSemasa) return;
    const elModal = document.getElementById('senaraiMenunggu');
    const elKad = document.getElementById('senaraiMenungguKad');
    const kad = document.getElementById('kadMenunggu');
    const lencana = document.getElementById('lencanaMenunggu');
    try {
        const s = await getDocs(query(collection(db, "mynasab_links"),
            where("owner_uid", "==", penggunaSemasa.uid), where("status", "==", "menunggu")));

        const baris = s.docs.map(d => `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid #eee;">
                <strong style="font-size:14px;">${esc(d.data().nama)}</strong>
                <span style="white-space:nowrap;">
                    <button type="button" onclick="window.luluskanPautan('${esc(d.id)}')" style="background:#27ae60; color:#fff; border:none; border-radius:5px; padding:5px 12px; cursor:pointer;">Terima</button>
                    <button type="button" onclick="window.tolakPautan('${esc(d.id)}')" style="background:#e74c3c; color:#fff; border:none; border-radius:5px; padding:5px 12px; cursor:pointer;">Tolak</button>
                </span>
            </div>`).join('');

        if (elKad) elKad.innerHTML = baris;
        if (elModal) elModal.innerHTML = s.empty ? '' :
            '<p style="font-weight:bold; color:#d35400; margin:0 0 6px;">Menunggu kelulusan:</p>' + baris;
        if (kad) kad.classList.toggle('hidden', s.empty);
        if (lencana) { lencana.textContent = s.size; lencana.classList.toggle('hidden', s.empty); }
    } catch (e) { console.warn("Gagal muat senarai menunggu:", e.message); }
};

window.luluskanPautan = async (uid) => {
    try {
        await updateDoc(doc(db, "mynasab_links", uid), { status: 'aktif' });
        alert("Adik-beradik diterima. Mereka kini boleh dilihat dalam Keluarga Besar.");
    } catch (e) { alert("Gagal meluluskan: " + e.message); }
    window.muatMenunggu();
};

window.tolakPautan = async (uid) => {
    if (!confirm("Tolak permohonan ini?")) return;
    try { await deleteDoc(doc(db, "mynasab_links", uid)); }
    catch (e) { alert("Gagal menolak: " + e.message); }
    window.muatMenunggu();
};

// --- 11. POKOK BESAR (KELUARGA DIPAUTKAN) ---
window.tukarPaparan = (kekal = false) => {
    kekalZoom = (kekal === true);
    const v = document.getElementById('pilihanPaparan').value;
    if (v === 'saya') return window.bukaPreview();
    window.bukaPreviewBesar(v.replace('besar_', ''));
};

window.sembunyiAkaun = async (uid) => {
    await updateDoc(doc(db, "mynasab_users", penggunaSemasa.uid), { sembunyi: arrayUnion(uid) });
    window.tukarPaparan(true);
};
window.paparAkaun = async (uid) => {
    await updateDoc(doc(db, "mynasab_users", penggunaSemasa.uid), { sembunyi: arrayRemove(uid) });
    window.tukarPaparan(true);
};

window.bukaPreviewBesar = async (mod = 'semua') => {
    if (!penggunaSemasa) return;
    const saya = penggunaSemasa.uid;
    const ruang = document.getElementById('ruangAutoLayout');
    document.getElementById('modalPreview').classList.remove('hidden');
    ruang.innerHTML = '<p>Sedang melukis pokok keluarga besar...</p>';
    document.getElementById('namaAkaunCetak').innerText = document.getElementById('treeNameDisplay').innerText;

    try {
        // 1. Induk = akaun yang menjemput (kalau saya bukan adik, induk = saya)
        const sLinkSaya = await getDoc(doc(db, "mynasab_links", saya));
        if (sLinkSaya.exists() && sLinkSaya.data().status !== 'aktif') {
            ruang.innerHTML = '<p>Pautan keluarga anda masih menunggu kelulusan pengundang.</p>';
            return;
        }
        const indukUid = sLinkSaya.exists() ? sLinkSaya.data().owner_uid : saya;
        const sayaInduk = indukUid === saya;

        // 2. Akaun yang dipautkan kepada induk + senarai sembunyi saya
        const sPautan = await getDocs(query(collection(db, "mynasab_links"),
            where("owner_uid", "==", indukUid), where("status", "==", "aktif")));
        const pautan = sPautan.docs.map(d => d.data());
        const sUser = await getDoc(doc(db, "mynasab_users", saya));
        const sembunyi = (sUser.exists() && sUser.data().sembunyi) || [];

        // 3. Muat nod
        const ambil = async (uid) => {
            try {
                const s = await getDocs(query(collection(db, "mynasab_nodes"), where("owner_uid", "==", uid)));
                return s.docs.map(d => ({ ...d.data(), id: d.id }));
            } catch (e) { console.warn("Tak dapat baca nod", uid, e.message); return []; }
        };
        const nodInduk = await ambil(indukUid);
        const akaun = await Promise.all(pautan.map(async p => ({ uid: p.uid, sasaran: p.sasaran_id, nod: await ambil(p.uid) })));

        const kelompok = (nod) => {
            const k = { diri: null, pasangan: [], menantu: [], ibuBapa: [], datukNenek: [], moyang: [], buyut: [], cakawari: [], cilawagi: [], mertua: [], turun: [[], [], [], [], []] };
            nod.forEach(d => {
                const h = (d.relationship || '').toLowerCase();
                if (d.is_root) k.diri = d;
                else if (h.includes('suami') || h.includes('isteri')) k.pasangan.push(d);
                else if (h.includes('menantu') || h.includes('pasangan cucu')) k.menantu.push(d);
                else if (h === 'ayah' || h === 'ibu') k.ibuBapa.push(d);
                else if (h.includes('mertua')) k.mertua.push(d);
                else if (h.includes('datuk') || h.includes('nenek')) k.datukNenek.push(d);
                else if (h.includes('moyang')) k.moyang.push(d);
                else if (h.includes('buyut')) k.buyut.push(d);
                else if (h.includes('cakawari')) k.cakawari.push(d);
                else if (h.includes('cilawagi')) k.cilawagi.push(d);
                else if (h === 'anak') k.turun[0].push(d);
                else if (h === 'cucu') k.turun[1].push(d);
                else if (h === 'cicit') k.turun[2].push(d);
                else if (h.includes('piut') || h.includes('cece')) k.turun[3].push(d);
                else if (h.includes('oneng')) k.turun[4].push(d);
            });
            return k;
        };

        const k0 = kelompok(nodInduk);
        if (!k0.diri) { ruang.innerHTML = '<p>Data akaun induk tidak dijumpai.</p>'; return; }
        const indukRootId = k0.diri.id;
        const semuaId = new Set(nodInduk.map(n => n.id));
        const sasaranUid = {};
        akaun.forEach(a => { sasaranUid[a.uid] = a.sasaran; });

        // --- Label kad ikut sudut pandang saya ---
        const label = (n) => {
            const h = n.relationship || '';
            if (n.is_root) {
                if (n.owner_uid === saya) return 'Diri Sendiri';
                if (n.owner_uid === indukUid) return 'Adik-beradik';
                return sasaranUid[n.owner_uid] === indukRootId ? 'Adik-beradik' : (sayaInduk ? 'Ipar' : 'Keluarga');
            }
            if (n.owner_uid !== saya) {
                if (/suami|isteri/i.test(h)) return 'Ipar';
                if (h === 'Anak') return 'Anak saudara';
                if (h === 'Cucu') return 'Cucu saudara';
                if (h === 'Cicit') return 'Cicit saudara';
                if (h === 'Menantu') return 'Ipar';
            }
            return h;
        };

        const SVG = `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

        const binaKotak = (a, butangSembunyi = false) => {
            const h = (a.relationship || '').toLowerCase();
            let tema = 'theme-neutral';
            if (a.gender === 'L') tema = 'theme-lelaki';
            else if (a.gender === 'P') tema = 'theme-perempuan';
            else if (/ayah|suami|bapa|datuk|moyang|buyut|cakawari|cilawagi/.test(h)) tema = 'theme-lelaki';
            else if (/ibu|isteri|nenek/.test(h)) tema = 'theme-perempuan';
            const avatar = a.photo_url ? `<img src="${esc(a.photo_url)}" style="width:100%;height:100%;object-fit:cover;">` : SVG;
            const btn = butangSembunyi
                ? `<button class="btn-sembunyi" title="Sembunyikan keluarga ini" onclick="window.sembunyiAkaun('${esc(a.owner_uid)}')">✕</button>` : '';
            return `<div class="mh-card ${tema}">${btn}<div class="badge-mini">${esc(label(a))}</div>
                <div class="mh-avatar">${avatar}</div>
                <div class="mh-details"><p class="mh-name" title="${esc(a.name)}">${esc(a.name)}</p>
                <p class="mh-info" style="font-size:10px;">${infoLahir(a)}</p></div></div>`;
        };

        // --- Leluhur ke atas ---
        const lelaki = x => x.gender ? x.gender === 'L'
            : /ayah|bapa|datuk|suami|moyang|buyut|cakawari|cilawagi/.test((x.relationship || '').toLowerCase());
        const jantinaL = x => x.gender ? x.gender === 'L' : /suami|ayah|bapa/.test((x.relationship || '').toLowerCase());
        const susunKiri = (arr) => [...arr].sort((a, b) => (jantinaL(b) ? 1 : 0) - (jantinaL(a) ? 1 : 0));

        const cariIbuBapa = (ahli, levels, utama) => {
            const idx = levels.findIndex(arr => arr.length > 0);
            if (idx === -1) return { senarai: [], sisa: [] };
            const senarai = levels[idx].filter(x => (x.ref_id && semuaId.has(x.ref_id)) ? x.ref_id === ahli.id : utama);
            return { senarai, sisa: levels.slice(idx + 1) };
        };

        const binaTiangAtasan = (ahli, levels = [], utama = true) => {
            let s = '<div class="pillar">';
            const { senarai, sisa } = cariIbuBapa(ahli, levels, utama);
            if (senarai.length) {
                const bapa = senarai.find(lelaki) || senarai[0];
                const ibu = senarai.find(x => x !== bapa);
                let kelas = 'couple-wrapper ancestor-couple has-children';
                if (ibu) kelas += ' has-spouse';
                if (ibu && cariIbuBapa(bapa, sisa, true).senarai.length && cariIbuBapa(ibu, sisa, false).senarai.length) kelas += ' anc-both';
                s += `<div class="${kelas}">${binaTiangAtasan(bapa, sisa, true)}${ibu ? binaTiangAtasan(ibu, sisa, false) : ''}</div>`;
            }
            return s + binaKotak(ahli) + '</div>';
        };

        const binaIbuBapaAtas = (senarai, sisa) => {
            const bapa = senarai.find(lelaki) || senarai[0];
            const ibu = senarai.find(x => x !== bapa);
            const bAda = cariIbuBapa(bapa, sisa, true).senarai.length > 0;
            const iAda = ibu && cariIbuBapa(ibu, sisa, false).senarai.length > 0;
            const kelas = 'couple-wrapper main-couple induk-atas has-children' + (ibu ? ' has-spouse' : '') + (bAda && iAda ? ' anc-both' : '');
            return `<div class="${kelas}">${binaTiangAtasan(bapa, sisa, true)}${ibu ? binaTiangAtasan(ibu, sisa, false) : ''}</div>`;
        };

        // --- Keturunan ke bawah (dengan pasangan anak/cucu) ---
        const renderKeturunan = (levels, menantu = []) => {
            const idx = levels.findIndex(a => a.length > 0);
            if (idx === -1) return '';
            const data = levels[idx].sort((a, b) => !a.dob ? 1 : !b.dob ? -1 : new Date(a.dob) - new Date(b.dob));
            const sisa = levels.slice(idx + 1);
            const adaBawah = sisa.some(a => a.length > 0);
            let s = '<ul>';
            data.forEach((n, i) => {
                const bawah = (i === Math.floor(data.length / 2)) && adaBawah;
                const psg = menantu.filter(m => m.ref_id === n.id);
                const orang = [n, ...psg].sort((a, b) => (b.gender === 'L') - (a.gender === 'L'));
                const kelas = 'couple-wrapper' + (psg.length ? ' has-spouse' : '') + (bawah ? ' has-children' : '');
                s += `<li><div class="${kelas}">${orang.map(p => `<div class="pillar">${binaKotak(p)}</div>`).join('')}</div>${bawah ? renderKeturunan(sisa, menantu) : ''}</li>`;
            });
            return s + '</ul>';
        };

        // --- Satu isi rumah: pasangan sebaris + anak di bawah ---
        const binaRumah = (k, orang, bolehSembunyi) => {
            const adaAnak = k.turun.some(a => a.length);
            const kelas = 'couple-wrapper main-couple' + (orang.length > 1 ? ' has-spouse' : '') + (adaAnak ? ' has-children' : '');
            let s = `<div class="${kelas}">`;
            orang.forEach(p => { s += `<div class="pillar">${binaKotak(p, bolehSembunyi && p.is_root)}</div>`; });
            s += '</div>';
            if (adaAnak) s += renderKeturunan(k.turun.map(a => [...a]), k.menantu);
            return s;
        };

        // --- Satu sisi (belah): ibu bapa → adik-beradik sebaris ---
        const tarikh = (n) => n && n.dob ? new Date(n.dob).getTime() : Infinity;
        const hiddenList = [];

        const binaSisi = (judul, jangkar, ibuBapa, sisa, sasaranId) => {
            const entri = [{ t: tarikh(jangkar.penentu), html: binaRumah(jangkar.k, jangkar.orang, false) }];
            akaun.filter(a => a.sasaran === sasaranId).forEach(a => {
                const k = kelompok(a.nod);
                if (!k.diri) return;
                if (sembunyi.includes(a.uid)) { hiddenList.push({ uid: a.uid, nama: k.diri.name }); return; }
                entri.push({ t: tarikh(k.diri), html: binaRumah(k, susunKiri([k.diri, ...k.pasangan]), a.uid !== saya) });
            });
            entri.sort((x, y) => x.t - y.t);

            let isi;
            if (ibuBapa.length) {
                isi = `<ul><li>${binaIbuBapaAtas(ibuBapa, sisa)}<ul>${entri.map(e => `<li>${e.html}</li>`).join('')}</ul></li></ul>`;
            } else {
                isi = `<div style="display:flex; gap:60px; align-items:flex-start;">${entri.map(e => `<ul><li>${e.html}</li></ul>`).join('')}</div>`;
            }
            return { ada: ibuBapa.length > 0 || entri.length > 1, judul, isi };
        };

        // --- Susun mengikut pilihan paparan ---
        const sisi = [];
        if (mod === 'saya' || mod === 'semua') {
            const { senarai, sisa } = cariIbuBapa(k0.diri, [k0.ibuBapa, k0.datukNenek, k0.moyang, k0.buyut, k0.cakawari, k0.cilawagi], true);
            sisi.push(binaSisi('Belah ' + k0.diri.name,
                { k: k0, orang: susunKiri([k0.diri, ...k0.pasangan]), penentu: k0.diri }, senarai, sisa, indukRootId));
        }
        if (mod === 'pasangan' || mod === 'semua') {
            k0.pasangan.forEach((p, i) => {
                const { senarai } = cariIbuBapa(p, [k0.mertua], i === 0);
                const s = binaSisi('Belah ' + p.name,
                    { k: k0, orang: susunKiri([p, k0.diri]), penentu: p }, senarai, [], p.id);
                if (s.ada) sisi.push(s);
            });
        }
        if (!sisi.length) {
            ruang.innerHTML = '<p>Belum ada maklumat belah pasangan. Tambah Bapa/Ibu Mertua atau jemput adik-beradik pasangan.</p>';
            return;
        }

        const tunjukJudul = sisi.length > 1;
        const bar = hiddenList.length
            ? `<div class="bar-sembunyi">Disembunyikan: ${hiddenList.map(h => `${esc(h.nama)} <button onclick="window.paparAkaun('${esc(h.uid)}')">Papar</button>`).join(' ')}</div>` : '';
        ruang.innerHTML = `<div class="tree pokok-besar">${sisi.map(s =>
            `<div class="sisi-pokok">${tunjukJudul ? `<h3 class="judul-belah">${esc(s.judul)}</h3>` : ''}${s.isi}</div>`).join('')}</div>${bar}`;
        window.autoMuat();   // SELEPAS pokok dilukis

    } catch (error) {
        ruang.innerHTML = `<p style="color:red;">Gagal menjana pokok besar: ${esc(error.message)}</p>`;
    }
};

// --- 12. ZOOM POKOK ---
let zoomSemasa = 1;
let kekalZoom = false;
const ZOOM_MIN = 0.15, ZOOM_MAX = 2.5;

const terapZoom = (z) => {
    zoomSemasa = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    document.getElementById('ruangAutoLayout').style.zoom = zoomSemasa;
    document.getElementById('labelZoom').innerText = Math.round(zoomSemasa * 100) + '%';
};

window.zoomMasuk = () => terapZoom(zoomSemasa * 1.2);
window.zoomKeluar = () => terapZoom(zoomSemasa / 1.2);

// Muat lebar skrin (tak pernah membesarkan melebihi 100%)
window.autoMuat = (paksa = false) => {
    if (kekalZoom && paksa !== true) { kekalZoom = false; terapZoom(zoomSemasa); return; }
    kekalZoom = false;
    const ruang = document.getElementById('ruangAutoLayout');
    const pokok = ruang.querySelector('.tree');
    if (!pokok) return;
    ruang.style.zoom = 1;
    const lebarSedia = document.getElementById('kertasCetak').clientWidth - 80;
    terapZoom(Math.min(1, lebarSedia / pokok.scrollWidth));
};

// Ctrl + roda tetikus = zoom
document.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const kertas = document.getElementById('kertasCetak');
    if (!kertas || !kertas.contains(e.target)) return;
    e.preventDefault();
    terapZoom(zoomSemasa * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
}, { passive: false });


// ==========================================
// 11.5 ENJIN PENUKARAN IDENTITI (PIVOT KELUARGA) - DIBETULKAN
// ==========================================
window.jalankanFaraid = () => {
    if (!window.dataAhliFaraid || window.dataAhliFaraid.length === 0) return;
    
    let targetId = document.getElementById('pilihanMatiFaraid').value;
    let docsData = window.dataAhliFaraid;
    let mappedData = []; 
    
    // Jika Diri Sendiri dipilih, hantar data asal terus ke kalkulator
    if (targetId === 'root' || targetId === '') {
        window.kiraFaraidAuto(docsData);
        return;
    } 
    
    let target = docsData.find(d => d.id === targetId);
    if (!target) return;
    
    let targetRel = (target.relationship || '').toLowerCase();
    
    docsData.forEach(d => {
        let dRel = (d.relationship || '').toLowerCase();
        
        if (d.id === targetId) {
            // Mangsa / Si Mati yang dipilih dijadikan Induk
            mappedData.push({ ...d, is_root: true, relationship: 'Diri Sendiri' });
        } else {
            let newRel = '';
            
            // --- JIKA SI MATI ADALAH PASANGAN (ISTERI / SUAMI) ---
            if (targetRel === 'isteri' || targetRel === 'suami') {
                if (d.is_root) newRel = targetRel === 'isteri' ? 'Suami' : 'Isteri';
                // FIX: Semua Anak, Cucu, Cicit kepada Diri Sendiri juga dianggap keturunan kepada Pasangan
                else if (dRel === 'anak' || dRel === 'cucu' || dRel === 'cicit') newRel = dRel === 'anak' ? 'Anak' : (dRel === 'cucu' ? 'Cucu' : 'Cicit'); 
                else if (dRel.includes('mertua')) newRel = dRel.includes('bapa') ? 'Bapa' : 'Ibu'; // Mertua bos adalah ibubapa pasangan
            }
            // --- JIKA SI MATI ADALAH IBU ATAU BAPA ---
            else if (targetRel === 'ayah' || targetRel === 'ibu') {
                if (d.is_root) newRel = 'Anak'; // Diri Sendiri jadi Anak
                else if (targetRel === 'ayah' && dRel === 'ibu') newRel = 'Isteri';
                else if (targetRel === 'ibu' && dRel === 'ayah') newRel = 'Suami';
                else if (dRel === 'datuk') newRel = 'Bapa';
                else if (dRel === 'nenek') newRel = 'Ibu';
                else if (dRel.includes('adik') || dRel.includes('abang') || dRel.includes('kakak')) newRel = 'Anak'; // Adik beradik bos adalah Anak kepada ibu bapa bos
            }
            // --- JIKA SI MATI ADALAH MERTUA ---
            else if (targetRel.includes('mertua')) {
                if (dRel === 'isteri' || dRel === 'suami') newRel = 'Anak'; // Pasangan bos adalah Anak kepada mertua
                else if (targetRel === 'bapa mertua' && dRel === 'ibu mertua') newRel = 'Isteri';
                else if (targetRel === 'ibu mertua' && dRel === 'bapa mertua') newRel = 'Suami';
            }
            
            // Jika hubungan baru berjaya dikenal pasti, masukkan ke senarai
            if (newRel !== '') {
                mappedData.push({ ...d, is_root: false, relationship: newRel });
            }
        }
    });
    
    // Hantar data yang telah "diterjemah" ke Enjin Faraid Pintar
    window.kiraFaraidAuto(mappedData);
};

// ==========================================
// 12. ENJIN FARAID PINTAR (OTOMATIS - 100% LOGIK AQMS)
// ==========================================
window.kiraFaraidAuto = (docs) => {
    let isteriCount = 0, suamiCount = 0;
    let bapa = 0, ibu = 0, datuk = 0, nenek = 0;
    let al = 0, ap = 0;
    let adikLelaki = 0, adikPerempuan = 0; // Tambahan untuk Waris Kedua
    let jantinaInduk = 'L'; // Asumsi Default Lelaki

    // 1. Imbas seluruh senarai keluarga dari database
   // 1. Imbas seluruh senarai keluarga dari database
    docs.forEach(d => {
        // A: Jika ini adalah si mati (Induk), dapatkan jantinanya. Si mati bukan penerima!
        if (d.is_root) { 
            jantinaInduk = d.gender || 'L'; 
            return; // Berhenti di sini untuk orang ini, teruskan ke orang seterusnya
        }
        
        // B: HALANG WARIS MENINGGAL DUNIA (Jika tiada DOB, anggap mati dan GUGUR Faraid)
        if (!d.dob || d.dob.trim() === '') {
            return; // Berhenti di sini, dia takkan dikira dalam isteriCount, bapa, dll
        }

        let rel = (d.relationship || '').toLowerCase();
        let gen = d.gender;

        if (rel === 'isteri') isteriCount++;
        else if (rel === 'suami') suamiCount++;
        else if (rel === 'ayah' || rel === 'bapa') bapa = 1;
        else if (rel === 'ibu') ibu = 1;
        else if (rel.includes('datuk')) datuk = 1;
        else if (rel.includes('nenek')) nenek++;
        else if (rel === 'anak') {
            if (gen === 'L') al++;
            else if (gen === 'P') ap++;
        }
        else if (rel.includes('adik') || rel.includes('abang') || rel.includes('kakak')) {
            if (gen === 'L') adikLelaki++;
            else if (gen === 'P') adikPerempuan++;
        }
    });

    // Halang logik bercanggah dengan jantina Diri Sendiri
    if (jantinaInduk === 'P') isteriCount = 0;
    if (jantinaInduk === 'L') suamiCount = 0;

    const hasChild = (al + ap) > 0;
    const hasSiblings = (adikLelaki + adikPerempuan) >= 2;
    let results = [];
    let BASE = 24;
    let sumFardu = 0;

    // 2. PENGIRAAN FARDU
    if (isteriCount > 0) {
        results.push({ name: isteriCount > 1 ? `${isteriCount} Isteri` : 'Isteri', share: hasChild ? 3 : 6, type: 'Fardu', color: '#1abc9c' });
    }
    if (suamiCount > 0) {
        results.push({ name: 'Suami', share: hasChild ? 6 : 12, type: 'Fardu', color: '#1abc9c' });
    }
    if (ibu > 0) {
        let ibuShare = (hasChild || hasSiblings) ? 4 : 8; // 1/6 atau 1/3
        results.push({ name: 'Ibu', share: ibuShare, type: 'Fardu', color: '#3498db' });
    } else if (nenek > 0) {
        results.push({ name: 'Nenek', share: 4, type: 'Waris Ganti (Ibu)', color: '#2980b9' });
    }
    if (bapa > 0) {
        results.push({ name: 'Bapa', share: 4, type: 'Fardu', color: '#2563eb' });
    } else if (datuk > 0) {
        results.push({ name: 'Datuk', share: 4, type: 'Waris Ganti (Bapa)', color: '#818cf8' });
    }

    sumFardu = results.reduce((acc, r) => acc + r.share, 0);
    let remaining = BASE - sumFardu;

    // AUL (Penyebut meningkat jika jumlah fardu melebihi asalnya)
    if (remaining < 0) {
        results.forEach(r => { r.base = sumFardu; });
        remaining = 0;
        BASE = sumFardu;
    } else {
        results.forEach(r => { r.base = BASE; });
    }

    // 3. PENGIRAAN ASABAH (ANAK-ANAK)
    if (al > 0 || ap > 0) {
        if (al === 0) {
            // Hanya anak perempuan (Fardu)
            let share = ap === 1 ? 12 : 16;
            if (remaining < share) {
                sumFardu += share;
                results.push({ name: ap > 1 ? `${ap} Anak Perempuan` : 'Anak Perempuan', share: share, base: sumFardu, type: 'Fardu', color: '#ec4899' });
                results.forEach(r => r.base = sumFardu);
                BASE = sumFardu;
                remaining = 0;
            } else {
                results.push({ name: ap > 1 ? `${ap} Anak Perempuan` : 'Anak Perempuan', share: share, base: BASE, type: 'Fardu', color: '#ec4899' });
                remaining -= share;
            }
        } else {
            // Asabah Bil Ghayr (Lelaki : Perempuan = 2 : 1)
            let totalParts = (al * 2) + ap;
            if (remaining > 0 && totalParts > 0) {
                let shareAL = (remaining * (al * 2)) / totalParts;
                let shareAP = (remaining * ap) / totalParts;
                if (al > 0) results.push({ name: al > 1 ? `${al} Anak Lelaki` : 'Anak Lelaki', share: shareAL, base: BASE, type: 'Asabah', color: '#6366f1' });
                if (ap > 0) results.push({ name: ap > 1 ? `${ap} Anak Perempuan` : 'Anak Perempuan', share: shareAP, base: BASE, type: 'Asabah', color: '#ec4899' });
                remaining = 0;
            }
        }
    }

    // 4. BAKI (ASABAH BAPA / ADIK BERADIK / BAITULMAL)
    if (remaining > 0) {
        if (bapa > 0) {
            let b = results.find(r => r.name === 'Bapa');
            b.share += remaining;
            b.type = 'Fardu + Asabah';
            remaining = 0;
            
        } else if (datuk > 0) {
            let d = results.find(r => r.name === 'Datuk');
            d.share += remaining;
            d.type = 'Fardu + Asabah';
            remaining = 0;
            
        } else if (adikLelaki > 0 || adikPerempuan > 0) {
            // Adik beradik ambil asabah jika tiada anak lelaki & tiada bapa
            let totalParts = (adikLelaki * 2) + adikPerempuan;
            if (totalParts > 0) {
                if (adikLelaki > 0) results.push({ name: adikLelaki > 1 ? `${adikLelaki} Adik Beradik Lelaki` : 'Adik Beradik Lelaki', share: (remaining * (adikLelaki * 2)) / totalParts, base: BASE, type: 'Asabah (Waris Kedua)', color: '#9333ea' });
                if (adikPerempuan > 0) results.push({ name: adikPerempuan > 1 ? `${adikPerempuan} Adik Beradik Perempuan` : 'Adik Beradik Perempuan', share: (remaining * adikPerempuan) / totalParts, base: BASE, type: 'Asabah (Waris Kedua)', color: '#c084fc' });
                remaining = 0;
            }
        } else {
            // LOGIK BAITULMAL: Jika tak ada langsung waris lelaki untuk habiskan baki
            results.push({ name: 'Baitulmal / Baki', share: remaining, base: BASE, type: 'Baki Belum Diagih', color: '#94a3b8' });
            remaining = 0;
        }
    }

    window.renderFaraidHtml(results);
};

// 13. RENDER KAD FARAID KE HTML
window.renderFaraidHtml = (results) => {
    const box = document.getElementById('ruangKiraanFaraid');
    if (!box) return;

    if (results.length === 0) {
        box.innerHTML = `<p style="font-size:13px; color:#7f8c8d; text-align:center; padding: 20px 0;">Sila tambah waris utama (Anak/Pasangan/Ibu/Bapa) untuk melihat kiraan Faraid.</p>`;
        return;
    }

    let html = `<div style="display:flex; flex-direction:column; gap:12px;">`;
    results.forEach(r => {
        let perc = ((r.share / r.base) * 100).toFixed(1);
        let shareVal = Math.round(r.share * 100) / 100;
        
        html += `
        <div style="background:#fff; border:1px solid #e0e6ed; border-radius:10px; padding:12px 15px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="flex:1;">
                <div style="font-weight:800; color:#2c3e50; font-size:14px; margin-bottom: 2px;">${r.name}</div>
                <div style="font-size:10px; font-weight:700; color:#95a5a6; text-transform:uppercase; letter-spacing: 0.5px;">${r.type}</div>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:800; color:#27ae60; font-size:15px;">${shareVal}/${r.base} <span style="font-weight:600; color:#bdc3c7; font-size:12px;">(${perc}%)</span></div>
                <div style="width:70px; height:6px; background:#ecf0f1; border-radius:3px; margin-top:6px; float:right; overflow:hidden;">
                    <div style="width:${perc}%; height:100%; background:${r.color};"></div>
                </div>
            </div>
        </div>`;
    });
    html += `</div>`;
    box.innerHTML = html;
};
