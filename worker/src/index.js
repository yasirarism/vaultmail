import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    try {
        const parser = new PostalMime();
        const email = await parser.parse(message.raw);
        
        // Replace with your actual Vercel app URL
        // If testing locally, you'd need a tunnel (ngrok). For prod, use your vercel.app domain.
        const TARGET_URL = 'https://your-project.vercel.app/api/webhook'; 

        const response = await fetch(TARGET_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: message.from,
            to: message.to,
            subject: message.headers.get('subject'),
            text: email.text,
            html: email.html
          })
        });

        if (!response.ok) {
            console.error(`Failed to forward email: ${response.status} ${response.statusText}`);
            message.setReject("Failed to forward email");
        }
    } catch (e) {
        console.error("Worker Error:", e);
        message.setReject("Internal Worker Error");
    }
  }
};
