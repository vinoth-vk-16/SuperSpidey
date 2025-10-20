import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { generateEmailDraft, improveEmail } from "./services/gemini";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import { readFileSync } from "fs";
import { join } from "path";
import { google } from "googleapis";

// Configure Passport Google OAuth Strategy
let googleConfig: any = {};

try {
  // Try to load from environment variable first
  if (process.env.VITE_GOOGLE_CRED) {
    const googleCredentials = JSON.parse(process.env.VITE_GOOGLE_CRED);
    googleConfig = googleCredentials.web || {};
  } else {
    // Try to load from client/.env file
    const envPath = join(process.cwd(), "client", ".env");
    const envContent = readFileSync(envPath, "utf-8");
    const envMatch = envContent.match(/VITE_GOOGLE_CRED=(.+)/);
    if (envMatch) {
      const googleCredentials = JSON.parse(envMatch[1]);
      googleConfig = googleCredentials.web || {};
    } else {
      throw new Error("VITE_GOOGLE_CRED not found in client/.env");
    }
  }
} catch (error) {
  console.error("Failed to load Google OAuth credentials:", error);
  // Fallback to the JSON file
  try {
    const credentialsPath = join(process.cwd(), "OAuth Client ID Contact Remedy.json");
    const googleCredentials = JSON.parse(readFileSync(credentialsPath, "utf-8"));
    googleConfig = googleCredentials.web || {};
  } catch (fallbackError) {
    console.error("Fallback also failed:", fallbackError);
    // Try the new file name
    try {
      const credentialsPath = join(process.cwd(), "Client ID for Contact Remedy.json");
      const googleCredentials = JSON.parse(readFileSync(credentialsPath, "utf-8"));
      googleConfig = googleCredentials.web || {};
    } catch (finalError) {
      console.error("Final fallback failed:", finalError);
      throw new Error("Google OAuth credentials not found. Please ensure VITE_GOOGLE_CRED is set in environment or Client ID for Contact Remedy.json exists.");
    }
  }
}

console.log("Google OAuth Config:", {
  clientID: googleConfig.client_id,
  clientSecret: googleConfig.client_secret ? '***' : 'NOT_SET',
  callbackURL: googleConfig.redirect_uris?.[1] || "http://localhost:5000/auth/google/callback"
});

passport.use(new (GoogleStrategy as any)({
  clientID: googleConfig.client_id,
  clientSecret: googleConfig.client_secret,
  callbackURL: googleConfig.redirect_uris?.[1] || "http://localhost:5000/auth/google/callback"
}, (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void) => {
  console.log("OAuth callback received profile:", profile.displayName, profile.emails?.[0]?.value);
  // Store access and refresh tokens for Gmail API access
  return done(null, {
    id: profile.id,
    email: profile.emails?.[0]?.value,
    name: profile.displayName,
    picture: profile.photos?.[0]?.value,
    accessToken,
    refreshToken
  });
}));

passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export async function registerRoutes(app: Express): Promise<Server> {

  // CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5000');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Configure session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // Authentication routes
  app.get('/auth/google',
    passport.authenticate('google', {
      scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.readonly'
      ],
      accessType: 'offline',  // Always request refresh token
      prompt: 'consent'       // Force consent screen to ensure refresh token
    })
  );

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    async (req, res) => {
      console.log("Authentication successful, user:", req.user);

      try {
        const user = req.user as any;

        // Only store OAuth credentials if we have both access and refresh tokens
        if (user.accessToken && user.refreshToken) {
          console.log('Storing OAuth credentials for user:', user.email);

          // Store OAuth credentials in Firestore via the OAuth storage service
          const storeAuthResponse = await fetch('http://localhost:8000/store-auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_email: user.email,
              oauth_token: user.accessToken,
              refresh_token: user.refreshToken,
            }),
          });

          if (!storeAuthResponse.ok) {
            console.error('Failed to store OAuth credentials:', await storeAuthResponse.text());
            // Continue with authentication even if storage fails
          } else {
            console.log('OAuth credentials stored successfully for user:', user.email);

            // Start Gmail watch for real-time notifications
            try {
              console.log('Starting Gmail watch for user:', user.email);
              const startWatchResponse = await fetch('http://localhost:8001/start-watch', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  user_email: user.email,
                  access_token: user.accessToken,
                }),
              });

              if (!startWatchResponse.ok) {
                console.error('Failed to start Gmail watch:', await startWatchResponse.text());
                // Continue with authentication even if watch fails
              } else {
                const watchData = await startWatchResponse.json();
                console.log('Gmail watch started successfully for user:', user.email, 'History ID:', watchData.data?.history_id);
              }
            } catch (watchError) {
              console.error('Error starting Gmail watch:', watchError);
              // Continue with authentication even if watch fails
            }
          }
        } else {
          console.log('Skipping OAuth storage - missing tokens. AccessToken:', !!user.accessToken, 'RefreshToken:', !!user.refreshToken);
        }
      } catch (error) {
        console.error('Error storing OAuth credentials:', error);
        // Continue with authentication even if storage fails
      }

      // Successful authentication, redirect to home
      res.redirect('/');
    }
  );

  app.get('/auth/logout', (req, res) => {
    req.logout((err: any) => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.redirect('/login');
    });
  });

  app.get('/api/auth/status', (req, res) => {
    console.log("Auth status check - isAuthenticated:", req.isAuthenticated(), "user:", req.user);
    if (req.isAuthenticated()) {
      res.json({ authenticated: true, user: req.user });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ error: 'Authentication required' });
  };

  // Gmail API endpoints
  app.post('/api/gmail/send', requireAuth, async (req, res) => {
    try {
      const { to, subject, body } = z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1)
      }).parse(req.body);

      const user = req.user as any;
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: user.accessToken,
        refresh_token: user.refreshToken
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Convert plain text to HTML with proper formatting
      const formatEmailBody = (text: string): string => {
        // Split by double newlines for paragraphs, single newlines for line breaks
        const htmlBody = text
          .split('\n\n') // Split paragraphs
          .map(paragraph =>
            paragraph
              .split('\n') // Split lines within paragraph
              .map(line => line.trim())
              .filter(line => line.length > 0)
              .join('<br>')
          )
          .filter(paragraph => paragraph.length > 0)
          .map(paragraph => `<p style="margin: 0 0 1em 0; line-height: 1.5;">${paragraph}</p>`)
          .join('');

        // Wrap in a styled container
        return `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
            ${htmlBody}
          </div>
        `.trim();
      };

      const formattedBody = formatEmailBody(body);

      // Create email with custom header
      const email = [
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `To: ${to}`,
        `From: ${user.email}`,
        `Subject: ${subject}`,
        'X-MyApp-ID: ContactSpidey',
        '',
        formattedBody
      ].join('\r\n');

      console.log('Sending email with headers:', {
        to,
        from: user.email,
        subject,
        customHeader: 'X-MyApp-ID: ContactSpidey',
        originalBody: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
        formattedBody: formattedBody.substring(0, 100) + (formattedBody.length > 100 ? '...' : '')
      });

      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });

      console.log('Email sent successfully with ID:', result.data.id);

      // Let's also fetch the message to verify headers
      try {
        const sentMessage = await gmail.users.messages.get({
          userId: 'me',
          id: result.data.id!,
          format: 'metadata',
          metadataHeaders: ['X-MyApp-ID', 'Subject', 'From', 'To']
        });

        const headers = sentMessage.data.payload?.headers || [];
        console.log('Sent message headers:', headers.map(h => `${h.name}: ${h.value}`));
      } catch (error) {
        console.error('Error verifying sent message headers:', error);
      }

      res.json({ messageId: result.data.id, success: true });
    } catch (error: any) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  app.get('/api/gmail/messages', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: user.accessToken,
        refresh_token: user.refreshToken
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const messages = [];

      // Method 1: Search for messages in SENT folder with our custom header
      try {
        console.log('Searching for sent messages with custom header...');
        const sentResponse = await gmail.users.messages.list({
          userId: 'me',
          q: 'X-MyApp-ID:ContactSpidey in:sent',
          maxResults: 50
        });

        const sentMessages = sentResponse.data.messages || [];
        console.log(`Found ${sentMessages.length} sent messages with custom header`);

        for (const msg of sentMessages) {
          const messageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'full'
          });

          const message = messageResponse.data;
          const payload = message.payload!;
          let body = '';

          if (payload.body?.data) {
            body = Buffer.from(payload.body.data, 'base64').toString();
          } else if (payload.parts) {
            for (const part of payload.parts) {
              if (part.mimeType === 'text/plain' && part.body?.data) {
                body = Buffer.from(part.body.data, 'base64').toString();
                break;
              } else if (part.mimeType === 'text/html' && part.body?.data) {
                body = Buffer.from(part.body.data, 'base64').toString();
                break;
              }
            }
          }

          const headers = payload.headers || [];
          const subject = headers.find(h => h.name === 'Subject')?.value || '';
          const from = headers.find(h => h.name === 'From')?.value || '';
          const to = headers.find(h => h.name === 'To')?.value || '';
          const date = headers.find(h => h.name === 'Date')?.value || '';

          messages.push({
            id: message.id,
            threadId: message.threadId,
            subject,
            from,
            to,
            date,
            body: body.substring(0, 500) + (body.length > 500 ? '...' : ''),
            snippet: message.snippet,
            labelIds: message.labelIds
          });
        }
      } catch (error) {
        console.error('Error fetching sent messages:', error);
      }

      // Method 2: Check recent sent messages directly (bypass search)
      if (messages.length === 0) {
        try {
          console.log('Fallback 1: Checking recent sent messages directly...');
          const sentResponse = await gmail.users.messages.list({
            userId: 'me',
            labelIds: ['SENT'],
            maxResults: 10
          });

          const recentSent = sentResponse.data.messages || [];
          console.log(`Found ${recentSent.length} recent sent messages`);

          for (const msg of recentSent) {
            const messageResponse = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id!,
              format: 'full'
            });

            const message = messageResponse.data;
            const payload = message.payload!;
            const headers = payload.headers || [];

            // Check if this message has our custom header
            const hasCustomHeader = headers.some(h => h.name === 'X-MyApp-ID' && h.value === 'ContactSpidey');
            console.log(`Message ${msg.id}: has custom header = ${hasCustomHeader}`);

            if (hasCustomHeader) {
              let body = '';

              if (payload.body?.data) {
                body = Buffer.from(payload.body.data, 'base64').toString();
              } else if (payload.parts) {
                for (const part of payload.parts) {
                  if (part.mimeType === 'text/plain' && part.body?.data) {
                    body = Buffer.from(part.body.data, 'base64').toString();
                    break;
                  } else if (part.mimeType === 'text/html' && part.body?.data) {
                    body = Buffer.from(part.body.data, 'base64').toString();
                    break;
                  }
                }
              }

              const subject = headers.find(h => h.name === 'Subject')?.value || '';
              const from = headers.find(h => h.name === 'From')?.value || '';
              const to = headers.find(h => h.name === 'To')?.value || '';
              const date = headers.find(h => h.name === 'Date')?.value || '';

              messages.push({
                id: message.id,
                threadId: message.threadId,
                subject,
                from,
                to,
                date,
                body: body.substring(0, 500) + (body.length > 500 ? '...' : ''),
                snippet: message.snippet,
                labelIds: message.labelIds
              });
            }
          }
        } catch (error) {
          console.error('Error checking recent sent messages:', error);
        }
      }

      // Method 3: Also check for any messages with our header (original fallback)
      if (messages.length === 0) {
        try {
          console.log('Fallback 2: Searching for any messages with custom header...');
          const allResponse = await gmail.users.messages.list({
            userId: 'me',
            q: 'X-MyApp-ID:ContactSpidey',
            maxResults: 20
          });

          const allMessages = allResponse.data.messages || [];
          console.log(`Found ${allMessages.length} total messages with custom header`);

          for (const msg of allMessages) {
            const messageResponse = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id!,
              format: 'metadata',
              metadataHeaders: ['Subject', 'From', 'To', 'Date']
            });

            const message = messageResponse.data;
            const payload = message.payload!;
            const headers = payload.headers || [];

            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const from = headers.find(h => h.name === 'From')?.value || '';
            const to = headers.find(h => h.name === 'To')?.value || '';
            const date = headers.find(h => h.name === 'Date')?.value || '';

            // Skip if we already have this message
            if (!messages.find(m => m.id === message.id)) {
              messages.push({
                id: message.id,
                threadId: message.threadId,
                subject,
                from,
                to,
                date,
                body: message.snippet || '',
                snippet: message.snippet,
                labelIds: message.labelIds
              });
            }
          }
        } catch (error) {
          console.error('Error in fallback search:', error);
        }
      }

      // Sort by date (newest first)
      messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      console.log(`Returning ${messages.length} messages`);
      res.json({ messages });
    } catch (error: any) {
      console.error('Error fetching emails:', error);
      res.status(500).json({ error: 'Failed to fetch emails' });
    }
  });

  // Generate email draft using AI
  app.post("/api/generate-draft", requireAuth, async (req, res) => {
    try {
      const { prompt, apiKey } = z.object({
        prompt: z.string().min(1),
        apiKey: z.string().min(1)
      }).parse(req.body);
      
      const { subject, body } = await generateEmailDraft(prompt, apiKey);
      res.json({ subject, body });
    } catch (error: any) {
      console.error("Error generating draft:", error);
      
      // Check for API key related errors
      if (error?.message?.includes("API key not valid") || 
          error?.message?.includes("API_KEY_INVALID") ||
          error?.message?.includes("not valid")) {
        return res.status(400).json({ 
          error: "Invalid API key. Please go to Settings and enter a valid Gemini API key." 
        });
      }
      
      // Check for quota/rate limit errors
      if (error?.message?.includes("quota") || error?.message?.includes("rate limit")) {
        return res.status(429).json({ 
          error: "API quota exceeded. Please check your Gemini API usage." 
        });
      }
      
      // Generic error
      res.status(500).json({ error: "Failed to generate email draft" });
    }
  });

  // Improve email using AI
  app.post("/api/improve-email", requireAuth, async (req, res) => {
    try {
      const { text, action, apiKey, customPrompt } = z.object({
        text: z.string().min(1),
        action: z.enum(["improve", "shorten", "lengthen", "fix-grammar", "simplify", "rewrite", "custom"]),
        apiKey: z.string().min(1),
        customPrompt: z.string().optional()
      }).parse(req.body);
      
      const improvedText = await improveEmail(text, action, apiKey, customPrompt);
      res.json({ improvedText });
    } catch (error: any) {
      console.error("Error improving email:", error);
      
      // Check for API key related errors
      if (error?.message?.includes("API key not valid") || 
          error?.message?.includes("API_KEY_INVALID") ||
          error?.message?.includes("not valid")) {
        return res.status(400).json({ 
          error: "Invalid API key. Please go to Settings and enter a valid Gemini API key." 
        });
      }
      
      // Check for quota/rate limit errors
      if (error?.message?.includes("quota") || error?.message?.includes("rate limit")) {
        return res.status(429).json({ 
          error: "API quota exceeded. Please check your Gemini API usage." 
        });
      }
      
      // Generic error
      res.status(500).json({ error: "Failed to improve email" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
