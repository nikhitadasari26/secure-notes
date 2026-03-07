export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return res.status(500).json({ error: 'Missing Supabase environment variables in Vercel.' });
    }

    const { action, payload } = req.body;

    // Standard Supabase REST API Headers
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
    };

    try {
        if (action === 'sync') {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/simple_notes?select=*`, {
                method: 'GET',
                headers
            });
            const data = await response.json();
            return res.status(response.status).json({ data, error: response.ok ? null : data });
        }
        else if (action === 'save') {
            // For UPSERT, we use POST with Prefer: resolution=merge-duplicates
            const saveHeaders = { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' };
            const response = await fetch(`${SUPABASE_URL}/rest/v1/simple_notes`, {
                method: 'POST',
                headers: saveHeaders,
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            return res.status(response.status).json({ data, error: response.ok ? null : data });
        }
        else if (action === 'delete') {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/simple_notes?id=eq.${payload.id}`, {
                method: 'DELETE',
                headers
            });
            return res.status(response.status).json({ data: null, error: response.ok ? null : 'Delete failed' });
        }
        else {
            return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
