import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    try {
        const parser = new PostalMime();
        const rawEmail = await new Response(message.raw).arrayBuffer();
        const email = await parser.parse(rawEmail);

        const targetUrl = env.WEBHOOK_URL;
        const forwardDomains = (env.FORWARD_DOMAINS || '')
          .split(',')
          .map((domain) => domain.trim().toLowerCase())
          .filter(Boolean);
        const forwardEmail = env.FORWARD_EMAIL;

        const parsedFromAddress = email?.from?.value?.[0]?.address;
        const parsedFromName = email?.from?.value?.[0]?.name;
        const parsedFromText = email?.from?.text || message.headers.get('from');
        const fallbackFromName = parsedFromAddress
          ? parsedFromAddress.split('@').pop()?.replace(/^mail\./, '')
          : undefined;
        const parsedFrom =
          parsedFromName && parsedFromAddress
            ? `${parsedFromName} <${parsedFromAddress}>`
            : parsedFromName ||
              parsedFromText ||
              fallbackFromName ||
              parsedFromAddress ||
              message.from;

        const recipients = Array.isArray(message.to) ? message.to : [message.to];
        const shouldForward =
          Boolean(forwardEmail) &&
          forwardDomains.length > 0 &&
          recipients.some((recipient) => {
            const domain = recipient?.split('@').pop()?.toLowerCase();
            return domain && forwardDomains.includes(domain);
          });

        if (shouldForward) {
          await message.forward(forwardEmail);
        }

        if (!targetUrl) {
          console.warn('WEBHOOK_URL is not set; skipping webhook forwarding.');
          return;
        }

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: parsedFrom,
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
