# QR Code Generation - Specification Updates & Enhancements

## Document Purpose
This document outlines recommended updates to the QR code generation capability for the CAT Bootcamp Feedback Application, addressing gaps between the current implementation and specification, plus additional enhancements for production use.

---

## Executive Summary

### Current State Analysis
The application currently generates QR codes on-the-fly using QRCode.js in two locations:
1. **Admin Interface**: 300x300px QR codes for event management
2. **Count Display**: 200x200px QR codes for live presentations

### Key Issues Identified
1. **Inconsistent sizing** between admin (300px) and count display (200px)
2. **No error correction level specified** (defaults to Level M)
3. **No persistent storage** for generated QR codes
4. **Limited format support** (PNG only, no SVG)
5. **Hardcoded styling** with no customization options
6. **Missing print templates** for physical distribution
7. **No branding/logo integration** capability
8. **Database schema gap** - `qrCodeUrl` field not implemented

---

## Enhanced Requirements

### 1. QR Code Configuration Standards

#### 1.1 Size Standards
Define three standard sizes for different use cases:

| Use Case | Size | Purpose |
|----------|------|---------|
| **Digital Display** | 200x200px | Count display, web viewing |
| **Print Standard** | 400x400px | Flyers, handouts, presentations |
| **Print High-Res** | 800x800px | Posters, banners, large format |

**Implementation:**
```javascript
const QR_SIZES = {
    DIGITAL: { width: 200, label: 'Digital Display' },
    PRINT_STANDARD: { width: 400, label: 'Standard Print' },
    PRINT_HIGHRES: { width: 800, label: 'High Resolution Print' }
};
```

#### 1.2 Error Correction Levels
Specify error correction levels based on use case:

| Level | Recovery Capacity | Use Case |
|-------|------------------|----------|
| **L (Low)** | ~7% | Digital-only, controlled environment |
| **M (Medium)** | ~15% | General digital use (current default) |
| **Q (Quartile)** | ~25% | Print materials, potential damage |
| **H (High)** | ~30% | Outdoor, high-risk scenarios, logo overlay |

**Recommendation:** Use Level H for all print materials and Level Q for digital displays.

**Implementation:**
```javascript
const QR_ERROR_CORRECTION = {
    DIGITAL: 'Q',      // Quartile - 25% recovery
    PRINT: 'H',        // High - 30% recovery
    LOGO_OVERLAY: 'H'  // High - needed for center logo
};
```

#### 1.3 Color Schemes
Define standard color schemes aligned with Microsoft/Copilot Studio branding:

| Scheme | Dark Color | Light Color | Use Case |
|--------|------------|-------------|----------|
| **Primary** | #667eea (Purple) | #ffffff (White) | Default, digital |
| **Microsoft Blue** | #0078d4 | #ffffff | Official materials |
| **Copilot Green** | #10a37f | #ffffff | Copilot Studio events |
| **High Contrast** | #000000 (Black) | #ffffff (White) | Print, accessibility |
| **Monochrome** | #333333 | #ffffff | Professional print |

**Implementation:**
```javascript
const QR_COLOR_SCHEMES = {
    PRIMARY: { dark: '#667eea', light: '#ffffff' },
    MS_BLUE: { dark: '#0078d4', light: '#ffffff' },
    COPILOT_GREEN: { dark: '#10a37f', light: '#ffffff' },
    HIGH_CONTRAST: { dark: '#000000', light: '#ffffff' },
    MONOCHROME: { dark: '#333333', light: '#ffffff' }
};
```

#### 1.4 Margin/Quiet Zone
Consistent margin specification for all QR codes:

- **Minimum:** 4 modules (QR code modules, not pixels)
- **Recommended:** 4 modules for all use cases
- **Current:** 2px (should be changed to 4 modules)

---

### 2. Storage Strategy

#### 2.1 Hybrid Approach (Recommended)
Implement a hybrid storage model combining on-demand generation with optional caching:

**Primary Strategy:**
- Generate QR codes on-the-fly in admin interface (fast, no storage cost)
- Cache generated QR codes in browser (sessionStorage/localStorage)
- Option to save to Azure Blob Storage for permanent URLs

**Secondary Strategy (Optional):**
- Pre-generate and store QR codes in Azure Blob Storage when event is created
- Serve from CDN for faster loading
- Regenerate if QR code parameters change

#### 2.2 Azure Blob Storage Integration

**Container Structure:**
```
qr-codes/
  ├── events/
  │   ├── {eventCode}/
  │   │   ├── digital-200.png
  │   │   ├── print-400.png
  │   │   ├── print-800.png
  │   │   ├── digital.svg
  │   │   └── print.svg
```

**Benefits:**
- Permanent URLs for sharing
- CDN distribution for performance
- Version control (regenerate when event details change)
- Reduced client-side processing

**Storage Cost Analysis:**
- Average QR code size: ~5-15 KB (PNG), ~2-5 KB (SVG)
- 1000 events × 5 formats = 5000 files × 10 KB avg = 50 MB
- Azure Blob Storage: ~$0.02/GB/month = ~$0.001/month
- **Conclusion:** Storage cost negligible, worth implementing

#### 2.3 Database Schema Updates

**Update Events Table:**
```sql
ALTER TABLE Events ADD COLUMN QrCodeUrl NVARCHAR(500) NULL;
ALTER TABLE Events ADD COLUMN QrCodeGeneratedAt DATETIME2 NULL;
ALTER TABLE Events ADD COLUMN QrCodeStorageEnabled BIT DEFAULT 0;
```

