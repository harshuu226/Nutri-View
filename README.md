# 🔬 Lens Nutrition App

> AI-powered food nutrition analysis using Gemini Vision + USDA FoodData Central

---

## 🗂️ Project Structure

```
lens-nutrition/
├── backend/
│   ├── config/
│   │   └── database.js          # MongoDB Atlas connection
│   ├── controllers/
│   │   ├── authController.js    # Register, login, JWT
│   │   ├── foodController.js    # Scan, history, dashboard
│   │   └── aiService.js         # Gemini Vision + USDA API
│   ├── middleware/
│   │   ├── auth.js              # JWT verification middleware
│   │   └── errorHandler.js      # Global error handler
│   ├── models/
│   │   ├── User.js              # User schema
│   │   └── FoodScan.js          # Nutrition scan schema
│   ├── routes/
│   │   ├── auth.js              # /api/auth/*
│   │   └── food.js              # /api/food/*
│   ├── .env.example
│   ├── package.json
│   └── server.js                # Express app entry
│
└── frontend/
    ├── src/
    │   ├── App.jsx              # Complete React single-file app
    │   └── main.jsx             # React entry point
    ├── index.html
    ├── vite.config.js
    ├── .env.example
    └── package.json
```

---

## ⚙️ Environment Variables Setup

### Backend `.env`

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/lens-nutrition
JWT_SECRET=your_super_long_random_secret_here
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=AIzaSy_your_key_here
USDA_API_KEY=your_usda_key_here
FRONTEND_URL=http://localhost:5173
```

### Frontend `.env`

```env
VITE_API_URL=http://localhost:5000/api
VITE_GEMINI_API_KEY=AIzaSy_your_key_here  # optional for frontend-only mode
```

---

## 🔑 Getting API Keys

### 1. Gemini API Key (Required)

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with Google account
3. Click **"Create API Key"**
4. Select or create a project
5. Copy the key starting with `AIzaSy...`
6. Add to `backend/.env` as `GEMINI_API_KEY=AIzaSy...`
7. Also add to `frontend/.env` as `VITE_GEMINI_API_KEY=AIzaSy...` (for direct frontend mode)

> 💡 Free tier: 15 requests/min, 1M tokens/day — more than enough for testing

### 2. USDA FoodData Central API Key (Optional but Recommended)

1. Go to [https://fdc.nal.usda.gov/api-guide.html](https://fdc.nal.usda.gov/api-guide.html)
2. Click **"Get an API Key"**
3. Enter your name and email address
4. Key will be sent to your email immediately
5. Add to `backend/.env` as `USDA_API_KEY=your_key`

> 💡 Free, no rate limits for reasonable usage. Provides USDA-verified macro data.

### 3. MongoDB Atlas (Required for backend)

1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free cluster (M0 Sandbox)
3. Click **"Connect"** → **"Drivers"**
4. Copy the connection string
5. Replace `<username>` and `<password>` in the URI
6. Add to `backend/.env` as `MONGODB_URI=...`

---

## 🚀 Local Development Setup

### Backend

```bash
cd backend
cp .env.example .env        # Fill in your keys
npm install
npm run dev                 # Runs on port 5000
```

### Frontend

```bash
cd frontend
cp .env.example .env        # Fill in your keys
npm install
npm run dev                 # Runs on port 5173
```

Visit `http://localhost:5173` in your browser.

---

## 📡 API Endpoints

### Auth Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Create account | ❌ |
| POST | `/api/auth/login` | Login, get JWT | ❌ |
| GET | `/api/auth/me` | Get current user | ✅ |
| PUT | `/api/auth/profile` | Update goals/profile | ✅ |

### Food Routes (all require JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/food/analyze` | Analyze food image (base64) |
| GET | `/api/food/history` | Paginated scan history |
| GET | `/api/food/daily-summary` | Today's nutrition totals |
| GET | `/api/food/weekly-stats` | 7-day chart data |
| GET | `/api/food/:id` | Single scan detail |
| DELETE | `/api/food/:id` | Delete a scan |

### Request Example

