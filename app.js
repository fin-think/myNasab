// ==========================================
// app.js - Logik Teras FamiliPintar (VERSI 3 MUKTAMAD)
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
        const welcomeElement = document.getElementById('welcomeScreen');
        if (welcomeElement) welcomeElement.style.display = 'none'; 
        
        const authModalElement = document.getElementById('authModal');
        if (authModalElement) authModalElement.style.display = 'none';
        
        const refPengguna = doc(db, "mynasab_users", user.uid);
        const snapPengguna = await getDoc(refPengguna);

        if (snapPengguna.exists()) {
            const dataPengguna = snapPengguna.data();
            document.getElementById('creditBalance').innerText = dataPengguna.credit_balance;
            document.getElementById('treeNameDisplay').innerText = dataPengguna.name;
            window.muatTurunSalasilah(); // Load salasilah
        }
    } else {
        penggunaSemasa = null;
    }
});

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

        await addDoc(collection(db, "mynasab_trees"), {
            tree_name: "Keluarga " + namaKeluarga,
            admin_uid: user.uid,
            invite_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
            created_at: new Date()
        });

        alert("Pendaftaran berjaya! Anda menerima 10 Kredit Kotak percuma.");
        document.getElementById('authModal').style.display = 'none'; 
    } catch (error) {
        alert("Ralat pendaftaran: " + error.message);
    }
};

window.logKeluar = async () => {
    try { await signOut(auth); alert("Log keluar berjaya."); location.reload(); } catch (error) {}
};

// --- 2. FUNGSI TAMBAH KOTAK ---
window.tambahKotak = async (jenisKotak, idKotakInduk) => {
    if (!penggunaSemasa) return alert("Sila log masuk.");
    const refPengguna = doc(db, "mynasab_users", penggunaSemasa.uid);
    
    try {
        const snapPengguna = await getDoc(refPengguna);
        const bakiTerkini = snapPengguna.data().credit_balance;

        if (bakiTerkini <= 0) return alert("Baki kredit tidak mencukupi.");
        if (!confirm(`Gunakan 1 kredit untuk tambah kotak (${jenisKotak})?`)) return;
            
        await updateDoc(refPengguna, { credit_balance: increment(-1) });

        const canvas = document.getElementById('treeCanvas');
        const kotakInduk = document.getElementById(idKotakInduk);
        
        let topBaru = kotakInduk.offsetTop;
        let leftBaru = kotakInduk.offsetLeft;
        let anjakKiriKanan = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 80) + 120); 

        // Jarak telah dirapatkan menjadi 160px
        if (jenisKotak === 'parent') { topBaru -= 160; leftBaru += anjakKiriKanan; } 
        if (jenisKotak === 'child') { topBaru += 160; leftBaru += anjakKiriKanan; }  
        if (jenisKotak === 'spouse') { leftBaru += 250; } 

        const refKotakBaru = await addDoc(collection(db, "mynasab_nodes"), {
            owner_uid: penggunaSemasa.uid,
            node_type: jenisKotak,
            parent_node_id: idKotakInduk,
            name: "Ahli Baru",
            pos_x: leftBaru,  
            pos_y: topBaru,   
            created_at: new Date()
        });

        document.getElementById('creditBalance').innerText = bakiTerkini - 1;
        
        const kotakBaru = document.createElement('div');
        kotakBaru.className = 'node-card';
        kotakBaru.id = refKotakBaru.id;
        kotakBaru.setAttribute('data-parent', idKotakInduk);
        kotakBaru.style.top = topBaru + 'px';
        kotakBaru.style.left = leftBaru + 'px';
        kotakBaru.style.zIndex = '10';

        kotakBaru.innerHTML = `
            <div id="nama_${refKotakBaru.id}" onclick="bukaProfil('${refKotakBaru.id}')" style="font-weight: bold; margin-bottom: 10px; color: #2980b9; cursor: pointer; text-decoration: underline;">
                Ahli Baru (Klik Edit)
            </div>
            <button class="add-btn add-top" onclick="tambahKotak('parent', '${refKotakBaru.id}')">+</button>
            <button class="add-btn add-right" onclick="tambahKotak('spouse', '${refKotakBaru.id}')">+</button>
            <button class="add-btn add-bottom" onclick="tambahKotak('child', '${refKotakBaru.id}')">+</button>
        `;

        canvas.appendChild(kotakBaru);
        window.lukisSemuaGarisan();
        window.bukaProfil(refKotakBaru.id);

    } catch (error) { alert("Gagal memproses transaksi: " + error.message); }
};

// --- 3. KEMAS KINI PROFIL ---
window.bukaProfil = async (idKotak) => {
    document.getElementById('editNodeId').value = idKotak;
    document.getElementById('profilForm').reset();
    document.getElementById('containerSosmed').innerHTML = '<input type="url" name="sosmed[]" placeholder="https://facebook.com/..." style="width: 100%; padding: 10px; margin-bottom: 5px; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box;">';
    
    try {
        const docSnap = await getDoc(doc(db, "mynasab_nodes", idKotak));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(data.name) document.getElementById('editNama').value = data.name;
            if(data.relationship) document.getElementById('editHubungan').value = data.relationship;
            if(data.phone) document.getElementById('editTelefon').value = data.phone;
            if(data.city) document.getElementById('editBandar').value = data.city;
            if(data.state) document.getElementById('editNegeri').value = data.state;
            
            if(data.social_links && data.social_links.length > 0) {
                const container = document.getElementById('containerSosmed');
                container.innerHTML = ''; 
                data.social_links.forEach(link => {
                    const input = document.createElement('input');
                    input.type = 'url'; input.name = 'sosmed[]'; input.value = link;
                    input.style.cssText = 'width: 100%; padding: 10px; margin-bottom: 5px; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box;';
                    container.appendChild(input);
                });
            }
        }
    } catch (e) {}

    document.getElementById('profilModal').style.display = 'flex';
};

