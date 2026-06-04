document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let state = {
        notes: [],
        filterCategory: 'All',
        searchQuery: '',
        theme: localStorage.getItem('notes-theme') || 'dark',
        editingNoteId: null
    };

    // --- Configurations & Constants ---
    const CATEGORIES = ['All', 'Work', 'Personal', 'Ideas', 'Study', 'Other'];
    const COLORS = [
        { name: 'Indigo', value: '#6366f1' },
        { name: 'Purple', value: '#a855f7' },
        { name: 'Emerald', value: '#10b981' },
        { name: 'Rose', value: '#f43f5e' },
        { name: 'Amber', value: '#f59e0b' },
        { name: 'Blue', value: '#0ea5e9' }
    ];

    // --- Helpers ---
    const getCsrfToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // --- API Calls ---
    const api = {
        async fetchNotes() {
            const res = await fetch('/api/notes');
            if (!res.ok) throw new Error('Notes failed to load');
            return await res.json();
        },
        async createNote(note) {
            const res = await fetch('/api/notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken()
                },
                body: JSON.stringify(note)
            });
            if (!res.ok) throw new Error('Failed to create note');
            return await res.json();
        },
        async updateNote(id, note) {
            const res = await fetch(`/api/notes/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken()
                },
                body: JSON.stringify(note)
            });
            if (!res.ok) throw new Error('Failed to update note');
            return await res.json();
        },
        async deleteNote(id) {
            const res = await fetch(`/api/notes/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-Token': getCsrfToken()
                }
            });
            if (!res.ok) throw new Error('Failed to delete note');
            return await res.json();
        }
    };

    // --- Toast System ---
    const showToast = (message, type = 'success') => {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Add matching SVG icon
        const iconSvg = type === 'success' 
            ? `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>`
            : `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;

        toast.innerHTML = `${iconSvg}<span>${message}</span>`;
        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('active');
        });

        // Remove after 3s
        setTimeout(() => {
            toast.classList.remove('active');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // --- DOM Mounting & Elements ---
    const mountApp = () => {
        // Apply theme initial
        document.body.className = state.theme === 'light' ? 'light-theme' : '';

        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="layout">
                <header>
                    <div class="logo">
                        <div class="logo-icon">N</div>
                        <div class="logo-text">Premium Notes</div>
                    </div>
                    <div class="controls">
                        <div class="search-wrapper">
                            <svg class="search-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <input type="text" class="search-input" id="search-box" placeholder="メモを検索..." value="${state.searchQuery}">
                        </div>
                        <button class="btn btn-icon" id="theme-toggle" title="テーマ切り替え">
                            <svg class="theme-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"></svg>
                        </button>
                        <button class="btn btn-primary" id="btn-new-note">
                            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"></path></svg>
                            新規メモ
                        </button>
                    </div>
                </header>

                <main class="main-content">
                    <div class="filter-bar">
                        <div class="categories" id="category-filters">
                            <!-- Populated dynamically -->
                        </div>
                    </div>

                    <div class="notes-grid" id="notes-list">
                        <!-- Populated dynamically -->
                    </div>
                </main>
            </div>

            <!-- Note Dialog Modal -->
            <div class="modal-overlay" id="note-modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title" id="modal-headline">新しいメモを追加</h3>
                        <button class="modal-close" id="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label" for="note-title-input">タイトル</label>
                            <input type="text" class="form-control" id="note-title-input" placeholder="タイトルを入力...">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="note-body-input">内容</label>
                            <textarea class="form-control" id="note-body-input" placeholder="メモの内容を入力..."></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">カテゴリ</label>
                            <div class="category-input-wrapper">
                                <select class="form-control" id="note-category-select">
                                    ${CATEGORIES.slice(1).map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                                </select>
                                <input type="text" class="form-control" id="note-category-custom" placeholder="カスタムを入力 (任意)">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">カラー</label>
                            <div class="color-picker" id="color-picker-widget">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-icon" id="modal-cancel-btn" style="width: auto; padding: 10px 16px;">キャンセル</button>
                        <button class="btn btn-primary" id="modal-save-btn">保存する</button>
                    </div>
                </div>
            </div>
        `;

        setupEventHandlers();
        updateThemeIcon();
        renderCategories();
        renderColorPicker();
    };

    // --- Rendering Components ---
    const renderCategories = () => {
        const container = document.getElementById('category-filters');
        container.innerHTML = CATEGORIES.map(cat => {
            const activeClass = state.filterCategory === cat ? 'active' : '';
            return `<button class="category-tab ${activeClass}" data-category="${cat}">${cat}</button>`;
        }).join('');
    };

    const renderColorPicker = (selectedColor = COLORS[0].value) => {
        const container = document.getElementById('color-picker-widget');
        container.innerHTML = COLORS.map(c => {
            const selectedClass = c.value === selectedColor ? 'selected' : '';
            return `<div class="color-option ${selectedClass}" data-color="${c.value}" style="background-color: ${c.value};" title="${c.name}"></div>`;
        }).join('');
    };

    const renderNotes = () => {
        const container = document.getElementById('notes-list');
        
        // Filter and Search notes
        let filteredNotes = state.notes;
        
        if (state.filterCategory !== 'All') {
            filteredNotes = filteredNotes.filter(n => n.category.toLowerCase() === state.filterCategory.toLowerCase());
        }

        if (state.searchQuery.trim() !== '') {
            const q = state.searchQuery.toLowerCase();
            filteredNotes = filteredNotes.filter(n => 
                n.title.toLowerCase().includes(q) || 
                n.body.toLowerCase().includes(q) ||
                n.category.toLowerCase().includes(q)
            );
        }

        if (filteredNotes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path></svg>
                    <h3>メモが見つかりません</h3>
                    <p>新しく作成するか、フィルター条件を変更してください。</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredNotes.map(n => {
            // escape html
            const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
            
            return `
                <div class="note-card" data-id="${n.id}" style="--note-accent: ${n.color};">
                    <div class="note-header">
                        <div class="note-title">${escape(n.title)}</div>
                        <span class="note-category-badge">${escape(n.category)}</span>
                    </div>
                    <div class="note-body">${escape(n.body)}</div>
                    <div class="note-footer">
                        <span class="note-date">${formatDate(n.changed)}</span>
                        <div class="note-actions">
                            <button class="card-btn card-btn-edit" data-id="${n.id}" title="編集">
                                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button class="card-btn card-btn-delete" data-id="${n.id}" title="削除">
                                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    // --- UI Interactions ---
    const updateThemeIcon = () => {
        const themeBtn = document.getElementById('theme-toggle');
        if (state.theme === 'light') {
            themeBtn.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
        } else {
            themeBtn.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path></svg>`;
        }
    };

    const toggleTheme = () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('notes-theme', state.theme);
        document.body.className = state.theme === 'light' ? 'light-theme' : '';
        updateThemeIcon();
    };

    const openModal = (noteId = null) => {
        const overlay = document.getElementById('note-modal-overlay');
        const headline = document.getElementById('modal-headline');
        const titleInput = document.getElementById('note-title-input');
        const bodyInput = document.getElementById('note-body-input');
        const catSelect = document.getElementById('note-category-select');
        const catCustom = document.getElementById('note-category-custom');
        
        state.editingNoteId = noteId;

        if (noteId) {
            headline.textContent = 'メモを編集';
            const note = state.notes.find(n => n.id == noteId);
            if (note) {
                titleInput.value = note.title;
                bodyInput.value = note.body;
                
                // Set category
                const hasStandardCat = CATEGORIES.slice(1).includes(note.category);
                if (hasStandardCat) {
                    catSelect.value = note.category;
                    catCustom.value = '';
                } else {
                    catSelect.value = 'Other';
                    catCustom.value = note.category;
                }
                
                renderColorPicker(note.color);
            }
        } else {
            headline.textContent = '新しいメモを追加';
            titleInput.value = '';
            bodyInput.value = '';
            catSelect.value = CATEGORIES[1]; // default Work
            catCustom.value = '';
            renderColorPicker(COLORS[0].value);
        }

        overlay.classList.add('active');
        titleInput.focus();
    };

    const closeModal = () => {
        const overlay = document.getElementById('note-modal-overlay');
        overlay.classList.remove('active');
        state.editingNoteId = null;
    };

    const saveNote = async () => {
        const title = document.getElementById('note-title-input').value.trim();
        const body = document.getElementById('note-body-input').value.trim();
        const catSelect = document.getElementById('note-category-select').value;
        const catCustom = document.getElementById('note-category-custom').value.trim();
        const color = document.querySelector('.color-option.selected').getAttribute('data-color');

        if (!title) {
            showToast('タイトルを入力してください。', 'error');
            return;
        }

        // Determine category
        const category = catCustom !== '' ? catCustom : catSelect;

        const noteData = { title, body, category, color };

        try {
            if (state.editingNoteId) {
                const updatedNote = await api.updateNote(state.editingNoteId, noteData);
                state.notes = state.notes.map(n => n.id == state.editingNoteId ? updatedNote : n);
                showToast('メモを更新しました。');
            } else {
                const newNote = await api.createNote(noteData);
                state.notes.unshift(newNote);
                showToast('メモを作成しました。');
            }
            
            closeModal();
            renderNotes();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const deleteNote = async (id) => {
        if (!confirm('このメモを削除してもよろしいですか？')) return;
        
        try {
            await api.deleteNote(id);
            state.notes = state.notes.filter(n => n.id != id);
            showToast('メモを削除しました。');
            renderNotes();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // --- Events Bindings ---
    const setupEventHandlers = () => {
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

        // Open modal for new note
        document.getElementById('btn-new-note').addEventListener('click', () => openModal());

        // Modal triggers
        document.getElementById('modal-close-btn').addEventListener('click', closeModal);
        document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
        document.getElementById('modal-save-btn').addEventListener('click', saveNote);

        // Search trigger
        const searchBox = document.getElementById('search-box');
        searchBox.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            renderNotes();
        });

        // Category filter click
        document.getElementById('category-filters').addEventListener('click', (e) => {
            const tab = e.target.closest('.category-tab');
            if (!tab) return;
            state.filterCategory = tab.getAttribute('data-category');
            renderCategories();
            renderNotes();
        });

        // Color option selection
        document.getElementById('color-picker-widget').addEventListener('click', (e) => {
            const option = e.target.closest('.color-option');
            if (!option) return;
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        });

        // Notes grid delegations (Edit/Delete)
        document.getElementById('notes-list').addEventListener('click', (e) => {
            const editBtn = e.target.closest('.card-btn-edit');
            const deleteBtn = e.target.closest('.card-btn-delete');
            const card = e.target.closest('.note-card');

            if (editBtn) {
                e.stopPropagation();
                openModal(editBtn.getAttribute('data-id'));
            } else if (deleteBtn) {
                e.stopPropagation();
                deleteNote(deleteBtn.getAttribute('data-id'));
            } else if (card) {
                // Click card also opens edit modal
                openModal(card.getAttribute('data-id'));
            }
        });

        // Close modal when clicking backdrop
        document.getElementById('note-modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'note-modal-overlay') closeModal();
        });
    };

    // --- App Init ---
    const init = async () => {
        mountApp();
        try {
            state.notes = await api.fetchNotes();
            renderNotes();
        } catch (err) {
            showToast('データの読み込みに失敗しました。', 'error');
            // Populate fallback empty grid
            renderNotes();
        }
    };

    init();
});
