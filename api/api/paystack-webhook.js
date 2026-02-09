import { buffer } from 'micro';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false, // Paystack needs raw body
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const buf = await buffer(req);
    const signature = req.headers['x-paystack-signature'];

    const secret = process.env.PAYSTACK_SECRET;
    const hash = crypto.createHmac('sha512', secret).update(buf).digest('hex');

    if (hash === signature) {
      const event = JSON.parse(buf.toString());
      // Example: event.event = "subscription.create" or "subscription.disable"
      console.log('Webhook event:', event);

      // Handle subscription status
      const customerEmail = event.data.customer.email;
      const status = event.data.status; // active, cancelled, etc.

      // Save subscription status in Firebase Realtime Database
      const { initializeApp } = await import('firebase/app');
      const { getDatabase, ref, update } = await import('firebase/database');

      const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.FIREBASE_DB_URL,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MSG_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
      };

      const app = initializeApp(firebaseConfig);
      const db = getDatabase(app);

      // Update user subscription status
      await update(ref(db, `users/${customerEmail}/subscription`), { status });

      return res.status(200).send('Webhook received');
    } else {
      return res.status(400).send('Invalid signature');
    }
  } else {
    res.status(405).send('Method not allowed');
  }
}
