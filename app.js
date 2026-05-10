/* ============================================
   CEDA EL PASO · TINY DESK PLANNER
   App Logic — Firebase Realtime, Drag & Drop, PDF
   ============================================ */

// ============ FIREBASE CONFIG ============
const firebaseConfig = {
    apiKey: "AIzaSyCTxPDjTd8aWlDiQwBnwIfRo9jo3TDryI8",
    authDomain: "tinydeskceda.firebaseapp.com",
    databaseURL: "https://tinydeskceda-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "tinydeskceda",
    storageBucket: "tinydeskceda.firebasestorage.app",
    messagingSenderId: "216732565501",
    appId: "1:216732565501:web:7bf09f58c5e5471746e394"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const setlistRef = db.ref('setlist');

// ============ DATA ============
const DEFAULT_DATA = {
    items: [
        { id: 'song-1', type: 'song', title: 'Una vez al mes', duration: 4, key: '', bpm: '', notes: '' },
        { id: 'note-1', type: 'note', text: 'Presentar al grupo y agradecer la oportunidad', duration: 1 },
        { id: 'song-2', type: 'song', title: 'Yo te quiero a ti', duration: 4, key: '', bpm: '', notes: '' },
        { id: 'note-2', type: 'note', text: 'Contar la historia detrás de la siguiente canción', duration: 1 },
        { id: 'song-3', type: 'song', title: 'Niña', duration: 4, key: '', bpm: '', notes: '' },
        { id: 'note-3', type: 'note', text: 'Transición / comentario breve', duration: 0.5 },
        { id: 'song-4', type: 'song', title: 'La pasta', duration: 4, key: '', bpm: '', notes: '' },
    ],
    lastUpdated: null,
    lastUpdatedBy: null
};

let data = JSON.parse(JSON.stringify(DEFAULT_DATA));
let hasUnsavedChanges = false;
let isFirstLoad = true;
let draggedItem = null;
let draggedEl = null;
let touchClone = null;
let songCounter = 0;

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    setupGlobalListeners();
    setupFirebaseListeners();
    const local = loadLocalData();
    if (local) {
        data = local;
        render();
    }
});

// ============ FIREBASE ============
function setupFirebaseListeners() {
    const connectedRef = db.ref('.info/connected');
    connectedRef.on('value', (snap) => {
        const dot = document.getElementById('sync-dot');
        const text = document.getElementById('sync-text');
        if (snap.val() === true) {
            dot.className = 'sync-dot connected';
            text.textContent = 'Conectado en tiempo real';
        } else {
            dot.className = 'sync-dot disconnected';
            text.textContent = 'Sin conexión — cambios locales';
        }
    });

    setlistRef.on('value', (snapshot) => {
        const remoteData = snapshot.val();
        if (remoteData && remoteData.items) {
            data = remoteData;
            saveLocalData();
            render();
            updateSyncStatus();
            if (!isFirstLoad) {
                showToast('🔄 Actualizado por ' + (remoteData.lastUpdatedBy || 'alguien'));
            }
            isFirstLoad = false;
            hasUnsavedChanges = false;
            document.body.classList.remove('has-unsaved');
        } else if (isFirstLoad) {
            isFirstLoad = false;
            saveToFirebase();
        }
    });
}

function saveToFirebase() {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    const saveBtn = document.getElementById('btn-save');

    let userName = localStorage.getItem('cedaelpaso-username');
    if (!userName) {
        userName = prompt('¿Cómo te llamas? (para que el grupo sepa quién guardó)');
        if (userName) {
            localStorage.setItem('cedaelpaso-username', userName.trim());
            userName = userName.trim();
        } else {
            userName = 'Anónimo';
        }
    }

    data.lastUpdated = new Date().toISOString();
    data.lastUpdatedBy = userName;

    dot.className = 'sync-dot saving';
    text.textContent = 'Guardando...';
    saveBtn.classList.add('saving');

    setlistRef.set(data)
        .then(() => {
            dot.className = 'sync-dot connected';
            text.textContent = 'Guardado ✓';
            saveBtn.classList.remove('saving');
            hasUnsavedChanges = false;
            document.body.classList.remove('has-unsaved');
            saveLocalData();
            showToast('💾 Guardado para todos ✓');
        })
        .catch((error) => {
            console.error('Firebase error:', error);
            dot.className = 'sync-dot disconnected';
            text.textContent = 'Error — guardado localmente';
            saveBtn.classList.remove('saving');
            saveLocalData();
            showToast('⚠️ Error — guardado solo localmente');
        });
}

