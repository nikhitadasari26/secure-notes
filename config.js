/**
 * Global Application Configuration (Vercel Serverless Architecture)
 * 
 * IMPORTANT SECURITY NOTICE:
 * Because this codebase is now public, DO NOT write your API keys here!
 * Your keys are now 100% securely hidden inside Vercel Serverless Functions.
 * 
 * To make the website work:
 * Go to Vercel -> Your Project -> Settings -> Environment Variables
 * Add these 3 variables exactly as spelled:
 * 1. SUPABASE_URL
 * 2. SUPABASE_ANON_KEY
 * 3. GEMINI_API_KEY
 */

window.APP_CONFIG = {
    // Keys are handled securely via Vercel /api proxy endpoints!
    MODE: 'serverless_proxy',
};
