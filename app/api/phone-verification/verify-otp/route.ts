import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

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
    const body = await request.json();
    const { phone, otp, clientName } = body;

    // Validate inputs
    if (!phone || !otp) {
      return NextResponse.json(
        { success: false, error: 'Phone number and OTP are required' },
        { status: 400 }
      );
    }

    // Parse and format phone number with smart logic
    let formattedNumber;
    try {
      let parsedPhone;
      if (!phone.startsWith('+')) {
        // Strategy 1: Check for Implicit International (missing +) - PRIMARY GLOBAL
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
      formattedNumber = parsedPhone.formatInternational();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone format' },
        { status: 400 }
      );
    }

    // Validate OTP format (4-6 digits)
    if (!/^\d{4,6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: 'Invalid OTP format. OTP must be 4-6 digits.' },
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
        },
        { status: 500 }
      );
    }

    // Initialize Twilio client
    const client = twilio(credentials.accountSid, credentials.authToken);

    // Verify OTP using Twilio Verify API
    const verificationCheck = await client.verify.v2
      .services(credentials.verifyServiceSid)
      .verificationChecks
      .create({
        to: formattedNumber,
        code: otp
      });

    if (verificationCheck.status === 'approved') {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid OTP. Please try again.' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error verifying OTP:', error);

    // Handle Twilio-specific errors
    if (error.code === 20404) {
      return NextResponse.json(
        { success: false, error: 'OTP verification expired. Please request a new OTP.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify OTP. Please try again.' },
      { status: 500 }
    );
  }
}

