/**
 * Editor Manager
 * Handles Quill initialization, UI interactions, and saving logic
 */

class EditorManager {
    constructor() {
        this.quill = null;
        this.currentNoteId = null;
        this.autoSaveTimer = null;

        // DOM Elements
        this.dashboardView = document.getElementById('dashboard-view');
        this.editorView = document.getElementById('editor-view');
        this.notesGrid = document.getElementById('notes-grid');
        this.sidebarNotesList = document.getElementById('sidebar-notes-list');
        this.titleInput = document.getElementById('note-title-input');
        this.saveStatus = document.getElementById('save-status');
        this.searchInput = document.getElementById('search-input');

        this.initQuill();
        this.bindEvents();

        // Listen for Auth success to load notes
        document.addEventListener('authSuccess', async () => {
            if (window.storageManager) {
                await window.storageManager.syncFromSupabase();
            }
            this.loadDashboard();
            this.refreshSidebar();
        });
    }

    initQuill() {
        // Font whitelist
        const Font = Quill.import('attributors/style/font');
        Font.whitelist = ['Inter', 'Arial', 'Times New Roman', 'Courier'];
        Quill.register(Font, true);

        // Size whitelist
        const Size = Quill.import('attributors/style/size');
        Size.whitelist = ['8px', '10px', '12px', '14px', '16px', '18px', '24px', '32px', '48px', '72px'];
        Quill.register(Size, true);

        const toolbarOptions = [
            [{ 'font': Font.whitelist }],
            [{ 'size': Size.whitelist }],
            [{ 'color': [] }, { 'background': [] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'align': [] }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'indent': '-1' }, { 'indent': '+1' }],
            ['blockquote', 'code-block'],
            ['clean']
        ];

        this.quill = new Quill('#editor-container', {
            theme: 'snow',
            modules: {
                toolbar: toolbarOptions,
                history: {
                    delay: 2000,
                    maxStack: 500,
                    userOnly: true
                }
            },
            placeholder: 'Start writing your secure note...'
        });

        // Add proper spellchecking behavior
        this.quill.root.setAttribute('spellcheck', 'true');

