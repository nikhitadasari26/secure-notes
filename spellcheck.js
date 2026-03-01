/**
 * Spellcheck & Text Processing Module
 * Handles auto-capitalization and other text processing features
 */

class TextProcessor {
    constructor() {
        this.isProcessing = false;

        // Listen to custom editor events dispatched from editor.js
        document.addEventListener('editorTextChange', (e) => {
            this.handleTextChange(e.detail.quill);
        });
    }

    handleTextChange(quill) {
        // Prevent recursive triggers
        if (this.isProcessing) return;

        const selection = quill.getSelection();
        // Only process while actively typing (we have a valid selection)
        if (!selection) return;

        // Get the character just typed (immediately before cursor)
        const cursorPosition = selection.index;
        if (cursorPosition < 2) return; // Need at least two characters contexts

        const textBeforeCursor = quill.getText(cursorPosition - 2, 2);

        // Check for Auto-capitalization trigger
        // Pattern: Punctuation + Space -> Next Letter typed should be capitalized
        // Example textBeforeCursor: ". " or "? " or "! "

        // Let's get more context to see if they just typed a lowercase letter after a sentence boundary.
        const broaderContextLen = Math.min(3, cursorPosition);
        const textContext = quill.getText(cursorPosition - broaderContextLen, broaderContextLen);

        // Regex to match sentence end, space, and a lowercase character
        // [.!?,] + [\s] + [a-z]
        if (/[\.\!\?] [a-z]/.test(textContext)) {
            // Capitalize the last character typed
            const charToCap = textContext.charAt(2);

            this.isProcessing = true;
            // Delete the lowercase character, insert uppercase
            quill.deleteText(cursorPosition - 1, 1);
            quill.insertText(cursorPosition - 1, charToCap.toUpperCase());

            // Restore selection
            quill.setSelection(cursorPosition);
            this.isProcessing = false;
        }

        // Also handle Paragraph breaks (Enter key): "\n" followed by "a-z"
        if (/\n[a-z]/.test(textBeforeCursor)) {
            const charToCap = textBeforeCursor.charAt(1);

            this.isProcessing = true;
            quill.deleteText(cursorPosition - 1, 1);
            quill.insertText(cursorPosition - 1, charToCap.toUpperCase());
            quill.setSelection(cursorPosition);
            this.isProcessing = false;
        }

        // --- Autocorrect on Space ---
        const fetchLength = Math.min(20, cursorPosition);
        const stringBeforeCursor = quill.getText(cursorPosition - fetchLength, fetchLength);
        if (stringBeforeCursor.endsWith(' ')) {
            const words = stringBeforeCursor.trim().split(/\s+/);
            if (words.length > 0) {
                const lastWord = words[words.length - 1];

                // Common misspellings dictionary
                const corrections = {
                    'teh': 'the',
                    'dont': "don't",
                    'im': "I'm",
                    'u': 'you',
                    'thats': "that's",
                    'cant': "can't",
                    'alot': 'a lot',
                    'realy': 'really',
                    'beleive': 'believe',
                    'recieve': 'receive',
                    'seperate': 'separate',
                    'wierd': 'weird',
                    'definitly': 'definitely',
                    'untill': 'until'
                };

                const lowerWord = lastWord.toLowerCase();
                if (corrections[lowerWord]) {
                    const corrected = corrections[lowerWord];
                    const wordStart = cursorPosition - 1 - lastWord.length; // -1 for the space

                    this.isProcessing = true;
                    quill.deleteText(wordStart, lastWord.length);

                    // preserve original capitalization
                    const isCapitalized = lastWord.charAt(0) === lastWord.charAt(0).toUpperCase() && lastWord.charAt(0).match(/[a-z]/i);
                    let finalWord = corrected;
                    if (isCapitalized) {
                        finalWord = finalWord.charAt(0).toUpperCase() + finalWord.substring(1);
                    }

                    quill.insertText(wordStart, finalWord);
                    // Adjust cursor position to account for new word length vs old word length
                    quill.setSelection(cursorPosition + (finalWord.length - lastWord.length));
                    this.isProcessing = false;
                }
            }
        }
    }
}

// Initialize
window.textProcessor = new TextProcessor();