function updateSyncStatus() {
    const text = document.getElementById('sync-text');
    if (data.lastUpdated) {
        const date = new Date(data.lastUpdated);
        const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const who = data.lastUpdatedBy || 'alguien';
        text.textContent = `Última: ${timeStr} por ${who}`;
    }
}

function markUnsaved() {
    hasUnsavedChanges = true;
    document.body.classList.add('has-unsaved');
    saveLocalData();
}

function loadLocalData() {
    try {
        const saved = localStorage.getItem('cedaelpaso-tinydesk');
        if (saved) return JSON.parse(saved);
    } catch (e) { console.warn('Error:', e); }
    return null;
}

function saveLocalData() {
    localStorage.setItem('cedaelpaso-tinydesk', JSON.stringify(data));
}

// ============ RENDER ============
function render() {
    renderSetlist();
}

function renderSetlist() {
    const container = document.getElementById('setlist');
    container.innerHTML = '';
    songCounter = 0;

    container.appendChild(createDropZone(0));

    data.items.forEach((item, index) => {
        if (item.type === 'song') {
            songCounter++;
            container.appendChild(createSongElement(item, index, songCounter));
        } else {
            container.appendChild(createNoteElement(item, index));
        }
        container.appendChild(createDropZone(index + 1));
    });
}

function createSongElement(item, index, number) {
    const el = document.createElement('div');
    el.className = 'setlist-item is-song';
    el.dataset.index = index;
    el.dataset.id = item.id;
    el.draggable = true;

    el.innerHTML = `
        <div class="item-header">
            <div class="item-drag-handle" title="Arrastrar">⠿</div>
            <div class="item-number">${number}</div>
            <div class="item-info">
                <div class="item-title">${escapeHtml(item.title)}</div>
                <div class="item-meta">
                    <span>⏱ ${formatDuration(item.duration)}</span>
                    ${item.key ? `<span>🎹 ${escapeHtml(item.key)}</span>` : ''}
                    ${item.bpm ? `<span>♩ ${escapeHtml(item.bpm)} bpm</span>` : ''}
                </div>
                ${item.notes ? `<div class="item-meta" style="margin-top:4px;font-style:italic;opacity:0.7">${escapeHtml(item.notes)}</div>` : ''}
            </div>
            <div class="item-actions">
                <button class="btn btn-secondary btn-sm" onclick="editItem(${index})" title="Editar">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteItem(${index})" title="Eliminar">🗑</button>
            </div>
        </div>
    `;

    setupDragListeners(el, index);
    return el;
}

function createNoteElement(item, index) {
    const el = document.createElement('div');
    el.className = 'setlist-item is-note';
    el.dataset.index = index;
    el.dataset.id = item.id;
    el.draggable = true;

    el.innerHTML = `
        <div class="item-header">
            <div class="item-drag-handle" title="Arrastrar">⠿</div>
            <div class="note-icon">💬</div>
            <div class="note-content">
                <div class="note-label">Hablar</div>
                <div class="note-text">${escapeHtml(item.text)}</div>
                <div class="note-duration">⏱ ${formatDuration(item.duration)}</div>
            </div>
            <div class="item-actions">
                <button class="btn btn-secondary btn-sm" onclick="editItem(${index})" title="Editar">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteItem(${index})" title="Eliminar">🗑</button>
            </div>
        </div>
    `;

    setupDragListeners(el, index);
    return el;
}

function createDropZone(position) {
    const dz = document.createElement('div');
    dz.className = 'drop-zone';
    dz.dataset.position = position;

    dz.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        dz.classList.add('active');
    });
    dz.addEventListener('dragleave', () => dz.classList.remove('active'));
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('active');
        moveItem(parseInt(e.dataTransfer.getData('text/plain')), parseInt(dz.dataset.position));
    });
    return dz;
}

