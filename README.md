# Secure Notes (Local-First Application)

A lightning-fast, highly secure, purely client-side note-taking application. Features an offline-capable architecture with built-in PIN security, IndexedDB local persistence, custom spellchecking, and live Supabase cloud synchronization.

## 🚀 Features

* **Zero-Backend Architecture:** Runs entirely in the browser using HTML5, CSS3, and Vanilla JS.
* **Optimistic Local Storage:** Uses `IndexedDB` to save notes instantly locally, without waiting for network connectivity.
* **Automated Cloud Sync:** Background "Fire-and-Forget" synchronization to a connected Supabase database table.
* **PIN Authentication:** Browser's Web Crypto API securely hashes and locks access via a custom 4-digit PIN.
* **Auto-Correction Engine:** Client-side custom spellchecking triggered dynamically on spacebar press.
* **Client-Side AI Integration:** Serverless connection directly to Google's Gemini SDK for Summarization and Grammar fixing.
* **Dark Mode & Glassmorphism:** Variables-driven CSS for high-fidelity UI rendering.

## 📁 File Structure

The project is built to be a simple, static distribution:

```text
secure-notes/
├── index.html       # The main skeleton of the app (Auth, Dashboard, Editor, Modals)
├── styles.css       # The design system (Glassmorphism, Dark Mode, Animations)
├── auth.js          # Security logic, Settings Manager, and PIN verification
├── editor.js        # Core logic (Quill.js integration, Save/Delete/Export routines)
├── spellcheck.js    # Typing logic (Real-time auto-punctuation and autocorrection)
├── storage.js       # Database logic (IndexedDB local saves + Supabase cloud syncing)
└── ai.js            # Serverless Gemini API integration
```

## 🛠 Setup & Usage

Because this is a vanilla client-side application without a Node.js compiler, **there is no `.env` file required!**

1. Clone the repository.
2. Serve the directory using any static web server (e.g. `npx serve -p 3000` or `python -m http.server`).
3. Open `http://localhost:3000` in your browser.
4. Click the **Gear ⚙️ Icon** to securely enter your API Keys.

### Why no `.env` file?
Environment variables (`.env`) only work on a secure backend server (like Node.js) or through a bundler (like React/Vite). Since this app runs entirely directly in the user's browser for maximum privacy and offline capability, it cannot read a hidden `.env` file from the hard drive. 

Instead, credentials are submitted via the UI's **Settings Modal** and stored permanently in the browser's encrypted `localStorage`. That means the user only ever has to enter their keys **once**—the browser remembers them forever on that computer.