**New Configuration Table:**
```sql
CREATE TABLE QrCodeConfigurations (
    ConfigId INT IDENTITY(1,1) PRIMARY KEY,
    EventId INT NOT NULL,
    Size NVARCHAR(20) NOT NULL, -- 'DIGITAL', 'PRINT_STANDARD', 'PRINT_HIGHRES'
    Format NVARCHAR(10) NOT NULL, -- 'PNG', 'SVG'
    ErrorCorrection NVARCHAR(1) NOT NULL, -- 'L', 'M', 'Q', 'H'
    ColorScheme NVARCHAR(50) NOT NULL,
    BlobUrl NVARCHAR(500) NULL,
    GeneratedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (EventId) REFERENCES Events(EventId) ON DELETE CASCADE
);
```

---

### 3. Format Support

#### 3.1 PNG Format (Current)
**Advantages:**
- Universal support
- Good for digital displays
- Predictable rendering

**Use Cases:**
- Email attachments
- PowerPoint presentations
- Quick downloads

**Implementation:** Already implemented, enhance with configurable sizes

#### 3.2 SVG Format (New)
**Advantages:**
- Infinitely scalable
- Smaller file size
- Better for print
- Can embed in web pages
- Supports animations/interactions

**Use Cases:**
- Print materials (scales to any size)
- Web embedding
- Professional design tools

**Implementation:**
```javascript
// Add SVG generation option
function generateQRCodeSVG(eventCode, options = {}) {
    const feedbackUrl = `${FEEDBACK_BASE_URL}?code=${eventCode}`;

    QRCode.toString(feedbackUrl, {
        type: 'svg',
        errorCorrectionLevel: options.errorCorrection || 'H',
        margin: 4,
        color: {
            dark: options.colorScheme?.dark || '#000000',
            light: options.colorScheme?.light || '#ffffff'
        }
    }, function(err, svg) {
        if (err) throw err;
        return svg;
    });
}
```

#### 3.3 PDF Format (New)
**Use Cases:**
- Print-ready documents
- Multiple QR codes per page
- Include event information alongside QR code

**Implementation:** Use jsPDF library to generate PDFs with QR codes

---

### 4. Print Templates

#### 4.1 Template Types

**Template 1: Simple Card (Business Card Size)**
```
┌─────────────────────────────────┐
│  [QR CODE]   │  Scan to provide │
│   200x200    │  feedback on:    │
│              │                   │
│              │  Module Name      │
│              │  Date: MM/DD/YY   │
│              │  Speaker: Name    │
└─────────────────────────────────┘
Size: 3.5" × 2" (standard business card)
```

**Template 2: Flyer (Letter Size)**
```
┌───────────────────────────────────┐
│    CAT Bootcamp Feedback          │
│                                   │
│        [QR CODE]                  │
│         400x400                   │
│                                   │
│    Scan to Share Your Feedback    │
│                                   │
│  Module: [Name]                   │
│  Date: [Date]                     │
│  Speaker: [Name]                  │
│                                   │
│  Or visit:                        │
│  [Short URL]                      │
└───────────────────────────────────┘
Size: 8.5" × 11" (letter)
```

**Template 3: Poster (Tabloid Size)**
```
┌───────────────────────────────────┐
│                                   │
│    [LARGE LOGO/BRANDING]          │
│                                   │
│    SHARE YOUR FEEDBACK            │
│                                   │
│        [QR CODE]                  │
│         800x800                   │
│                                   │
│    [Module Name]                  │
│    [Date & Speaker]               │
│                                   │
│  Scan with your phone camera      │
└───────────────────────────────────┘
Size: 11" × 17" (tabloid)
```

**Template 4: Slide (PowerPoint)**
```
┌───────────────────────────────────┐
│                                   │
│    Time for Feedback! 📝          │
│                                   │
│  [QR CODE]    │  • Scan QR code   │
│   300x300     │  • Takes 2 mins   │
│               │  • Anonymous      │
│               │                   │
│  Or visit: [URL]                  │
└───────────────────────────────────┘
Size: 16:9 slide format
```

#### 4.2 Template Implementation

**Admin Interface Enhancement:**
Add "Print Options" button in event details modal:

```javascript
// Add print template generation
function generatePrintTemplate(event, templateType) {
    const templates = {
        CARD: generateCardTemplate,
        FLYER: generateFlyerTemplate,
        POSTER: generatePosterTemplate,
        SLIDE: generateSlideTemplate
    };

    return templates[templateType](event);
}
```

**HTML Structure:**
```html
<div class="print-options">
    <h4>Print Templates</h4>
    <button onclick="printTemplate('CARD')">📇 Business Card</button>
    <button onclick="printTemplate('FLYER')">📄 Flyer (Letter)</button>
    <button onclick="printTemplate('POSTER')">🖼️ Poster (Tabloid)</button>
    <button onclick="printTemplate('SLIDE')">📊 PowerPoint Slide</button>
    <button onclick="downloadPDF('ALL')">📁 Download All (PDF)</button>
</div>
```

---

### 5. Branding & Logo Integration

#### 5.1 Logo Overlay
Add Microsoft/Copilot Studio logo in the center of QR code:

**Requirements:**
- Logo should not exceed 30% of QR code area
- Must use High (H) error correction level
- Logo should be transparent background PNG
- Maintain readability of QR code