// ============ DRAG & DROP ============
function setupDragListeners(el, index) {
    const handle = el.querySelector('.item-drag-handle');

    el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', index);
        e.dataTransfer.effectAllowed = 'move';
        draggedItem = index;
        draggedEl = el;
        setTimeout(() => el.classList.add('dragging'), 0);
    });

    el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        draggedItem = null;
        draggedEl = null;
        document.querySelectorAll('.drop-zone.active').forEach(dz => dz.classList.remove('active'));
    });

    handle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        draggedItem = index;
        draggedEl = el;
        touchClone = el.cloneNode(true);
        touchClone.style.cssText = `position:fixed;width:${el.offsetWidth}px;left:${el.getBoundingClientRect().left}px;top:${touch.clientY-30}px;opacity:0.8;z-index:1000;pointer-events:none;box-shadow:0 12px 32px rgba(13,27,42,0.24);transform:rotate(1deg)`;
        document.body.appendChild(touchClone);
        el.classList.add('dragging');
    }, { passive: false });

    handle.addEventListener('touchmove', (e) => {
        if (draggedItem === null) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (touchClone) touchClone.style.top = touch.clientY - 30 + 'px';
        document.querySelectorAll('.drop-zone').forEach(dz => {
            const rect = dz.getBoundingClientRect();
            dz.classList.toggle('active', touch.clientY >= rect.top - 20 && touch.clientY <= rect.bottom + 20);
        });
    }, { passive: false });

    handle.addEventListener('touchend', () => {
        if (draggedItem === null) return;
        let targetPosition = -1;
        document.querySelectorAll('.drop-zone').forEach(dz => {
            if (dz.classList.contains('active')) targetPosition = parseInt(dz.dataset.position);
            dz.classList.remove('active');
        });
        if (targetPosition >= 0) moveItem(draggedItem, targetPosition);
        if (touchClone) { touchClone.remove(); touchClone = null; }
        if (draggedEl) draggedEl.classList.remove('dragging');
        draggedItem = null;
        draggedEl = null;
    });
}

function moveItem(fromIndex, toPosition) {
    if (fromIndex === toPosition || fromIndex === toPosition - 1) return;
    const item = data.items.splice(fromIndex, 1)[0];
    data.items.splice(toPosition > fromIndex ? toPosition - 1 : toPosition, 0, item);
    markUnsaved();
    render();
    showToast('Movido — pulsa 💾');
}

// ============ EDIT / ADD / DELETE ============
function editItem(index) {
    const item = data.items[index];
    const modal = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    if (item.type === 'song') {
        title.textContent = '🎶 Editar canción';
        body.innerHTML = `
            <div class="form-group">
                <label class="form-label">Título</label>
                <input class="form-input" id="edit-title" value="${escapeAttr(item.title)}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Duración (min)</label>
                    <input class="form-input" id="edit-duration" type="number" step="0.5" min="0" value="${item.duration}">
                </div>
                <div class="form-group">
                    <label class="form-label">Tonalidad</label>
                    <input class="form-input" id="edit-key" value="${escapeAttr(item.key || '')}">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">BPM</label>
                <input class="form-input" id="edit-bpm" value="${escapeAttr(item.bpm || '')}">
            </div>
            <div class="form-group">
                <label class="form-label">Notas internas</label>
                <textarea class="form-textarea" id="edit-notes">${escapeHtml(item.notes || '')}</textarea>
            </div>
        `;
    } else {
        title.textContent = '💬 Editar nota';
        body.innerHTML = `
            <div class="form-group">
                <label class="form-label">Texto</label>
                <textarea class="form-textarea" id="edit-text" rows="4">${escapeHtml(item.text)}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Duración estimada (min)</label>
                <input class="form-input" id="edit-note-duration" type="number" step="0.5" min="0" value="${item.duration}">
            </div>
        `;
    }

    modal.classList.add('active');
    const saveBtn = document.getElementById('modal-save');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', () => {
        if (item.type === 'song') {
            item.title = document.getElementById('edit-title').value.trim() || 'Sin título';
            item.duration = parseFloat(document.getElementById('edit-duration').value) || 0;
            item.key = document.getElementById('edit-key').value.trim();
            item.bpm = document.getElementById('edit-bpm').value.trim();
            item.notes = document.getElementById('edit-notes').value.trim();
        } else {
            item.text = document.getElementById('edit-text').value.trim() || 'Nota vacía';
            item.duration = parseFloat(document.getElementById('edit-note-duration').value) || 0;
        }
        markUnsaved();
        render();
        closeModal();
        showToast('Editado — pulsa 💾');
    });
}

