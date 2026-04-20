# 🏗️ ConstructPro — Construction Workforce Manager

A full-featured, **free-forever** construction workforce management app.  
Runs on **GitHub Pages** + **Firebase** (Auth + Firestore — free tier).

---

## ✅ Features

| Feature | Details |
|---------|---------|
| 🔐 Google Login | Each account has completely isolated private data |
| 👷 Worker Profiles | Name, phone, NID, address, role, join date, wage rate, emergency contact, blood group |
| 📋 Daily Attendance | Present / Half-Day / Absent / Leave per worker per day |
| 💰 Advance Tracking | Record advance money given to each worker |
| 🧾 Expense Tracking | Record expense/material money given |
| 📊 Auto-Calculations | Days worked, gross wages, total advances, net payable — all auto-computed |
| 📈 Monthly Reports | Per-worker + totals, CSV export |
| 🔍 Search | Find workers by name (any language/script), role, phone, address |
| 📱 Mobile Responsive | Works on phone and tablet |

---

## 🚀 Setup Guide (15 minutes)

### STEP 1 — Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** → name it (e.g. `constructpro`)
3. Disable Google Analytics (not needed) → **Create project**

---

### STEP 2 — Enable Google Sign-In

1. In your Firebase project → left sidebar → **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in method** → click **Google** → **Enable** → Save
4. Go to **Settings tab** → **Authorized domains**
5. Add your GitHub Pages domain: `yourusername.github.io`

---

### STEP 3 — Create Firestore Database

1. Left sidebar → **Build → Firestore Database**
2. Click **"Create database"**
3. Select **"Start in production mode"** → Next
4. Choose a region close to you (e.g. `asia-south1` for Nepal/India) → **Enable**

---

### STEP 4 — Set Firestore Security Rules

1. In Firestore → click the **"Rules"** tab
2. Replace everything with these rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click **Publish**

> ✅ These rules ensure EVERY user can only access THEIR OWN data. Nobody else can see your records.

---

### STEP 5 — Get Your Firebase Config

1. In Firebase Console → top left gear icon → **Project settings**
2. Scroll down to **"Your apps"** section
3. Click the **"</>"** (Web) icon to add a web app
4. Give it any name (e.g. `constructpro-web`) → **Register app**
5. You'll see a config object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

6. Copy these values

---

### STEP 6 — Update app.js

Open `app.js` and replace the placeholder config at the top (lines 16–23):

```javascript
const firebaseConfig = {
  apiKey:            "PASTE_YOUR_API_KEY_HERE",
  authDomain:        "PASTE_YOUR_AUTH_DOMAIN_HERE",
  projectId:         "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket:     "PASTE_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID_HERE",
  appId:             "PASTE_YOUR_APP_ID_HERE"
};
```

> **Note:** Firebase API keys for web apps are safe to commit publicly.  
> Your Firestore Security Rules (Step 4) protect the actual data.

---

### STEP 7 — Change Currency Symbol (Optional)

In `app.js` line 28, change the currency:

```javascript
const CURRENCY = "Rs.";   // Options: "Rs.", "₹", "NPR", "$", "£", etc.
```

---

### STEP 8 — Deploy to GitHub Pages

**Option A — GitHub Web Interface:**
1. Create a new GitHub repository (e.g. `constructpro`)
2. Upload these 3 files: `index.html`, `style.css`, `app.js`
3. Go to **Settings → Pages**
4. Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)` → Save
5. Wait ~1 minute → your site is live at `https://yourusername.github.io/constructpro`

**Option B — Git CLI:**
```bash
git init
git add .
git commit -m "Initial deploy"
git remote add origin https://github.com/yourusername/constructpro.git
git push -u origin main
# Then enable Pages in GitHub Settings
```

---

### STEP 9 — Add GitHub Pages Domain to Firebase

1. Back in Firebase → **Authentication → Settings → Authorized domains**
2. Add: `yourusername.github.io`

> Without this, Google Sign-In will be blocked.

---

## 💰 Cost — Free Forever

| Service | Free Tier Limit | Your Usage |
|---------|----------------|------------|
| Firebase Auth | 50,000 users/month | ✅ Way under |
| Firestore reads | 50,000/day | ✅ ~500 workers × 30 days = fine |
| Firestore writes | 20,000/day | ✅ ~30-50/day typical |
| Firestore storage | 1 GB | ✅ Years of data fits in MBs |
| GitHub Pages | Unlimited static hosting | ✅ Free |

---

## 📁 File Structure

```
constructpro/
├── index.html   — App structure, all HTML screens
├── style.css    — Dark minimal dashboard theme
├── app.js       — All logic: Firebase, CRUD, UI rendering
└── README.md    — This file
```

---

## 🔧 Firestore Index (if needed)

If you see a console error about missing Firestore index, click the link in the error — Firebase will auto-create it for you.

Typical composite indexes needed:
- Collection: `records` — Fields: `workerId ASC`, `date ASC`

---

## 📊 Data Structure (Firestore)

```
users/
  {uid}/
    workers/
      {workerId}/
        name, phone, nid, address, role, joinDate,
        wageRate, status, emergencyName, emergencyPhone,
        emergencyRelation, bloodGroup, notes, createdAt

    records/
      {date}_{workerId}/
        workerId, date, attendance (P/H/A/L),
        advance, expense, notes, leaveType
```

---

## ❓ FAQ

**Q: Can multiple people use the same site?**  
A: Yes! Everyone signs in with their own Google account and sees only their own data.

**Q: Can I use Nepali/Hindi names for workers?**  
A: Yes! Any Unicode text works. Search also works in any language.

**Q: What does "Net Payable" mean?**  
A: `Net Payable = Gross Wages − Advances Given`. Expenses are tracked separately.

**Q: How do I reset/start fresh?**  
A: Go to Firebase Console → Firestore → delete your user document to clear all data.

---

## 🆘 Troubleshooting

| Problem | Fix |
|---------|-----|
| "auth/unauthorized-domain" | Add your GitHub Pages URL to Firebase Auth > Authorized Domains |
| Blank page after login | Check browser console for Firebase config errors |
| "Missing index" error | Click the link in the error to auto-create the index |
| Can't sign in popup blocked | Allow popups for the site in your browser |

---

*Built with ❤️ using Firebase + Vanilla JS — no frameworks, no build step, runs anywhere.*