**Implementation:**
```javascript
function generateQRCodeWithLogo(eventCode, options = {}) {
    const canvas = document.getElementById('qrCanvas');
    const feedbackUrl = `${FEEDBACK_BASE_URL}?code=${eventCode}`;

    // Generate QR code with high error correction
    QRCode.toCanvas(canvas, feedbackUrl, {
        width: options.width || 400,
        margin: 4,
        errorCorrectionLevel: 'H', // Required for logo overlay
        color: options.colors || { dark: '#000000', light: '#ffffff' }
    }, function(error) {
        if (error) throw error;

        // Overlay logo in center
        const ctx = canvas.getContext('2d');
        const logo = new Image();
        logo.onload = function() {
            const logoSize = canvas.width * 0.2; // 20% of QR size
            const x = (canvas.width - logoSize) / 2;
            const y = (canvas.height - logoSize) / 2;

            // Draw white background for logo
            ctx.fillStyle = 'white';
            ctx.fillRect(x - 5, y - 5, logoSize + 10, logoSize + 10);

            // Draw logo
            ctx.drawImage(logo, x, y, logoSize, logoSize);
        };
        logo.src = options.logoUrl || '/assets/copilot-logo.png';
    });
}
```

#### 5.2 Branding Elements
Include consistent branding across all QR code materials:

- **Header:** "CAT Bootcamp Feedback" or "[Company] Feedback"
- **Footer:** Company logo, website, or tagline
- **Color scheme:** Match event/company brand colors
- **Typography:** Consistent font family (Segoe UI, Arial, etc.)

---

### 6. Customization Options

#### 6.1 Admin Interface Controls

Add QR code customization panel in event modal:

```html
<div class="qr-customization-panel">
    <h4>QR Code Settings</h4>

    <div class="form-group">
        <label>Size</label>
        <select id="qrSize">
            <option value="DIGITAL">Digital Display (200px)</option>
            <option value="PRINT_STANDARD" selected>Standard Print (400px)</option>
            <option value="PRINT_HIGHRES">High Resolution (800px)</option>
        </select>
    </div>

    <div class="form-group">
        <label>Format</label>
        <select id="qrFormat">
            <option value="PNG" selected>PNG (Image)</option>
            <option value="SVG">SVG (Scalable)</option>
        </select>
    </div>

    <div class="form-group">
        <label>Color Scheme</label>
        <select id="qrColorScheme">
            <option value="PRIMARY" selected>Purple (Primary)</option>
            <option value="MS_BLUE">Microsoft Blue</option>
            <option value="COPILOT_GREEN">Copilot Green</option>
            <option value="HIGH_CONTRAST">High Contrast</option>
            <option value="MONOCHROME">Monochrome (Print)</option>
        </select>
    </div>

    <div class="form-group">
        <label>Error Correction</label>
        <select id="qrErrorCorrection">
            <option value="M">Medium (15%)</option>
            <option value="Q" selected>Quartile (25%)</option>
            <option value="H">High (30%)</option>
        </select>
    </div>

    <div class="form-group">
        <label>
            <input type="checkbox" id="qrIncludeLogo">
            Include logo in center
        </label>
    </div>

    <div class="form-group">
        <label>
            <input type="checkbox" id="qrStoreInBlob">
            Store in Azure Blob Storage
        </label>
    </div>
</div>
```

#### 6.2 URL Shortening Integration (Future)

**Option 1: Azure URL Shortener**
- Create short URLs like `https://cat.ms/fb/ABC123`
- Reduces QR code complexity
- Easier for manual typing

**Option 2: Third-Party Services**
- bit.ly API integration
- Custom domain support
- Analytics tracking

---

### 7. API Endpoint Updates

#### 7.1 New Endpoints

**Generate QR Code (Server-Side)**
```
POST /api/events/{eventId}/qr-code
Body: {
    "size": "PRINT_STANDARD",
    "format": "PNG",
    "errorCorrection": "H",
    "colorScheme": "PRIMARY",
    "includeLogo": true,
    "storeInBlob": true
}
Response: {
    "success": true,
    "data": {
        "qrCodeUrl": "https://storage.blob.core.windows.net/.../ABC123-400.png",
        "blobPath": "qr-codes/events/ABC123/print-400.png",
        "generatedAt": "2026-02-05T10:00:00Z"
    }
}
```

**Get QR Code Configurations**
```
GET /api/events/{eventId}/qr-codes
Response: {
    "success": true,
    "data": {
        "configurations": [
            {
                "configId": 1,
                "size": "DIGITAL",
                "format": "PNG",
                "url": "https://...",
                "generatedAt": "..."
            },
            ...
        ]
    }
}
```

**Delete QR Code**
```
DELETE /api/events/{eventId}/qr-codes/{configId}
```

#### 7.2 Update Existing Endpoints

**GET /api/events/{eventCode}**
Add QR code URLs to response:
```json
{
    "success": true,
    "data": {
        "EventId": 1,
        "EventCode": "CSA1B2C3",
        "ModuleName": "Introduction to Copilot Studio",
        "FeedbackUrl": "https://feedbackapp.../feedback.html?code=CSA1B2C3",
        "QrCodeUrl": "https://storage.blob.core.windows.net/.../CSA1B2C3-400.png",
        "QrCodeConfigurations": [
            {
                "size": "DIGITAL",
                "format": "PNG",
                "url": "..."
            }
        ]
    }
}
```

---

### 8. Performance Optimizations

#### 8.1 Client-Side Caching
Cache generated QR codes in browser:
```javascript
// Cache in sessionStorage
function cacheQRCode(eventCode, size, dataUrl) {
    const key = `qr_${eventCode}_${size}`;
    try {
        sessionStorage.setItem(key, dataUrl);
    } catch (e) {
        console.warn('SessionStorage full, clearing cache');
        clearQRCodeCache();
    }
}

function getCachedQRCode(eventCode, size) {
    const key = `qr_${eventCode}_${size}`;
    return sessionStorage.getItem(key);
}
```

#### 8.2 Lazy Loading
Don't generate QR codes until modal is opened:
```javascript
// Generate only when needed
document.getElementById('viewQRBtn').addEventListener('click', () => {
    if (!qrCodeGenerated) {
        generateQRCode(eventCode);
        qrCodeGenerated = true;
    }
    showQRModal();
});
```