function deleteItem(index) {
    const item = data.items[index];
    const label = item.type === 'song' ? `"${item.title}"` : 'esta nota';
    if (confirm(`¿Eliminar ${label}?`)) {
        data.items.splice(index, 1);
        markUnsaved();
        render();
        showToast('Eliminado — pulsa 💾');
    }
}

function addSong() {
    data.items.push({ id: 'song-' + Date.now(), type: 'song', title: 'Nueva canción', duration: 4, key: '', bpm: '', notes: '' });
    markUnsaved();
    render();
    editItem(data.items.length - 1);
}

function addNote() {
    data.items.push({ id: 'note-' + Date.now(), type: 'note', text: 'Escribe aquí lo que vais a decir...', duration: 1 });
    markUnsaved();
    render();
    editItem(data.items.length - 1);
}

// ============ PRESENTATION ============
function enterPresentation() {
    const overlay = document.getElementById('presentation-overlay');
    const content = document.getElementById('presentation-content');
    let songNum = 0;
    let html = '';

    data.items.forEach(item => {
        if (item.type === 'song') {
            songNum++;
            html += `<div class="pres-item"><div class="pres-song">
                <div class="pres-number">${songNum}</div>
                <div class="pres-song-info">
                    <h3>${escapeHtml(item.title)}</h3>
                    <div class="pres-song-meta">${formatDuration(item.duration)}${item.key ? ` · ${escapeHtml(item.key)}` : ''}${item.bpm ? ` · ${escapeHtml(item.bpm)} bpm` : ''}</div>
                    ${item.notes ? `<div class="pres-song-meta" style="margin-top:6px;font-style:italic">${escapeHtml(item.notes)}</div>` : ''}
                </div>
            </div></div>`;
        } else {
            html += `<div class="pres-item"><div class="pres-note">
                <div class="pres-note-label">Hablar — ${formatDuration(item.duration)}</div>
                <div class="pres-note-text">${escapeHtml(item.text)}</div>
            </div></div>`;
        }
    });

    const totalMin = data.items.reduce((sum, i) => sum + (i.duration || 0), 0);
    html += `<div class="pres-item" style="text-align:center;opacity:0.4;padding-top:24px"><p>Tiempo total: <strong>${formatDuration(totalMin)}</strong></p></div>`;

    content.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function exitPresentation() {
    document.getElementById('presentation-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

// ============ EXPORT / IMPORT ============
function exportJSON() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CedaElPaso_TinyDesk_${getDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON exportado 📤');
}

function importJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.items && Array.isArray(imported.items)) {
                data = imported;
                markUnsaved();
                render();
                showToast('Importado — pulsa 💾');
            } else {
                alert('Formato incorrecto.');
            }
        } catch (err) { alert('Error: ' + err.message); }
    };
    reader.readAsText(file);
}

