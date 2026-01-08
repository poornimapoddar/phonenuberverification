# Quick Start Guide

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `env.example` to `.env.local`
   - Fill in your Twilio credentials:
     ```
     ISES_ACCOUNT_SID=your_account_sid_here
     ISES_AUTH_TOKEN=your_auth_token_here
     ISES_VERIFY_SERVICE_ID=your_verify_service_id_here
     ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Features Implemented

✅ **Phone Number Intelligence:**
- Real-time phone number validation
- Country detection from phone number
- Automatic formatting as user types
- Validation before sending OTP (prevents invalid requests)

✅ **OTP Flow:**
- Send OTP only if phone number is valid
- 6-digit OTP verification
- Rate limiting (6000 requests per 24 hours per IP)

✅ **Modern UI:**
- React component with TypeScript
- Real-time validation feedback
- Country and format display
- Smooth user experience

## API Endpoints

All endpoints are available at `/api/phone-verification/`:

- `POST /send-otp` - Sends OTP (validates phone number first)
- `POST /verify-otp` - Verifies OTP code
- `GET /test` - Test endpoint
- `GET /` - Health check

## Phone Number Validation

The system validates phone numbers using `libphonenumber-js`:
- Checks format validity
- Detects country
- Formats numbers in real-time
- Only sends OTP if number is valid and possible

## Migration from HTML/Express

The original Express server endpoints have been converted to Next.js API routes:
- Same endpoint paths
- Same request/response format
- Enhanced with phone number validation
- Rate limiting included