#### 8.3 Web Workers
Use Web Workers for QR code generation in background:
```javascript
// qr-worker.js
self.onmessage = function(e) {
    const { url, options } = e.data;
    const qrCode = generateQRCode(url, options);
    self.postMessage({ qrCode });
};

// Main thread
const worker = new Worker('qr-worker.js');
worker.postMessage({ url: feedbackUrl, options: qrOptions });
worker.onmessage = function(e) {
    displayQRCode(e.data.qrCode);
};
```

---

### 9. Accessibility Considerations

#### 9.1 Alternative Access Methods
Always provide alternatives to QR codes:

**Text Link:**
```html
<div class="qr-alternative">
    <p>Can't scan? Visit:</p>
    <a href="https://feedbackapp.../feedback.html?code=ABC123">
        feedbackapp.com/ABC123
    </a>
</div>
```

**Short Code:**
```html
<div class="qr-alternative">
    <p>Or enter code manually: <strong>ABC123</strong></p>
    <p>at <strong>feedbackapp.com</strong></p>
</div>
```

#### 9.2 Screen Reader Support
Add proper ARIA labels:
```html
<div class="qr-section" role="region" aria-label="QR Code for Feedback Form">
    <canvas id="qrCode"
            role="img"
            aria-label="QR code linking to feedback form for [Module Name].
                        Alternative link provided below.">
    </canvas>
    <p class="sr-only">QR code contains a link to the feedback form.
                        An alternative text link is provided below.</p>
</div>
```

#### 9.3 High Contrast Mode
Ensure QR codes work in high contrast mode:
```css
@media (prefers-contrast: high) {
    .qr-code-container {
        /* Use high contrast color scheme */
        --qr-dark: #000000;
        --qr-light: #ffffff;
    }
}
```

---

### 10. Testing & Quality Assurance

#### 10.1 QR Code Validation Tests

**Test Case 1: Scannability**
- Generate QR codes at all supported sizes
- Test with multiple QR code reader apps (iOS Camera, Android Camera, dedicated apps)
- Test at different distances (6 inches, 12 inches, 24 inches, 36 inches)
- Test with different phone models and cameras

**Test Case 2: Damage Tolerance**
- Print QR code and simulate damage (fold, smudge, partial obstruction)
- Verify error correction levels work as expected
- Ensure logo overlay doesn't prevent scanning

**Test Case 3: Print Quality**
- Print on different paper types (glossy, matte, newsprint)
- Print at different DPI (300 DPI, 600 DPI)
- Verify readability after printing

**Test Case 4: Format Compatibility**
- Test PNG downloads in different browsers
- Test SVG rendering and scalability
- Verify PDF generation includes proper metadata

**Test Case 5: Color Schemes**
- Test all color schemes for contrast ratio (WCAG AA: 4.5:1)
- Verify readability in different lighting conditions
- Test with color blindness simulators

#### 10.2 Automated Testing
```javascript
// QR Code generation test suite
describe('QR Code Generation', () => {
    test('generates QR code with correct URL', async () => {
        const qrCode = await generateQRCode('TEST123', { size: 'DIGITAL' });
        const decodedUrl = await decodeQRCode(qrCode);
        expect(decodedUrl).toContain('feedback.html?code=TEST123');
    });

    test('respects error correction level', async () => {
        const qrCode = await generateQRCode('TEST123', {
            errorCorrection: 'H'
        });
        const metadata = await getQRMetadata(qrCode);
        expect(metadata.errorCorrectionLevel).toBe('H');
    });

    test('applies correct color scheme', async () => {
        const qrCode = await generateQRCode('TEST123', {
            colorScheme: 'MS_BLUE'
        });
        expect(qrCode.colors.dark).toBe('#0078d4');
    });
});
```

---

### 11. Security Considerations

#### 11.1 URL Validation
Prevent malicious QR codes:
```javascript
function validateFeedbackUrl(eventCode) {
    // Only allow event codes from database
    const validEvent = await verifyEventCode(eventCode);
    if (!validEvent) {
        throw new Error('Invalid event code');
    }

    // Construct URL from trusted base
    const url = new URL(`${FEEDBACK_BASE_URL}?code=${eventCode}`);

    // Validate URL matches expected pattern
    if (url.origin !== window.location.origin) {
        throw new Error('Invalid URL origin');
    }

    return url.toString();
}
```

#### 11.2 Rate Limiting
Prevent QR code generation abuse:
```javascript
// Limit QR code generation requests
const rateLimiter = new RateLimiter({
    maxRequests: 10,  // 10 QR codes
    windowMs: 60000   // per minute
});
```

#### 11.3 Storage Security
Secure blob storage access:
- Use SAS tokens with expiration
- Implement blob-level access control
- Enable Azure Blob Storage audit logging
- Set CORS policies appropriately

---

### 12. Monitoring & Analytics

#### 12.1 QR Code Usage Tracking

**Track metrics:**
- Number of QR codes generated
- Most popular sizes/formats
- Download counts
- Scan rates (if using URL shortener with analytics)
- Error rates

**Implementation:**
```javascript
// Log QR code generation
async function logQRCodeGeneration(eventId, config) {
    await fetch('/api/analytics/qr-code-generated', {
        method: 'POST',
        body: JSON.stringify({
            eventId,
            size: config.size,
            format: config.format,
            colorScheme: config.colorScheme,
            timestamp: new Date().toISOString()
        })
    });
}
```

#### 12.2 Dashboard Metrics

