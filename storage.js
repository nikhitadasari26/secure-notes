/**
 * Storage Manager
 * Handles IndexedDB operations and file import/export
 */

class StorageManager {
    constructor() {
        this.dbName = 'SecureNotesDB';
        this.dbVersion = 1;
        this.storeName = 'notes';
        this.db = null;
        this.initPromise = this.initDB();
    }

    generateUUID() {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error("Database error: ", event.target.error);
                reject("Database error");
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    // keyPath 'id' will be a timestamp or unique string
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };
        });
    }

    async syncFromSupabase() {
        try {
            console.log("Starting initial sync from Supabase via Vercel Proxy...");
            const response = await fetch('/api/supabase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync' })
            });
            const { data, error } = await response.json();
            if (error) {
                console.error("Supabase sync fetch error:", error);
                return;
            }
            if (data && data.length > 0) {
                await this.initPromise;
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction([this.storeName], 'readwrite');
                    const store = transaction.objectStore(this.storeName);

                    data.forEach(remoteNote => {
                        let parsedContent = '';
                        try {
                            parsedContent = typeof remoteNote.content === 'string' ? JSON.parse(remoteNote.content) : remoteNote.content;
                        } catch (e) {
                            parsedContent = [{ insert: remoteNote.content || '\n' }];
                        }

                        const localNote = {
                            id: remoteNote.id,
                            title: remoteNote.title || 'Untitled Document',
                            content: parsedContent,
                            plainText: typeof remoteNote.content === 'string' ? remoteNote.content.substring(0, 150) : '',
                            createdAt: remoteNote.created_at ? new Date(remoteNote.created_at).getTime() : Date.now(),
                            updatedAt: remoteNote.created_at ? new Date(remoteNote.created_at).getTime() : Date.now()
                        };
                        store.put(localNote); // Updates existing or inserts new
                    });

                    transaction.oncomplete = () => {
                        console.log("Supabase sync to IndexedDB completed.");
                        resolve();
                    };
                    transaction.onerror = (e) => reject(e.target.error);
                });
            }
        } catch (e) {
            console.error("Supabase initial sync failed:", e);
        }
    }

    async saveNote(note) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            // Ensure updatedAt is current
            if (!note.createdAt) note.createdAt = Date.now();
            note.updatedAt = Date.now();

            const request = store.put(note);

            request.onsuccess = () => {
                // Background Sync to Supabase Permanent Storage (Fire and Forget) via Proxy
                fetch('/api/supabase', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'save',
                        payload: {
                            id: note.id,
                            title: note.title,
                            content: JSON.stringify(note.content),
                            created_at: new Date(note.createdAt).toISOString()
                        }
                    })
                })
                    .then(res => res.json())
                    .then(({ error }) => {
                        if (error) console.warn("Supabase Sync Failed:", error);
                    })
                    .catch(e => {
                        console.warn("Supabase Sync Network Error:", e);
                    });

                resolve(note);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getNote(id) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllNotes() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                // Sort by updatedAt descending
                const notes = request.result.sort((a, b) => b.updatedAt - a.updatedAt);
                resolve(notes);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteNote(id) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                fetch('/api/supabase', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'delete',
                        payload: { id: id }
                    })
                })
                    .then(res => res.json())
                    .then(({ error }) => {
                        if (error) console.warn("Supabase Delete Sync Failed:", error);
                    })
                    .catch(e => {
                        console.warn("Supabase Delete Sync Network Error:", e);
                    });

                resolve(true);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- Export / Import Helpers ---

    exportTxt(title, textContent) {
        this.downloadFile(`${title || 'Untitled_Document'}.txt`, textContent, 'text/plain');
    }

    exportHtml(title, htmlContent) {
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        body { font-family: 'Arial', sans-serif; line-height: 1.6; padding: 2rem; max-width: 800px; margin: 0 auto; }
        img { max-width: 100%; }
        blockquote { border-left: 4px solid #ccc; padding-left: 1rem; color: #666; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${htmlContent}
</body>
</html>`;
        this.downloadFile(`${title || 'Untitled_Document'}.html`, fullHtml, 'text/html');
    }

    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Global instance
window.storageManager = new StorageManager();
