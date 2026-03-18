# 🚀 TASKLY BACKEND - COMPLETE SETUP GUIDE

## 📋 What You Built

A complete **Node.js + Express + MongoDB backend** with:
- ✅ User authentication (signup/login)
- ✅ JWT token-based authorization
- ✅ Password hashing with bcrypt
- ✅ Real login history tracking
- ✅ IP geolocation
- ✅ Device & browser detection
- ✅ RESTful API endpoints
- ✅ Input validation
- ✅ Error handling

---

## 🏗️ PROJECT STRUCTURE

```
taskly-backend/
├── models/
│   ├── User.js              # User schema & methods
│   └── LoginHistory.js      # Login history schema
├── routes/
│   ├── auth.js              # Authentication endpoints
│   └── history.js           # Login history endpoints
├── middleware/
│   └── auth.js              # JWT verification middleware
├── utils/
│   ├── jwt.js               # JWT token functions
│   └── deviceDetection.js  # Device/browser/location detection
├── server.js                # Main server file
├── package.json             # Dependencies
├── .env.example             # Environment variables template
└── .gitignore               # Git ignore rules
```

---

## 📦 STEP 1: INSTALL DEPENDENCIES

### **Prerequisites:**
- **Node.js** (v16 or higher) - Download from https://nodejs.org/
- **MongoDB** - Choose ONE option:

**Option A: MongoDB Atlas (Cloud - Recommended for beginners)**
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Create free account
3. Create a cluster (free tier)
4. Click "Connect" → "Connect your application"
5. Copy connection string

**Option B: Local MongoDB**
1. Download from https://www.mongodb.com/try/download/community
2. Install and start MongoDB service
3. Connection string: `mongodb://localhost:27017/taskly`

### **Install Backend Dependencies:**

```bash
# Navigate to backend folder
cd taskly-backend

# Install all packages
npm install
```

**Packages Installed:**
- `express` - Web framework
- `mongoose` - MongoDB ODM
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT tokens
- `cors` - Cross-origin requests
- `dotenv` - Environment variables
- `express-validator` - Input validation
- `geoip-lite` - IP geolocation
- `nodemon` - Auto-restart (dev only)

---

## ⚙️ STEP 2: CONFIGURE ENVIRONMENT

### **Create `.env` file:**

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

**Edit `.env` file:**

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/taskly
# OR for local:
# MONGODB_URI=mongodb://localhost:27017/taskly

# JWT Secret (CHANGE THIS!)
JWT_SECRET=your-super-secret-random-string-change-me-12345

# Server Port
PORT=5000

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Environment
NODE_ENV=development
```

**IMPORTANT:** 
- Replace `JWT_SECRET` with a random string (at least 32 characters)
- Update `MONGODB_URI` with your actual MongoDB connection string
- If using MongoDB Atlas, replace `username`, `password`, and `cluster` in the URI

### **Generate a Secure JWT Secret:**

```bash
# On Mac/Linux:
openssl rand -base64 32

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it as your `JWT_SECRET`.

---

## 🚀 STEP 3: START THE BACKEND

```bash
# Development mode (auto-restart on changes)
npm run dev

# OR Production mode
npm start
```

**You should see:**
```
✅ MongoDB connected successfully
🚀 Server running on port 5000
📍 API URL: http://localhost:5000
🌐 Environment: development
```

**Test it works:**
```bash
# In a new terminal:
curl http://localhost:5000/health
```

**Expected response:**
```json
{
  "success": true,
  "message": "Taskly API is running",
  "timestamp": "2024-02-12T10:30:00.000Z",
  "database": "connected"
}
```

---

## 📡 API ENDPOINTS

### **Authentication Endpoints**

#### **1. Sign Up**
```
POST /api/auth/signup
Content-Type: application/json

Body:
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}

Success Response (201):
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": "65abc123...",
      "name": "John Doe",
      "email": "john@example.com",
      "avatar": "https://ui-avatars.com/...",
      "createdAt": "2024-02-12T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}

Error Response (400):
{
  "success": false,
  "message": "Email already registered"
}
```

#### **2. Login**
```
POST /api/auth/login
Content-Type: application/json

Body:
{
  "email": "john@example.com",
  "password": "password123"
}

Success Response (200):
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}

Error Response (401):
{
  "success": false,
  "message": "Invalid email or password"
}
```