Add to admin analytics dashboard:
- Total QR codes generated
- QR codes per event
- Most downloaded sizes/formats
- Blob storage usage
- QR code scan-to-submission ratio (if trackable)

---

### 13. Implementation Phases (Revised)

#### Phase 1: Foundation (Week 1-2)
**Priority: Critical**
- [ ] Standardize QR code sizes (200, 400, 800px)
- [ ] Implement error correction level configuration (default to H)
- [ ] Add color scheme selector in admin interface
- [ ] Update count.js to use consistent 200px size
- [ ] Add margin configuration (4 modules)

#### Phase 2: Storage & Persistence (Week 3-4)
**Priority: High**
- [ ] Set up Azure Blob Storage container structure
- [ ] Add database schema updates (QrCodeUrl, QrCodeConfigurations table)
- [ ] Implement blob upload/download functionality
- [ ] Add "Save to Storage" option in admin interface
- [ ] Create API endpoints for QR code management

#### Phase 3: Formats & Templates (Week 5-6)
**Priority: Medium**
- [ ] Add SVG format support
- [ ] Create business card template
- [ ] Create flyer template (letter size)
- [ ] Create poster template (tabloid size)
- [ ] Create PowerPoint slide template
- [ ] Implement PDF generation with multiple templates

#### Phase 4: Branding & Customization (Week 7-8)
**Priority: Medium**
- [ ] Add logo overlay capability
- [ ] Implement custom color scheme creation
- [ ] Add branding elements (headers, footers)
- [ ] Create branded template library
- [ ] Add preview before download

#### Phase 5: Advanced Features (Week 9-10)
**Priority: Low**
- [ ] Implement URL shortening integration
- [ ] Add batch QR code generation
- [ ] Create QR code analytics dashboard
- [ ] Implement client-side caching
- [ ] Add Web Worker support for background generation

#### Phase 6: Testing & Optimization (Week 11-12)
**Priority: High**
- [ ] Comprehensive scannability testing
- [ ] Print quality validation
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Security review
- [ ] Documentation completion

---

### 14. Code Examples

#### 14.1 Enhanced QR Code Generation Function

```javascript
/**
 * Generate QR code with full customization options
 * @param {string} eventCode - Event code to encode
 * @param {Object} options - Configuration options
 * @returns {Promise} Canvas or data URL
 */
async function generateEnhancedQRCode(eventCode, options = {}) {
    // Default options
    const config = {
        size: options.size || QR_SIZES.PRINT_STANDARD.width,
        format: options.format || 'PNG',
        errorCorrection: options.errorCorrection || 'H',
        colorScheme: options.colorScheme || QR_COLOR_SCHEMES.PRIMARY,
        includeLogo: options.includeLogo || false,
        logoUrl: options.logoUrl || '/assets/copilot-logo.png',
        margin: options.margin || 4,
        storeInBlob: options.storeInBlob || false,
        canvas: options.canvas || null
    };

    // Validate event code
    const feedbackUrl = await validateFeedbackUrl(eventCode);

    // Check cache first
    const cacheKey = `qr_${eventCode}_${config.size}_${config.format}`;
    const cached = getCachedQRCode(cacheKey);
    if (cached && !config.storeInBlob) {
        return cached;
    }

    // Generate QR code
    const canvas = config.canvas || document.createElement('canvas');

    return new Promise((resolve, reject) => {
        QRCode.toCanvas(canvas, feedbackUrl, {
            width: config.size,
            margin: config.margin,
            errorCorrectionLevel: config.errorCorrection,
            color: {
                dark: config.colorScheme.dark,
                light: config.colorScheme.light
            }
        }, async function(error) {
            if (error) {
                reject(error);
                return;
            }

            // Add logo overlay if requested
            if (config.includeLogo) {
                await addLogoOverlay(canvas, config.logoUrl);
            }

            // Convert to requested format
            let result;
            if (config.format === 'SVG') {
                result = await convertCanvasToSVG(canvas);
            } else {
                result = canvas.toDataURL('image/png');
            }

            // Cache result
            cacheQRCode(cacheKey, result);

            // Store in blob if requested
            if (config.storeInBlob) {
                const blobUrl = await uploadToBlob(eventCode, config, result);
                result = { dataUrl: result, blobUrl: blobUrl };
            }

            resolve(result);
        });
    });
}

/**
 * Add logo overlay to QR code canvas
 */
async function addLogoOverlay(canvas, logoUrl) {
    return new Promise((resolve, reject) => {
        const ctx = canvas.getContext('2d');
        const logo = new Image();

        logo.onload = function() {
            const logoSize = canvas.width * 0.2;
            const x = (canvas.width - logoSize) / 2;
            const y = (canvas.height - logoSize) / 2;

            // White background for logo
            ctx.fillStyle = 'white';
            ctx.fillRect(x - 5, y - 5, logoSize + 10, logoSize + 10);

            // Draw logo
            ctx.drawImage(logo, x, y, logoSize, logoSize);
            resolve();
        };

        logo.onerror = reject;
        logo.src = logoUrl;
    });
}

/**
 * Upload QR code to Azure Blob Storage
 */
async function uploadToBlob(eventCode, config, dataUrl) {
    const blob = dataURLToBlob(dataUrl);
    const filename = `${eventCode}-${config.size}.${config.format.toLowerCase()}`;
    const path = `qr-codes/events/${eventCode}/${filename}`;

    const response = await fetch('/api/blob/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            path: path,
            data: dataUrl,
            contentType: `image/${config.format.toLowerCase()}`
        })
    });

    const result = await response.json();
    return result.data.url;
}

/**
 * Generate print template with QR code
 */
function generatePrintTemplate(event, templateType, qrDataUrl) {
    const templates = {
        CARD: generateCardTemplate,
        FLYER: generateFlyerTemplate,
        POSTER: generatePosterTemplate,
        SLIDE: generateSlideTemplate
    };

    if (!templates[templateType]) {
        throw new Error(`Unknown template type: ${templateType}`);
    }

    return templates[templateType](event, qrDataUrl);
}

/**
 * Generate business card template
 */
function generateCardTemplate(event, qrDataUrl) {
    const template = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                @page { size: 3.5in 2in; margin: 0; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    margin: 0;
                    padding: 0.25in;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .qr-code { width: 1.5in; height: 1.5in; }
                .info { flex: 1; margin-left: 0.25in; }
                .title { font-size: 14pt; font-weight: bold; color: #667eea; }
                .module { font-size: 10pt; margin-top: 0.1in; }
                .details { font-size: 8pt; color: #666; margin-top: 0.05in; }
            </style>
        </head>
        <body>
            <img src="${qrDataUrl}" class="qr-code" alt="QR Code">
            <div class="info">
                <div class="title">Scan for Feedback</div>
                <div class="module">${event.moduleName}</div>
                <div class="details">
                    Date: ${formatDate(event.moduleDate)}<br>
                    Speaker: ${event.speakerName}
                </div>
            </div>
        </body>
        </html>
    `;

    return template;
}
```

#### 14.2 Admin Interface Updates

```javascript
// Add to admin.js