// ============ PDF EXPORT (Updated styles) ============
async function exportPDF() {
    showToast('Generando PDF...');

    const pdfContainer = document.createElement('div');
    pdfContainer.style.cssText = 'width:700px;padding:30px;background:#F1F3F5;font-family:Inter,sans-serif;color:#212529;position:absolute;left:-9999px;top:0';

    let songNum = 0;
    let html = `
        <div style="text-align:center;margin-bottom:24px;background:#0D1B2A;padding:24px;border-radius:10px;">
            <div style="font-size:2rem;">🎸</div>
            <h1 style="font-family:'Permanent Marker',cursive;font-size:2.2rem;margin:8px 0 4px;color:#E63946;text-transform:uppercase;letter-spacing:0.02em;">CEDA EL PASO</h1>
            <p style="font-size:0.8rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.15em;">Tiny Desk — Setlist</p>
            <p style="font-size:0.75rem;color:rgba(255,255,255,0.4);margin-top:6px;">${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
    `;

    data.items.forEach(item => {
        if (item.type === 'song') {
            songNum++;
            html += `
                <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;margin:6px 0;background:white;border-radius:10px;border-left:4px solid #E63946;">
                    <div style="width:32px;height:32px;border-radius:50%;background:#E63946;color:white;display:flex;align-items:center;justify-content:center;font-family:'Permanent Marker',cursive;font-size:1.1rem;flex-shrink:0;">${songNum}</div>
                    <div style="flex:1;">
                        <div style="font-family:'Permanent Marker',cursive;font-size:1.3rem;color:#0D1B2A;text-transform:uppercase;">${escapeHtml(item.title)}</div>
                        <div style="font-size:0.75rem;color:#6C757D;margin-top:3px;">
                            ⏱ ${formatDuration(item.duration)}
                            ${item.key ? ` · 🎹 ${escapeHtml(item.key)}` : ''}
                            ${item.bpm ? ` · ♩ ${escapeHtml(item.bpm)} bpm` : ''}
                        </div>
                        ${item.notes ? `<div style="font-size:0.8rem;color:#6C757D;margin-top:4px;font-style:italic;">${escapeHtml(item.notes)}</div>` : ''}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div style="padding:10px 16px;margin:6px 0 6px 20px;background:#F8F9FA;border-left:3px solid #DEE2E6;border-radius:6px;">
                    <div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:#6C757D;margin-bottom:3px;font-weight:600;">Hablar — ${formatDuration(item.duration)}</div>
                    <div style="font-size:0.85rem;line-height:1.5;color:#343A40;white-space:pre-wrap;">${escapeHtml(item.text)}</div>
                </div>
            `;
        }
    });

    const totalMin = data.items.reduce((sum, i) => sum + (i.duration || 0), 0);
    html += `
        <div style="text-align:center;margin-top:20px;padding:14px;background:#0D1B2A;border-radius:10px;">
            <span style="font-size:0.85rem;color:rgba(255,255,255,0.6);">Tiempo total: </span>
            <span style="font-family:'Permanent Marker',cursive;font-size:1.2rem;color:#E63946;">${formatDuration(totalMin)}</span>
        </div>
    `;

    pdfContainer.innerHTML = html;
    document.body.appendChild(pdfContainer);

    try {
        const canvas = await html2canvas(pdfContainer, { scale: 2, useCORS: true, backgroundColor: '#F1F3F5' });
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 20;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 10;

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 20);

        while (heightLeft > 0) {
            position = heightLeft - imgHeight + 10;
            pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= (pageHeight - 20);
        }

        pdf.save(`CedaElPaso_TinyDesk_${getDateString()}.pdf`);
        showToast('PDF descargado ✓');
    } catch (err) {
        console.error('PDF error:', err);
        alert('Error al generar el PDF.');
    } finally {
        pdfContainer.remove();
    }
}

// ============ MODAL ============
function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

// ============ LISTENERS ============
function setupGlobalListeners() {
    document.getElementById('btn-save').addEventListener('click', saveToFirebase);
    document.getElementById('btn-add-song').addEventListener('click', addSong);
    document.getElementById('btn-add-note').addEventListener('click', addNote);
    document.getElementById('btn-presentation').addEventListener('click', enterPresentation);
    document.getElementById('btn-exit-presentation').addEventListener('click', exitPresentation);
    document.getElementById('btn-pdf').addEventListener('click', exportPDF);
    document.getElementById('btn-export').addEventListener('click', exportJSON);
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('file-import').click());
    document.getElementById('file-import').addEventListener('change', (e) => {
        if (e.target.files.length > 0) { importJSON(e.target.files[0]); e.target.value = ''; }
    });
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-overlay')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeModal(); exitPresentation(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveToFirebase(); }
    });
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; }
    });
}

// ============ UTILS ============
function formatDuration(min) {
    if (!min && min !== 0) return '0:00';
    const m = Math.floor(min);
    const s = Math.round((min - m) * 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}

function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2500);
}