#### **3. Verify Token**
```
GET /api/auth/verify
Authorization: Bearer <token>

Success Response (200):
{
  "success": true,
  "data": {
    "user": { ... }
  }
}
```

---

### **Login History Endpoints**

#### **1. Get Login History**
```
GET /api/history?limit=50&page=1&status=success
Authorization: Bearer <token>

Query Parameters:
- limit: Number of entries per page (default: 50)
- page: Page number (default: 1)
- status: Filter by 'success' or 'failed' (optional)

Success Response (200):
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "65abc...",
        "email": "john@example.com",
        "status": "success",
        "timestamp": "2024-02-12T10:30:00.000Z",
        "device": "Desktop",
        "browser": "Chrome",
        "os": "Windows",
        "location": "Mumbai, Maharashtra, India",
        "ipAddress": "103.21.58.244",
        "failureReason": null
      },
      // ... more entries
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 50,
      "pages": 1
    }
  }
}
```

#### **2. Get Statistics**
```
GET /api/history/stats
Authorization: Bearer <token>

Success Response (200):
{
  "success": true,
  "data": {
    "totalLogins": 45,
    "successfulLogins": 42,
    "failedLogins": 3,
    "uniqueDevices": 3,
    "uniqueLocations": 2,
    "browsers": {
      "Chrome": 30,
      "Firefox": 10,
      "Safari": 5
    },
    "devices": {
      "Desktop": 35,
      "Mobile": 10
    },
    "recentActivity": [...]
  }
}
```

#### **3. Clear History**
```
DELETE /api/history
Authorization: Bearer <token>

Success Response (200):
{
  "success": true,
  "message": "Login history cleared successfully"
}
```

#### **4. Delete Single Entry**
```
DELETE /api/history/:id
Authorization: Bearer <token>

Success Response (200):
{
  "success": true,
  "message": "Login history entry deleted"
}
```

---

## 🧪 TESTING WITH POSTMAN/CURL

### **1. Test Signup:**

```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test1234"
  }'
```

### **2. Test Login:**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test1234"
  }'
```

**Save the token from response!**

### **3. Test Get History:**

```bash
curl -X GET http://localhost:5000/api/history \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🔐 SECURITY FEATURES

### **Password Hashing:**
- Uses bcrypt with 10 salt rounds
- Passwords never stored in plain text
- Automatic hashing before saving

### **JWT Tokens:**
- 7-day expiration
- Signed with secret key
- Verified on protected routes

### **Input Validation:**
- Email format validation
- Password strength requirements (min 8 chars, 1 number)
- Name length limits
- SQL injection prevention (Mongoose handles this)

### **Rate Limiting (Add in production):**
- Limit login attempts
- Prevent brute force attacks
- Use `express-rate-limit` package

---

## 🗄️ DATABASE SCHEMAS

### **User Schema:**
```javascript
{
  name: String (2-50 chars),
  email: String (unique, lowercase),
  password: String (hashed, 8+ chars),
  avatar: String (auto-generated),
  isEmailVerified: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```

### **LoginHistory Schema:**
```javascript
{
  user: ObjectId (ref: User),
  email: String,
  status: 'success' | 'failed',
  ipAddress: String,
  userAgent: String,
  device: 'Desktop' | 'Mobile' | 'Tablet',
  browser: String,
  os: String,
  location: {
    city: String,
    region: String,
    country: String,
    timezone: String,
    coordinates: { lat, lng }
  },
  failureReason: String (optional),
  timestamp: Date
}
```

---

## 🔧 HOW IT WORKS

### **Authentication Flow:**

```
1. User submits signup/login form
   ↓
2. Backend validates input (express-validator)
   ↓
3. For signup: Hash password → Create user → Generate JWT
   For login: Find user → Compare password → Generate JWT
   ↓
4. Create login history entry with:
   - IP address (from request)
   - Device type (parsed from user-agent)
   - Browser (parsed from user-agent)
   - Location (from IP geolocation)
   ↓
5. Return JWT token + user data
   ↓
6. Frontend stores token in localStorage
   ↓
7. Frontend includes token in Authorization header for protected requests
```

### **Device Detection:**
```javascript
User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

Parsed to:
- Device: Desktop (no mobile/tablet keywords)
- Browser: Chrome (contains "chrome")
- OS: Windows (contains "Windows NT 10.0")
```