```json
POST /api/food/analyze
Authorization: Bearer <token>
Content-Type: application/json

{
  "imageData": "data:image/jpeg;base64,/9j/4AAQ...",
  "mimeType": "image/jpeg",
  "mealType": "lunch"
}
```

---

## 🗄️ MongoDB Schemas

### User Schema

```javascript
{
  name: String,           // Required, 2-50 chars
  email: String,          // Unique, required
  password: String,       // Bcrypt hashed, never returned
  goals: {
    dailyCalories: 2000,
    dailyProtein: 50,
    dailyCarbs: 250,
    dailyFat: 65
  },
  profile: {
    age, weight, height, activityLevel, dietaryPreferences
  }
}
```

### FoodScan Schema

```javascript
{
  userId: ObjectId,         // Ref to User
  foodName: String,
  foodDescription: String,
  imageData: String,        // Base64 thumbnail
  nutrition: {
    calories, protein, carbohydrates, fat, fiber, sugar, sodium, cholesterol,
    vitamins: { vitaminA, vitaminC, vitaminD, vitaminE, vitaminK, vitaminB12, folate },
    minerals: { calcium, iron, magnesium, potassium, zinc },
    dailyValues: { calories, protein, carbohydrates, fat, fiber, sodium }
  },
  healthScore: Number,      // 0-100
  tags: {
    isHighProtein, isLowCarb, isHighFat, isJunkFood, isVegan, isVegetarian, isGlutenFree
  },
  confidence: Number,       // AI confidence %
  aiSource: "gemini" | "usda" | "gemini_estimated",
  mealType: "breakfast" | "lunch" | "dinner" | "snack",
  scannedAt: Date
}
```

---

## 🛡️ Security Best Practices Implemented

1. **Helmet.js** — Sets 14 security HTTP headers automatically
2. **Rate Limiting** — 100 req/15min general, 20 scans/hour for AI endpoint
3. **JWT Auth** — Stateless, expires in 7 days, Bearer token
4. **Password Hashing** — bcryptjs with salt rounds 12
5. **Input Validation** — express-validator on all auth inputs
6. **CORS Whitelist** — Only specific origins allowed
7. **Body Size Limit** — 10MB max to prevent memory exhaustion
8. **Error Sanitization** — Stack traces never exposed in production
9. **MongoDB Injection** — Mongoose ORM prevents raw query injection
10. **Environment Variables** — All secrets in .env, never hardcoded

---

## ☁️ Deployment

### Backend → Render.com (Free Tier)

1. Push backend to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect GitHub repo, select `backend/` as root
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `node server.js`
6. Add all environment variables in the **Environment** tab:
   - `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `USDA_API_KEY`
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://your-app.vercel.app`
7. Deploy → Copy your Render URL (e.g. `https://lens-nutrition.onrender.com`)

### Frontend → Vercel

1. Push frontend to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your frontend repo
4. Add environment variables:
   - `VITE_API_URL=https://lens-nutrition.onrender.com/api`
   - `VITE_GEMINI_API_KEY=AIzaSy...` (optional)
5. Deploy → Your app is live! 🎉

### Vercel `vercel.json` (add to frontend root)

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## 🔧 Troubleshooting

| Issue | Fix |
|-------|-----|
| "Gemini API error" | Check GEMINI_API_KEY in .env |
| "MongoDB connection error" | Check MONGODB_URI, whitelist IP in Atlas (0.0.0.0/0) |
| CORS error | Add frontend URL to CORS allowedOrigins in server.js |
| Camera not working | Must use HTTPS (localhost is exception) |
| "Could not identify food" | Image too blurry or not food — try different angle |
| Rate limit hit | Wait 15 minutes or increase RATE_LIMIT_MAX_REQUESTS |

---

## 📦 Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Inline CSS (no Tailwind dependency needed) |
| Backend | Node.js + Express |
| Database | MongoDB Atlas + Mongoose |
| AI Vision | Google Gemini 1.5 Flash |
| Nutrition Data | USDA FoodData Central API |
| Auth | JWT + bcryptjs |
| Security | Helmet + express-rate-limit |
| Deployment | Vercel (FE) + Render (BE) |