const formProfil = document.getElementById('profilForm');
if (formProfil) {
    formProfil.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const idKotak = document.getElementById('editNodeId').value;
        const pautanSosmed = Array.from(document.querySelectorAll('input[name="sosmed[]"]')).map(input => input.value).filter(val => val.trim() !== "");

        const dataKemasKini = {
            owner_uid: penggunaSemasa.uid,
            name: document.getElementById('editNama').value,
            relationship: document.getElementById('editHubungan').value,
            phone: document.getElementById('editTelefon').value,
            city: document.getElementById('editBandar').value,
            state: document.getElementById('editNegeri').value,
            social_links: pautanSosmed,
            updated_at: new Date()
        };
        
        try {
            await setDoc(doc(db, "mynasab_nodes", idKotak), dataKemasKini, { merge: true });
            
            const labelNama = document.getElementById('nama_' + idKotak);
            if (labelNama) {
                labelNama.innerText = dataKemasKini.name;
                labelNama.style.textDecoration = "none"; 
                labelNama.style.color = "#2c3e50";
            }
            document.getElementById('profilModal').style.display = 'none';
        } catch (error) { alert("Gagal menyimpan profil: " + error.message); }
    });
}

// --- 4. MUAT TURUN SALASILAH ---
window.muatTurunSalasilah = async () => {
    if (!penggunaSemasa) return;
    try {
        const q = query(collection(db, "mynasab_nodes"), where("owner_uid", "==", penggunaSemasa.uid));
        const querySnapshot = await getDocs(q);
        const canvas = document.getElementById('treeCanvas');
        
        canvas.innerHTML = `
            <svg id="canvasLines" style="position: absolute; top: 0; left: 0; width: 5000px; height: 5000px; z-index: 0; pointer-events: none;"></svg>
            <div class="node-card" style="top: 2500px; left: 2500px; z-index: 10;" id="node_root">
                <div id="nama_node_root" onclick="bukaProfil('node_root')" style="font-weight: bold; margin-bottom: 10px; color: #2980b9; cursor: pointer; text-decoration: underline;">Diri Sendiri (Klik Edit)</div>
                <button class="add-btn add-top" onclick="tambahKotak('parent', 'node_root')">+</button>
                <button class="add-btn add-right" onclick="tambahKotak('spouse', 'node_root')">+</button>
                <button class="add-btn add-bottom" onclick="tambahKotak('child', 'node_root')">+</button>
            </div>
        `;
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const idKotak = doc.id;
            
            if (idKotak === "node_root") {
                const labelRoot = document.getElementById('nama_node_root');
                if (labelRoot) {
                    labelRoot.innerText = data.name;
                    labelRoot.style.textDecoration = "none";
                    labelRoot.style.color = "#2c3e50";
                }
                return; 
            }
            
            const kotakBaru = document.createElement('div');
            kotakBaru.className = 'node-card';
            kotakBaru.id = idKotak;
            kotakBaru.setAttribute('data-parent', data.parent_node_id);
            kotakBaru.style.top = (data.pos_y || 2500) + 'px';
            kotakBaru.style.left = (data.pos_x || 2500) + 'px';
            kotakBaru.style.zIndex = '10';
            
            let namaPaparan = data.name || "Ahli Baru";
            let gayaNama = data.name !== "Ahli Baru" ? "color: #2c3e50; text-decoration: none;" : "color: #2980b9; text-decoration: underline;";

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

        setTimeout(() => window.lukisSemuaGarisan(), 500);
        
    } catch (error) { console.error("Gagal memuat turun salasilah:", error); }
};

// --- 5. LUKIS GARISAN ---
window.lukisSemuaGarisan = () => {
    const svg = document.getElementById('canvasLines');
    if (!svg) return;
    svg.innerHTML = ''; 
    
    document.querySelectorAll('.node-card').forEach(kotak => {
        const parentId = kotak.getAttribute('data-parent');
        if (parentId && parentId !== "undefined") {
            const kotakInduk = document.getElementById(parentId);
            if (kotakInduk) {
                const pX = kotakInduk.offsetLeft + (kotakInduk.offsetWidth / 2);
                const pY = kotakInduk.offsetTop + (kotakInduk.offsetHeight / 2); 
                const cX = kotak.offsetLeft + (kotak.offsetWidth / 2);
                const cY = kotak.offsetTop + (kotak.offsetHeight / 2);
                
                const garisan = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                garisan.setAttribute('x1', pX); garisan.setAttribute('y1', pY);
                garisan.setAttribute('x2', cX); garisan.setAttribute('y2', cY);
                garisan.setAttribute('stroke', '#95a5a6'); garisan.setAttribute('stroke-width', '3'); 
                svg.appendChild(garisan);
            }
        }
    });
};