// Enhanced viewEventDetails function
window.viewEventDetails = function(eventId) {
    const event = allEvents.find(e => e.eventId === eventId);
    if (!event) return;

    const modal = document.getElementById('eventDetailsModal');
    const content = document.getElementById('eventDetailsContent');
    const feedbackUrl = `${FEEDBACK_BASE_URL}?code=${event.eventCode}`;

    content.innerHTML = `
        <div class="detail-section">
            <h4>Event Information</h4>
            <!-- Event details ... -->
        </div>

        <div class="detail-section qr-code-section">
            <h4>QR Code Generator</h4>

            <!-- QR Code Configuration -->
            <div class="qr-config-panel">
                <div class="config-row">
                    <label>Size:</label>
                    <select id="qrSize" onchange="regenerateQRCode()">
                        <option value="200">Digital (200px)</option>
                        <option value="400" selected>Print Standard (400px)</option>
                        <option value="800">Print High-Res (800px)</option>
                    </select>
                </div>

                <div class="config-row">
                    <label>Color Scheme:</label>
                    <select id="qrColorScheme" onchange="regenerateQRCode()">
                        <option value="PRIMARY" selected>Purple (Primary)</option>
                        <option value="MS_BLUE">Microsoft Blue</option>
                        <option value="COPILOT_GREEN">Copilot Green</option>
                        <option value="HIGH_CONTRAST">High Contrast</option>
                        <option value="MONOCHROME">Monochrome</option>
                    </select>
                </div>

                <div class="config-row">
                    <label>Error Correction:</label>
                    <select id="qrErrorCorrection" onchange="regenerateQRCode()">
                        <option value="M">Medium (15%)</option>
                        <option value="Q">Quartile (25%)</option>
                        <option value="H" selected>High (30%)</option>
                    </select>
                </div>

                <div class="config-row">
                    <label>
                        <input type="checkbox" id="qrIncludeLogo" onchange="regenerateQRCode()">
                        Include logo overlay
                    </label>
                </div>
            </div>

            <!-- QR Code Display -->
            <div class="qr-display">
                <canvas id="qrCanvas"></canvas>
            </div>

            <!-- Actions -->
            <div class="qr-actions">
                <button class="btn btn-primary" onclick="downloadQRCode('PNG')">
                    💾 Download PNG
                </button>
                <button class="btn btn-secondary" onclick="downloadQRCode('SVG')">
                    💾 Download SVG
                </button>
                <button class="btn btn-secondary" onclick="copyFeedbackUrl('${feedbackUrl}')">
                    📋 Copy URL
                </button>
                <button class="btn btn-secondary" onclick="showPrintTemplates('${event.eventCode}')">
                    🖨️ Print Templates
                </button>
            </div>

            <!-- Feedback URL -->
            <div class="url-display">${feedbackUrl}</div>
        </div>
    `;

    // Generate initial QR code
    generateEventQRCode(event.eventCode);

    modal.classList.remove('hidden');
};

// Generate QR code with current settings
async function generateEventQRCode(eventCode) {
    const size = parseInt(document.getElementById('qrSize').value);
    const colorScheme = document.getElementById('qrColorScheme').value;
    const errorCorrection = document.getElementById('qrErrorCorrection').value;
    const includeLogo = document.getElementById('qrIncludeLogo').checked;

    const colorSchemes = {
        PRIMARY: { dark: '#667eea', light: '#ffffff' },
        MS_BLUE: { dark: '#0078d4', light: '#ffffff' },
        COPILOT_GREEN: { dark: '#10a37f', light: '#ffffff' },
        HIGH_CONTRAST: { dark: '#000000', light: '#ffffff' },
        MONOCHROME: { dark: '#333333', light: '#ffffff' }
    };

    await generateEnhancedQRCode(eventCode, {
        size: size,
        format: 'PNG',
        errorCorrection: errorCorrection,
        colorScheme: colorSchemes[colorScheme],
        includeLogo: includeLogo,
        canvas: document.getElementById('qrCanvas')
    });
}

// Regenerate QR code when settings change
function regenerateQRCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventCode = getCurrentEventCode(); // Implement based on your state management
    generateEventQRCode(eventCode);
}