### **IP Geolocation:**
```javascript
IP: 103.21.58.244
↓
geoip-lite lookup
↓
Result: {
  city: "Mumbai",
  region: "Maharashtra",
  country: "IN",
  timezone: "Asia/Kolkata",
  coordinates: { lat: 19.0144, lng: 72.8479 }
}
```

---

## 🐛 TROUBLESHOOTING

### **Problem: "MongoDB connection error"**
**Solution:**
- Check if MongoDB is running: `mongod` or check Atlas cluster status
- Verify connection string in `.env` is correct
- Check firewall allows connection
- For Atlas: Whitelist your IP address

### **Problem: "jwt malformed" error**
**Solution:**
- Check token is being sent correctly: `Bearer <token>`
- Verify JWT_SECRET matches between token creation and verification
- Token may be expired (7 days expiration)

### **Problem: "CORS error" in frontend**
**Solution:**
- Verify `FRONTEND_URL` in `.env` matches your frontend URL
- Check CORS middleware is configured in `server.js`
- Try: `FRONTEND_URL=http://localhost:5173` (no trailing slash)

### **Problem: "Port 5000 already in use"**
**Solution:**
- Change `PORT` in `.env` to different number (e.g., 5001)
- Or kill process using port 5000:
  ```bash
  # Mac/Linux:
  lsof -ti:5000 | xargs kill -9
  
  # Windows:
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  ```

---

## 📈 PRODUCTION DEPLOYMENT

### **Environment Variables for Production:**
```env
NODE_ENV=production
MONGODB_URI=<your-production-mongodb-uri>
JWT_SECRET=<strong-random-secret>
PORT=5000
FRONTEND_URL=https://your-frontend-domain.com
```

### **Recommended Hosting:**
- **Backend:** Railway, Render, Heroku, DigitalOcean
- **Database:** MongoDB Atlas (free tier available)

### **Production Checklist:**
- [ ] Use strong JWT_SECRET
- [ ] Enable HTTPS
- [ ] Add rate limiting
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Add request logging
- [ ] Implement email verification
- [ ] Add password reset
- [ ] Set up backups
- [ ] Use environment-specific configs
- [ ] Add health checks
- [ ] Implement graceful shutdown

---

## 📚 NEXT STEPS

### **Backend Enhancements:**
1. **Email Service:**
   - Email verification
   - Password reset emails
   - Login alerts for suspicious activity
   - Use: Nodemailer + SendGrid/Mailgun

2. **Advanced Security:**
   - Rate limiting (express-rate-limit)
   - CSRF protection
   - Helmet.js for headers
   - Request sanitization

3. **Better Error Handling:**
   - Custom error classes
   - Centralized error handler
   - Better error messages

4. **API Documentation:**
   - Swagger/OpenAPI
   - Postman collection
   - API versioning

5. **Testing:**
   - Unit tests (Jest)
   - Integration tests (Supertest)
   - E2E tests

---

## 🎓 TECHNICAL CONCEPTS EXPLAINED

### **1. Password Hashing:**
```javascript
// NEVER store plain passwords:
❌ password: "mypassword123"

// ALWAYS hash with bcrypt:
✅ password: "$2a$10$xYZ..."

How it works:
1. User provides password: "mypassword123"
2. Generate salt: random string
3. Hash password + salt: bcrypt magic
4. Store hashed version only
5. On login: hash provided password → compare with stored hash
```

### **2. JWT Tokens:**
```javascript
// Token structure:
header.payload.signature

Example:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.  // Header
eyJ1c2VySWQiOiI2NWFiYzEyMyJ9.           // Payload (user ID)
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV      // Signature

Server creates token → Frontend stores → Frontend sends in header:
Authorization: Bearer <token>

Server verifies signature → Extracts user ID → Proceeds
```

### **3. Middleware:**
```javascript
Request → Middleware 1 → Middleware 2 → Route Handler → Response

Example:
POST /api/history
  ↓
CORS middleware (allow cross-origin)
  ↓
JSON parser (parse body)
  ↓
Auth middleware (verify JWT)
  ↓
Route handler (get history)
  ↓
Response
```

---

Your backend is now **production-ready**! 🚀

Next: Connect the frontend to use these APIs!