        // Events
        this.quill.on('text-change', () => {
            this.updateStats();
            this.markUnsaved();

            // Dispatch custom event for spellcheck module
            document.dispatchEvent(new CustomEvent('editorTextChange', { detail: { quill: this.quill } }));
        });
    }

    bindEvents() {
        // Navigation Options
        document.getElementById('new-note-btn').addEventListener('click', () => this.createNewNote());
        document.getElementById('back-to-dash').addEventListener('click', () => {
            this.saveCurrentNote();
            this.showDashboard();
        });

        // Editor Actions
        document.getElementById('save-btn').addEventListener('click', () => this.saveCurrentNote());
        document.getElementById('save-as-btn').addEventListener('click', () => {
            const currentName = this.titleInput.value || this.generateAutoTitle();
            const newName = prompt('Enter a desired name for this chat:', currentName);
            if (newName && newName.trim() !== '') {
                this.titleInput.value = newName.trim();
                this.saveCurrentNote();
            }
        });
        document.getElementById('delete-btn').addEventListener('click', () => this.deleteCurrentNote());

        // Export Actions
        document.getElementById('export-txt').addEventListener('click', (e) => {
            e.preventDefault();
            const text = this.quill.getText();
            const title = this.titleInput.value || this.generateAutoTitle();
            window.storageManager.exportTxt(title, text);
        });
        document.getElementById('export-html').addEventListener('click', (e) => {
            e.preventDefault();
            const html = this.quill.root.innerHTML;
            const title = this.titleInput.value || this.generateAutoTitle();
            window.storageManager.exportHtml(title, html);
        });

        // AI Actions
        const handleAIOperation = async (promptType) => {
            if (!window.aiManager.isReady()) {
                alert("Please click the Settings gear icon to configure your Gemini API Key first.");
                return;
            }

            const textContext = this.quill.getText().trim();
            if (!textContext) {
                alert("Please write some text in the editor first before using AI.");
                return;
            }

            const originalStatus = this.saveStatus.textContent;
            this.saveStatus.textContent = '✨ AI is thinking...';

            let prompt = "";
            switch (promptType) {
                case 'summarize': prompt = "Please provide a concise summary of the following text:"; break;
                case 'grammar': prompt = "Please correct any grammatical errors or typos in the following text. Do not add conversational filler, just return the corrected text:"; break;
                case 'expand': prompt = "Please expand on the concepts in the following text, providing more detail and professional formatting:"; break;
            }

            try {
                const generatedText = await window.aiManager.generateContent(prompt, textContext);

                // Append the AI response to the bottom of the editor securely via Delta
                const finalContent = "\n\n--- AI Generation ---\n" + generatedText.trim() + "\n";
                const length = this.quill.getLength();
                this.quill.insertText(length, finalContent);
                this.saveStatus.textContent = originalStatus;
                this.saveCurrentNote();

            } catch (error) {
                console.error("AI Error:", error);
                alert("AI Generation Failed: " + error.message);
                this.saveStatus.textContent = originalStatus;
            }
        };

        document.getElementById('ai-summarize').addEventListener('click', (e) => { e.preventDefault(); handleAIOperation('summarize'); });
        document.getElementById('ai-grammar').addEventListener('click', (e) => { e.preventDefault(); handleAIOperation('grammar'); });
        document.getElementById('ai-expand').addEventListener('click', (e) => { e.preventDefault(); handleAIOperation('expand'); });

        document.getElementById('print-btn').addEventListener('click', () => window.print());

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Save (Ctrl+S / Cmd+S)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.editorView.classList.contains('active')) {
                    this.saveCurrentNote();
                }
            }
        });

        // Auto-save typing update
        this.titleInput.addEventListener('input', () => this.markUnsaved());

        // Dashboard Search
        this.searchInput.addEventListener('input', (e) => this.filterNotes(e.target.value));

        // Setup auto-save interval (every 30 seconds)
        setInterval(() => this.autoSave(), 30 * 1000);
    }

    // --- View Management ---

    showDashboard() {
        this.editorView.classList.remove('active');
        setTimeout(() => {
            this.editorView.classList.add('hidden');
            this.dashboardView.classList.remove('hidden');
            this.dashboardView.classList.add('active');
            this.loadDashboard(); // Refresh list
        }, 300);
    }

    showEditor() {
        this.dashboardView.classList.remove('active');
        setTimeout(() => {
            this.dashboardView.classList.add('hidden');
            this.editorView.classList.remove('hidden');
            this.editorView.classList.add('active');
        }, 300);
    }

    // --- Note Logic ---

    createNewNote() {
        this.currentNoteId = window.storageManager.generateUUID();
        this.titleInput.value = '';
        this.quill.setContents([{ insert: '\n' }]);
        this.saveStatus.textContent = 'Unsaved';
        this.updateStats();
        this.showEditor();
        this.refreshSidebar();
    }

    async openNote(id) {
        const note = await window.storageManager.getNote(id);
        if (note) {
            this.currentNoteId = note.id;
            this.titleInput.value = note.title;
            this.quill.setContents(note.content);
            this.saveStatus.textContent = 'Saved';
            this.updateStats();
            this.showEditor();
            this.refreshSidebar();
        }
    }

    async saveCurrentNote() {
        if (!this.currentNoteId) return; // Not in editor mode

        const title = this.titleInput.value.trim() || this.generateAutoTitle();
        // Update input visually if un-titled
        if (!this.titleInput.value.trim() && title !== 'Untitled Document') {
            this.titleInput.value = title;
        }

        const note = {
            id: this.currentNoteId,
            title: title || 'Untitled Document',
            content: this.quill.getContents(), // Delta format
            plainText: this.quill.getText(),
            updatedAt: Date.now()
        };

        try {
            this.saveStatus.textContent = 'Saving...';
            await window.storageManager.saveNote(note);
            this.saveStatus.textContent = 'Saved';
            this.refreshSidebar();
        } catch (e) {
            this.saveStatus.textContent = 'Save Failed';
            console.error(e);
        }
    }

    autoSave() {
        if (this.editorView.classList.contains('active') && this.saveStatus.textContent !== 'Saved') {
            this.saveCurrentNote();
        }
    }

    async deleteCurrentNote() {
        if (confirm('Are you sure you want to delete this note?')) {
            await window.storageManager.deleteNote(this.currentNoteId);
            this.currentNoteId = null;
            this.showDashboard();
        }
    }

    // --- UI Helpers ---

    markUnsaved() {
        this.saveStatus.textContent = 'Unsaved UI changes';
    }

    updateStats() {
        const text = this.quill.getText().trim();
        const charCount = text.length;
        const wordCount = text.length > 0 ? text.split(/\s+/).length : 0;

        document.getElementById('char-count').textContent = `${charCount} characters`;
        document.getElementById('word-count').textContent = `${wordCount} words`;
    }

    generateAutoTitle() {
        const firstLine = this.quill.getText().split('\n')[0].trim();
        if (firstLine && firstLine.length > 0) {
            return firstLine.substring(0, 30) + (firstLine.length > 30 ? '...' : '');
        }
        return 'Untitled Document';
    }

    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    // --- Rendering ---

    async loadDashboard() {
        const notes = await window.storageManager.getAllNotes();
        this.renderNotesGrid(notes);
    }

    async refreshSidebar() {
        const notes = await window.storageManager.getAllNotes();
        this.sidebarNotesList.innerHTML = '';

        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = `sidebar-note-item ${note.id === this.currentNoteId ? 'active' : ''}`;
            div.innerHTML = `
                <div class="sidebar-note-item-title">${note.title}</div>
                <div class="sidebar-note-item-date">${this.formatDate(note.updatedAt)}</div>
            `;
            div.addEventListener('click', () => {
                if (this.currentNoteId !== note.id) {
                    this.saveCurrentNote();
                    this.openNote(note.id);
                }
            });
            this.sidebarNotesList.appendChild(div);
        });
    }

    renderNotesGrid(notes) {
        this.notesGrid.innerHTML = '';

        if (notes.length === 0) {
            this.notesGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="ph ph-file-text" style="font-size: 3rem; margin-bottom: 16px;"></i>
                    <p>No notes found. Create your first secure note!</p>
                </div>
            `;
            return;
        }

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card glass-panel';

            // Extract a preview snipped
            let preview = note.plainText || '';
            if (preview.length > 150) preview = preview.substring(0, 150) + '...';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h3 class="note-card-title">${note.title}</h3>
                    <button class="icon-btn danger-icon-btn delete-card-btn" data-id="${note.id}" style="width: 32px; height: 32px; flex-shrink: 0;" title="Delete Chat">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
                <div class="note-card-preview" style="cursor: pointer; margin-top: 8px;">${preview}</div>
                <div class="note-card-meta" style="cursor: pointer;">
                    <span>${this.formatDate(note.updatedAt)}</span>
                </div>
            `;

            card.querySelector('.note-card-preview').addEventListener('click', () => this.openNote(note.id));
            card.querySelector('.note-card-meta').addEventListener('click', () => this.openNote(note.id));
            card.querySelector('h3').addEventListener('click', () => this.openNote(note.id));
            card.querySelector('.delete-card-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this chat forever?')) {
                    // Visually remove instantly for perfect responsiveness
                    card.remove();

                    await window.storageManager.deleteNote(note.id);
                    this.loadDashboard();
                    this.refreshSidebar();
                }
            });

            this.notesGrid.appendChild(card);
        });
    }

    async filterNotes(query) {
        const allNotes = await window.storageManager.getAllNotes();
        if (!query.trim()) {
            this.renderNotesGrid(allNotes);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const filtered = allNotes.filter(note =>
            note.title.toLowerCase().includes(lowerQuery) ||
            (note.plainText && note.plainText.toLowerCase().includes(lowerQuery))
        );
        this.renderNotesGrid(filtered);
    }
}

// Ensure execution after auth
window.editorManager = new EditorManager();
