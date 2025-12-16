# Rooted Voices Backend API

Backend API server for Rooted Voices - Speech & Language Therapy Platform

## 🚀 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (Local)
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Real-time**: Socket.io
- **Security**: Helmet, CORS, Rate Limiting

## 📋 Prerequisites

Before running the backend, make sure you have:

- Node.js 18+ installed
- MongoDB installed and running locally
- npm or yarn package manager

## 🛠️ Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment variables**:

The `.env` file should already be created. If not, copy from `.env.example`:
```bash
cp .env.example .env
```

Key environment variables:
- `PORT`: Server port (default: 5000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `FRONTEND_URL`: Frontend URL for CORS

3. **Make sure MongoDB is running**:
```bash
# On macOS with Homebrew
brew services start mongodb-community

# Or manually
mongod --config /usr/local/etc/mongod.conf
```

## 📊 Database Setup

### Seed the database with dummy data:

```bash
npm run seed
```

This will create:
- 5 therapist accounts
- 5 client accounts  
- Multiple sessions
- Goals and assignments
- Sample data for testing

### Login Credentials (after seeding):

**Therapist Account:**
- Email: `dr.smith@rootedvoices.com`
- Password: `password123`

**Client Account:**
- Email: `john.doe@example.com`
- Password: `password123`

## 🎯 Running the Server

### Development mode (with auto-restart):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000`

## 📡 API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `GET /me` - Get current user (protected)
- `POST /logout` - Logout user (protected)
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password

### Therapists (`/api/therapists`)
- `GET /` - Get all therapists (public)
- `GET /:id` - Get therapist by ID (public)
- `POST /` - Create/update therapist profile (therapist only)
- `PUT /:id/availability` - Update availability (therapist only)
- `GET /:id/stats` - Get therapist statistics (own profile)

### Clients (`/api/clients`)
- `GET /` - Get all clients (therapist only)
- `GET /:id` - Get client by ID (protected)
- `POST /` - Create/update client profile (client only)
- `POST /:id/documents` - Upload document (protected)
- `GET /:id/documents` - Get client documents (protected)
- `DELETE /:id/documents/:docId` - Delete document (protected)

### Sessions (`/api/sessions`)
- `GET /` - Get all sessions (protected)
- `GET /upcoming` - Get upcoming sessions (protected)
- `GET /:id` - Get session by ID (protected)
- `POST /` - Create new session (protected)
- `PUT /:id` - Update session (protected)
- `DELETE /:id` - Cancel session (protected)
- `POST /:id/start` - Start session (protected)
- `POST /:id/complete` - Complete session (therapist only)
- `POST /:id/soap-note` - Save SOAP note (therapist only)

### Health Check
- `GET /api/health` - API health status

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### How to use:

1. **Login** to get an access token:
```bash
POST /api/auth/login
{
  "email": "dr.smith@rootedvoices.com",
  "password": "password123"
}
```

2. **Include token** in subsequent requests:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## 🧪 Testing the API

### Using cURL:

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dr.smith@rootedvoices.com","password":"password123"}'
```

**Get therapists:**
```bash
curl http://localhost:5000/api/therapists
```

**Get current user (with auth):**
```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using Postman or Thunder Client:

1. Import the API endpoints
2. Set base URL to `http://localhost:5000/api`
3. For protected routes, add Authorization header with Bearer token

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.js  # MongoDB connection
│   │   ├── jwt.js       # JWT configuration
│   │   ├── multer.js    # File upload config
│   │   └── socket.js    # Socket.io setup
│   │
│   ├── models/          # Mongoose models
│   │   ├── User.js
│   │   ├── Therapist.js
│   │   ├── Client.js
│   │   ├── Session.js
│   │   └── ...
│   │
│   ├── controllers/     # Route controllers
│   │   ├── authController.js
│   │   ├── therapistController.js
│   │   ├── clientController.js
│   │   └── ...
│   │
│   ├── routes/          # API routes
│   │   ├── auth.js
│   │   ├── therapists.js
│   │   ├── clients.js
│   │   └── index.js
│   │
│   ├── middlewares/     # Custom middleware
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   ├── roleCheck.js
│   │   └── ...
│   │
│   ├── utils/           # Utility functions
│   │   ├── emailService.js
│   │   └── logger.js
│   │
│   ├── seeds/           # Database seeders
│   │   └── index.js
│   │
│   └── server.js        # Main entry point
│
├── uploads/             # Uploaded files
│   ├── avatars/
│   ├── documents/
│   ├── resources/
│   └── recordings/
│
├── .env                 # Environment variables
├── .gitignore
├── package.json
└── README.md
```

## 🔒 Security Features

- **Helmet**: Secure HTTP headers
- **CORS**: Cross-Origin Resource Sharing configured
- **Rate Limiting**: Prevent brute force attacks
- **JWT**: Stateless authentication
- **Password Hashing**: bcrypt for password security
- **Input Sanitization**: Prevent NoSQL injection
- **Role-Based Access**: Therapist/Client/Admin permissions

## 🌐 CORS Configuration

The API allows requests from:
- `http://localhost:3000` (default frontend)
- Configurable via `FRONTEND_URL` environment variable

## 📝 Database Models

### User
- Email, password, role (therapist/client/admin)
- Profile information
- Authentication data

### Therapist
- License information
- Specializations
- Availability schedule
- Ratings and reviews

### Client
- Personal information
- Medical history
- Assigned therapist
- Documents (IEPs, IFSPs, etc.)

### Session
- Scheduled date/time
- Duration, type, status
- SOAP notes
- Payment information

### Goal
- Treatment goals
- Progress tracking
- Milestones

### Assignment
- Homework assignments
- Due dates
- Completion status

## 🐛 Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution**: Make sure MongoDB is running:
```bash
brew services start mongodb-community
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution**: Change PORT in `.env` or kill the process using port 5000:
```bash
lsof -ti:5000 | xargs kill
```

### JWT Secret Not Set
```
Error: JWT_SECRET is not defined
```
**Solution**: Make sure `.env` file exists with `JWT_SECRET` set

## 📧 Contact & Support

For questions or issues:
- Check the main project documentation
- Review the API endpoints above
- Check server logs for errors

## 🚀 Next Steps

1. **Start the backend**: `npm run dev`
2. **Seed the database**: `npm run seed`
3. **Test the API**: Use Postman or cURL
4. **Integrate with frontend**: Update frontend API URLs
5. **Add more features**: Extend controllers and routes as needed

---

**Backend Status**: ✅ Ready for Development
**Last Updated**: October 30, 2025

