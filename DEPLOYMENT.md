# Deployment Instructions (Vercel)

To deploy this app to Vercel and make it work correctly, you need to set up the following Environment Variables in your Vercel Project Settings:

1. **GEMINI_API_KEY**: 
   - Get this from [Google AI Studio](https://aistudio.google.com/app/apikey).
   - This is required for the "Image to Prompt" tool.

2. **APP_URL**:
   - Set this to your Vercel deployment URL (e.g., `https://your-app-name.vercel.app`).
   - This is required for the "Image to URL" tool to generate working links.

3. **SESSION_SECRET**:
   - Set this to any long random string (e.g., `a-very-secret-random-string-123`).
   - This is used to secure your app's sessions.

### How to add them on Vercel:
1. Go to your Project on Vercel.
2. Click on **Settings** -> **Environment Variables**.
3. Add each of the keys above with their respective values.
4. Redeploy your app.