// Download QR code in specified format
async function downloadQRCode(format) {
    const canvas = document.getElementById('qrCanvas');
    const eventCode = getCurrentEventCode();

    if (format === 'PNG') {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `qr-code-${eventCode}.png`;
        link.href = dataUrl;
        link.click();
    } else if (format === 'SVG') {
        // Convert canvas to SVG and download
        const svg = await convertCanvasToSVG(canvas);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `qr-code-${eventCode}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }
}

// Show print templates modal
function showPrintTemplates(eventCode) {
    const modal = createModal('Print Templates', `
        <div class="print-templates">
            <button class="template-btn" onclick="generateTemplate('CARD', '${eventCode}')">
                <div class="template-icon">📇</div>
                <div class="template-name">Business Card</div>
                <div class="template-size">3.5" × 2"</div>
            </button>

            <button class="template-btn" onclick="generateTemplate('FLYER', '${eventCode}')">
                <div class="template-icon">📄</div>
                <div class="template-name">Flyer</div>
                <div class="template-size">8.5" × 11"</div>
            </button>

            <button class="template-btn" onclick="generateTemplate('POSTER', '${eventCode}')">
                <div class="template-icon">🖼️</div>
                <div class="template-name">Poster</div>
                <div class="template-size">11" × 17"</div>
            </button>

            <button class="template-btn" onclick="generateTemplate('SLIDE', '${eventCode}')">
                <div class="template-icon">📊</div>
                <div class="template-name">PowerPoint Slide</div>
                <div class="template-size">16:9 format</div>
            </button>

            <button class="template-btn primary" onclick="generateTemplate('ALL', '${eventCode}')">
                <div class="template-icon">📁</div>
                <div class="template-name">All Templates (PDF)</div>
                <div class="template-size">Complete package</div>
            </button>
        </div>
    `);
    modal.show();
}
```

---

### 15. Migration Plan

#### 15.1 Backward Compatibility
Ensure existing QR codes continue to work:

```javascript
// Support both old and new QR code generation
function generateQRCodeCompatible(eventCode, options = {}) {
    // Check if new features are available
    if (typeof generateEnhancedQRCode === 'function' && options.enhanced) {
        return generateEnhancedQRCode(eventCode, options);
    }

    // Fall back to original implementation
    return generateQRCodeOriginal(eventCode, options);
}

// Original implementation preserved
function generateQRCodeOriginal(eventCode, options = {}) {
    const feedbackUrl = `${FEEDBACK_BASE_URL}?code=${eventCode}`;
    const canvas = options.canvas || document.getElementById('qrCanvas');

    QRCode.toCanvas(canvas, feedbackUrl, {
        width: 300,
        margin: 2,
        color: {
            dark: '#667eea',
            light: '#ffffff'
        }
    });
}
```

#### 15.2 Data Migration
Migrate existing events to include QR code URLs:

```sql
-- Add new columns with defaults
ALTER TABLE Events
ADD QrCodeUrl NVARCHAR(500) NULL,
    QrCodeGeneratedAt DATETIME2 NULL,
    QrCodeStorageEnabled BIT DEFAULT 0;

-- Script to regenerate QR codes for existing events
-- Run via admin script or Azure Function
```

```javascript
// Migration script
async function migrateExistingEvents() {
    const events = await fetchAllEvents();

    for (const event of events) {
        try {
            // Generate QR code with new system
            const qrCode = await generateEnhancedQRCode(event.eventCode, {
                size: 400,
                format: 'PNG',
                errorCorrection: 'H',
                colorScheme: QR_COLOR_SCHEMES.PRIMARY,
                storeInBlob: true
            });

            // Update database
            await updateEvent(event.eventId, {
                qrCodeUrl: qrCode.blobUrl,
                qrCodeGeneratedAt: new Date(),
                qrCodeStorageEnabled: true
            });

            console.log(`✓ Migrated event ${event.eventCode}`);
        } catch (error) {
            console.error(`✗ Failed to migrate event ${event.eventCode}:`, error);
        }
    }
}
```

---

### 16. Documentation Updates

#### 16.1 User Documentation

**Admin Guide: "How to Generate QR Codes"**
1. Navigate to Events tab
2. Click "View Details & QR" for your event
3. Customize QR code settings:
   - Choose size based on use case (digital vs print)
   - Select color scheme to match branding
   - Enable logo overlay for branded materials
4. Click "Download PNG" or "Download SVG"
5. For print materials, click "Print Templates" and select desired template

**Admin Guide: "Choosing the Right QR Code Settings"**
- **Digital displays:** 200px, Quartile error correction
- **Handouts/flyers:** 400px, High error correction, High contrast colors
- **Posters/banners:** 800px, High error correction, Include logo
- **Professional print:** Use SVG format for scalability

#### 16.2 Developer Documentation

**API Documentation: QR Code Endpoints**
```markdown
### POST /api/events/{eventId}/qr-code

Generate and optionally store a QR code for an event.

**Request Body:**
{
    "size": "PRINT_STANDARD",      // DIGITAL | PRINT_STANDARD | PRINT_HIGHRES
    "format": "PNG",                // PNG | SVG
    "errorCorrection": "H",         // L | M | Q | H
    "colorScheme": "PRIMARY",       // See color schemes
    "includeLogo": true,
    "storeInBlob": true
}

**Response:**
{
    "success": true,
    "data": {
        "qrCodeUrl": "https://storage.blob.core.windows.net/...",
        "dataUrl": "data:image/png;base64,...",
        "metadata": {
            "size": 400,
            "format": "PNG",
            "errorCorrection": "H",
            "generatedAt": "2026-02-05T10:00:00Z"
        }
    }
}
```

---

### 17. Cost Analysis

#### 17.1 Storage Costs
**Azure Blob Storage:**
- Hot tier: $0.0184/GB/month
- 1000 events × 5 QR codes each × 10 KB = 50 MB ≈ 0.05 GB
- Monthly cost: $0.0184 × 0.05 = **$0.00092/month** (~$0.01/month)

**Bandwidth:**
- 1000 QR code downloads/month × 10 KB = 10 MB
- First 5 GB free, then $0.087/GB
- Monthly cost: **$0** (under free tier)

**Total:** < $0.01/month for QR code storage

#### 17.2 Compute Costs
**Client-side generation:** Free (runs in browser)
**Server-side generation:** Azure Functions consumption plan
- 1000 QR code generations/month
- ~500ms execution time per generation
- $0.20 per million executions
- Monthly cost: **$0.0002** (~negligible)

**Total infrastructure cost:** < $0.02/month

---

### 18. Success Metrics

#### 18.1 Key Performance Indicators (KPIs)

**Technical Metrics:**
- QR code generation time < 500ms
- Scan success rate > 95%
- Download completion rate > 90%
- Print quality satisfaction > 90%

**Business Metrics:**
- QR code usage rate (% of feedback submitted via QR)
- Time saved vs manual URL entry
- Print cost reduction (vs professional design services)
- User satisfaction with QR code quality

#### 18.2 Monitoring Dashboard

Add to admin analytics:
```
┌─────────────────────────────────────┐
│  QR Code Analytics                  │
├─────────────────────────────────────┤
│  Total Generated: 1,234             │
│  Stored in Blob: 567 (46%)          │
│  Most Popular Size: 400px (65%)     │
│  Most Popular Format: PNG (85%)     │
│  Average Scan Rate: 87%             │
│  Storage Used: 12.3 MB              │
└─────────────────────────────────────┘
```

---

### 19. Future Enhancements

#### 19.1 Dynamic QR Codes
- QR code that can be updated to point to different events
- Useful for recurring sessions with same QR code

#### 19.2 QR Code Analytics
- Track scan location (geographic data)
- Track scan time distribution
- Track device types scanning codes

#### 19.3 Animated QR Codes
- Subtle animations for digital displays
- Attention-grabbing while maintaining scannability

#### 19.4 Personalized QR Codes
- Generate unique QR codes per attendee
- Track individual responses
- Gamification (badges for completing feedback)

#### 19.5 Multi-language QR Codes
- QR code detects device language
- Redirects to appropriate language version of form

---

### 20. Conclusion

This specification update provides a comprehensive framework for enhancing the QR code generation capability of the CAT Bootcamp Feedback Application. The proposed changes address current gaps, add valuable features, and establish a scalable foundation for future growth.

**Key Takeaways:**
- ✅ Standardized sizes and error correction levels
- ✅ Multiple format support (PNG, SVG, PDF)
- ✅ Professional print templates
- ✅ Azure Blob Storage integration
- ✅ Customization options for branding
- ✅ Accessibility considerations
- ✅ Minimal cost impact (< $0.02/month)
- ✅ Phased implementation approach

**Recommended Priority:**
1. **Phase 1** (Critical): Size standardization, error correction, color schemes
2. **Phase 2** (High): Azure Blob Storage integration
3. **Phase 3** (Medium): Print templates and SVG support
4. **Phase 4-6** (Low-Medium): Advanced features and optimizations

---

## Appendix

### A. Color Scheme Reference
```javascript
const QR_COLOR_SCHEMES = {
    PRIMARY: {
        dark: '#667eea',
        light: '#ffffff',
        name: 'Purple (Primary)',
        description: 'Default application color scheme'
    },
    MS_BLUE: {
        dark: '#0078d4',
        light: '#ffffff',
        name: 'Microsoft Blue',
        description: 'Official Microsoft brand color'
    },
    COPILOT_GREEN: {
        dark: '#10a37f',
        light: '#ffffff',
        name: 'Copilot Green',
        description: 'Copilot Studio brand color'
    },
    HIGH_CONTRAST: {
        dark: '#000000',
        light: '#ffffff',
        name: 'High Contrast',
        description: 'Maximum contrast for accessibility'
    },
    MONOCHROME: {
        dark: '#333333',
        light: '#ffffff',
        name: 'Monochrome',
        description: 'Professional gray for print'
    }
};
```

### B. Size Configuration Reference
```javascript
const QR_SIZES = {
    DIGITAL: {
        width: 200,
        label: 'Digital Display',
        useCase: 'Count display, quick preview',
        dpi: 72,
        errorCorrection: 'Q'
    },
    PRINT_STANDARD: {
        width: 400,
        label: 'Standard Print',
        useCase: 'Flyers, handouts, business cards',
        dpi: 300,
        errorCorrection: 'H'
    },
    PRINT_HIGHRES: {
        width: 800,
        label: 'High Resolution Print',
        useCase: 'Posters, banners, large format',
        dpi: 600,
        errorCorrection: 'H'
    }
};
```

### C. Library Dependencies
```json
{
  "dependencies": {
    "qrcode": "^1.5.3",           // QR code generation
    "jspdf": "^2.5.1",            // PDF generation
    "@azure/storage-blob": "^12.16.0", // Azure Blob Storage
    "jsdom": "^22.1.0"            // Server-side canvas (if needed)
  }
}
```

### D. Azure Blob Storage Configuration
```javascript
// config.js
const BLOB_CONFIG = {
    accountName: process.env.AZURE_STORAGE_ACCOUNT,
    containerName: 'qr-codes',
    sasToken: process.env.AZURE_STORAGE_SAS_TOKEN,
    baseUrl: `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`
};
```

---

**Document Version:** 1.0
**Last Updated:** 2026-02-05
**Author:** Claude Code Assistant
**Status:** Draft for Review
