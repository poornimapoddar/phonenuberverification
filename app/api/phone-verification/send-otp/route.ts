import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

// Rate limiting configuration (simple in-memory store for demo)
// In production, use Redis or similar
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000; // 24 hours
  const maxRequests = 6000;

  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

function getTwilioCredentials(clientName: string) {
  switch (clientName) {
    case 'ISES':
      return {
        accountSid: process.env.ISES_ACCOUNT_SID,
        authToken: process.env.ISES_AUTH_TOKEN,
        verifyServiceSid: process.env.ISES_VERIFY_SERVICE_ID,
      };
    case 'test':
    case 'POORNIMA':
      return {
        accountSid: process.env.test_ACCOUNT_SID || process.env.POORNIMA_ACCOUNT_SID,
        authToken: process.env.test_AUTH_TOKEN || process.env.POORNIMA_AUTH_TOKEN,
        verifyServiceSid: process.env.test_VERIFY_SERVICE_ID || process.env.POORNIMA_VERIFY_SERVICE_ID,
      };
    default:
      return {
        accountSid: '',
        authToken: '',
        verifyServiceSid: '',
      };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many OTP requests from this IP, please try again after 24 hours'
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { phone, clientName } = body;

    // Validate phone number format and country
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate and Parse phone number with smart logic (Prioritize IN/GB)
    let parsedPhone;
    let normalizedPhoneStr = phone;

    try {
      if (!phone.startsWith('+')) {
        // Strategy 1: Check for Implicit International (missing +) - PRIMARY GLOBAL
        // This catches cases where user types '198...' (US) or '9198...' (IN) without +
        const withPlus = '+' + phone.replace(/\D/g, '');
        if (isValidPhoneNumber(withPlus)) {
          parsedPhone = parsePhoneNumber(withPlus);
        }
        // Strategy 2: Prioritize UK (GB) - Local fallback
        else if (isValidPhoneNumber(phone, 'GB') || isValidPhoneNumber('0' + phone, 'GB')) {
          const phoneToParse = isValidPhoneNumber(phone, 'GB') ? phone : '0' + phone;
          parsedPhone = parsePhoneNumber(phoneToParse, 'GB');
        }
        // Strategy 3: Check India (IN) - Local fallback
        else if (isValidPhoneNumber(phone, 'IN')) {
          parsedPhone = parsePhoneNumber(phone, 'IN');
        }
      } else {
        parsedPhone = parsePhoneNumber(phone);
      }
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone format. Please check your country code.' },
        { status: 400 }
      );
    }

    if (!parsedPhone || !parsedPhone.isValid()) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format.' },
        { status: 400 }
      );
    }

    // Get country information
    const country = parsedPhone.country;
    const countryCallingCode = parsedPhone.countryCallingCode;
    const nationalNumber = parsedPhone.nationalNumber;
    const formattedNumber = parsedPhone.formatInternational();

    // Additional validation: Check if number is possible
    if (!parsedPhone.isPossible()) {
      return NextResponse.json(
        { success: false, error: 'Phone number is not possible. Please check your number.' },
        { status: 400 }
      );
    }

    // Get Twilio credentials
    const credentials = getTwilioCredentials(clientName);

    if (!credentials.accountSid || !credentials.authToken || !credentials.verifyServiceSid) {
      console.error(`Missing credentials for client: ${clientName}`);
      return NextResponse.json(
        {
          success: false,
          error: `Twilio credentials missing for ${clientName}. Please check your .env file.`,
          debug: { clientName }
        },
        { status: 500 } // Server configuration error
      );
    }

    // Initialize Twilio client
    const client = twilio(credentials.accountSid, credentials.authToken);

    // Send OTP using Twilio Verify API
    const verification = await client.verify.v2
      .services(credentials.verifyServiceSid)
      .verifications
      .create({
        to: formattedNumber, // Use formatted international number
        channel: 'sms'
      });

    return NextResponse.json({
      success: true,
      phoneInfo: {
        country,
        countryCallingCode,
        nationalNumber,
        formattedNumber,
      }
    });
  } catch (error: any) {
    console.error('Error sending OTP:', error);

    // Handle Twilio-specific errors
    if (error.code === 60200) {
      return NextResponse.json(
        { success: false, error: '. Please check your number and try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send OTP. Please try again.' },
      { status: 500 }
    );
  }
}

