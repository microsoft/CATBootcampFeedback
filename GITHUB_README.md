# CAT Bootcamp Feedback Application

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Azure](https://img.shields.io/badge/Azure-Ready-blue)](https://azure.microsoft.com)

A comprehensive web-based feedback collection system for training modules with admin management, QR code generation, and live feedback counting.

## 🌟 Features

- **📝 Public Feedback Form** - URL-based, no authentication required
- **🔐 Admin Interface** - Secure event management and analytics
- **📊 Live Count Display** - Real-time feedback count for presenters
- **📱 QR Code Generation** - Automatic QR codes for easy access
- **📈 Analytics Dashboard** - Comprehensive statistics and reports
- **💾 Azure SQL Backend** - Production-ready database schema
- **🎨 Responsive Design** - Works on all devices
- **♿ Accessible** - WCAG 2.1 AA compliant

## 🚀 Quick Start

### Demo Mode (No Backend Required)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/cat-bootcamp-feedback-app.git
cd cat-bootcamp-feedback-app
```

2. Serve with a local web server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server
```

3. Access the application:
- Feedback Form: `http://localhost:8000/feedback.html?code=CSA1B2C3`
- Admin Panel: `http://localhost:8000/admin.html` (admin/CATBootcamp2026!)
- Live Count: `http://localhost:8000/count.html?code=CSA1B2C3`

## 📁 Project Structure

```
feedbackapp/
├── feedback.html          # Public feedback form
├── feedback.js            # Feedback form logic
├── admin.html             # Admin interface
├── admin.js               # Admin functionality
├── admin.css              # Admin styling
├── count.html             # Live count display
├── count.js               # Count display logic
├── styles.css             # Shared styling
├── config.js              # Configuration
├── utils.js               # Utility functions
├── errors.js              # Error handling
├── api.js                 # API utilities
├── Cache.js               # Caching layer
├── RateLimiter.js         # Rate limiting
├── SPECIFICATION.md       # Technical spec
├── README.md              # User documentation
└── REVIEW_AND_RECOMMENDATIONS.md  # Improvement guide
```

## 🔧 Configuration

Edit `config.js` to configure the application:

```javascript
export const CONFIG = {
    API_BASE_URL: '/api',
    USE_MOCK_DATA: true,  // Set false for production
    // ... more configuration
};
```

## 🗄️ Database Setup

See `SPECIFICATION.md` for complete Azure SQL schema. Quick setup:

```sql
CREATE DATABASE CopilotFeedback;

CREATE TABLE Events (
    EventId INT IDENTITY PRIMARY KEY,
    EventCode NVARCHAR(20) UNIQUE NOT NULL,
    ModuleName NVARCHAR(200) NOT NULL,
    -- ... see SPECIFICATION.md
);

CREATE TABLE Feedback (
    FeedbackId INT IDENTITY PRIMARY KEY,
    EventId INT NOT NULL,
    SpeakerKnowledge INT NOT NULL,
    -- ... see SPECIFICATION.md
);
```

## 📊 API Endpoints

### Public (No Auth)
- `GET /api/events/{code}` - Get event details
- `POST /api/feedback` - Submit feedback
- `GET /api/events/{code}/count` - Get feedback count

### Admin (Auth Required)
- `POST /api/admin/auth/login` - Login
- `GET /api/admin/events` - List events
- `POST /api/admin/events` - Create event
- `GET /api/admin/feedback` - View feedback
- `GET /api/admin/analytics` - Get statistics

See `SPECIFICATION.md` for complete API documentation.

## 🔒 Security Features

- ✅ CSRF Protection
- ✅ Input Sanitization
- ✅ Rate Limiting
- ✅ XSS Prevention
- ✅ Secure Authentication
- ✅ Error Handling

## 📱 Usage

### For Admins
1. Login to admin panel
2. Create events for each module
3. Download QR codes
4. Share feedback URLs

### For Presenters
1. Display count page during presentation
2. Share QR code with attendees
3. Monitor live feedback submissions

### For Attendees
1. Scan QR code or click feedback link
2. Answer required questions
3. Submit feedback

## 🧪 Testing

```bash
# Run unit tests (when implemented)
npm test

# Run E2E tests (when implemented)
npm run test:e2e
```

## 📦 Deployment

### Azure Static Web Apps
```bash
# Install Azure CLI
az login

# Deploy
az staticwebapp create \
    --name copilot-feedback \
    --resource-group your-rg \
    --source . \
    --location "East US 2"
```

### Azure App Service
```bash
# Create App Service
az webapp create \
    --name copilot-feedback \
    --resource-group your-rg \
    --plan your-plan

# Deploy
az webapp deployment source config-zip \
    --name copilot-feedback \
    --resource-group your-rg \
    --src feedback-app.zip
```

See `SPECIFICATION.md` for detailed deployment options.

## 🔄 Production Checklist

- [ ] Set `USE_MOCK_DATA = false`
- [ ] Configure production API URL
- [ ] Set up Azure SQL Database
- [ ] Deploy backend API
- [ ] Enable HTTPS
- [ ] Configure CORS
- [ ] Set up monitoring
- [ ] Run security audit

## 📖 Documentation

- **[README.md](README.md)** - User guide and getting started
- **[SPECIFICATION.md](SPECIFICATION.md)** - Complete technical specification
- **[REVIEW_AND_RECOMMENDATIONS.md](REVIEW_AND_RECOMMENDATIONS.md)** - Code review and improvements

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🐛 Issues

Found a bug? Have a feature request? [Open an issue](https://github.com/yourusername/cat-bootcamp-feedback-app/issues)

## 📧 Support

For questions or support, please contact the maintainers.

## 🙏 Acknowledgments

Built for the CAT Bootcamp program.

---

**Version:** 2.0
**Last Updated:** 2026-02-03
