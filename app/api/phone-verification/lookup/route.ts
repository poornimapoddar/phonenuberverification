import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

function getTwilioCredentials(clientName: string) {
  switch (clientName) {
    case 'ISES':
      return {
        accountSid: process.env.ISES_ACCOUNT_SID,
        authToken: process.env.ISES_AUTH_TOKEN,
      };
    case 'test':
    case 'POORNIMA':
      return {
        accountSid: process.env.test_ACCOUNT_SID || process.env.POORNIMA_ACCOUNT_SID,
        authToken: process.env.test_AUTH_TOKEN || process.env.POORNIMA_AUTH_TOKEN,
      };
    default:
      return {
        accountSid: '',
        authToken: '',
      };
  }
}

/**
 * Twilio Lookup API endpoint
 * This endpoint uses Twilio's Lookup API to validate and get information about a phone number
 * including country, carrier, and line type information.
 * 
 * Note: Twilio Lookup API requires a paid account. This is optional - we already use
 * libphonenumber-js for country detection, but Twilio Lookup provides additional validation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, clientName } = body;

    // Validate phone number format
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Use libphonenumber-js to parse and normalize
    const { defaultCountry } = body;
    let normalizedPhone = phone;

    try {
      // If it doesn't start with +, try auto-detection strategies
      if (!phone.startsWith('+')) {
        let parsedWithDefault = null;

        // Strategy 0: Check if valid in defaultCountry (if provided)
        if (defaultCountry) {
          try {
            const parsed = parsePhoneNumber(phone, defaultCountry as any);
            if (parsed && (parsed.isValid() || parsed.isPossible())) {
              normalizedPhone = parsed.number;
              parsedWithDefault = true;
            }
          } catch (e) {
            // Ignore parsing error for default country
          }
        }

        if (!parsedWithDefault) {
          // Strategy 1: Check for Implicit International (missing +) - PRIMARY GLOBAL
          // This catches cases where user types '198...' (US) or '9198...' (IN) without +
          const withPlus = '+' + phone.replace(/\D/g, '');
          if (isValidPhoneNumber(withPlus)) {
            normalizedPhone = withPlus;
          }
          // Strategy 2: Prioritize UK (GB) - Local fallback
          else if (isValidPhoneNumber(phone, 'GB') || isValidPhoneNumber('0' + phone, 'GB')) {
            const phoneToParse = isValidPhoneNumber(phone, 'GB') ? phone : '0' + phone;
            const parsed = parsePhoneNumber(phoneToParse, 'GB');
            normalizedPhone = parsed.number;
          }
          // Strategy 3: Check India (IN) - Local fallback
          else if (isValidPhoneNumber(phone, 'IN')) {
            const parsed = parsePhoneNumber(phone, 'IN');
            normalizedPhone = parsed.number;
          }
          // Strategy 4: Final fallback using provided defaultCountry
          else if (defaultCountry) {
            try {
              const parsed = parsePhoneNumber(phone, defaultCountry as any);
              if (parsed && parsed.isValid()) {
                normalizedPhone = parsed.number;
              }
            } catch (e) { }
          }
        }
      }
    } catch (e) {
      console.warn('Phone parsing failed:', e);
    }

    if (!isValidPhoneNumber(normalizedPhone)) {
      return NextResponse.json(
        { success: false, error: ' format' },
        { status: 400 }
      );
    }

    // Define formattedNumber for consistency
    const formattedNumber = parsePhoneNumber(normalizedPhone).formatInternational();

    // Get Twilio credentials
    const credentials = getTwilioCredentials(clientName || 'ISES');

    if (!credentials.accountSid || !credentials.authToken) {
      console.warn('Twilio credentials not configured for client:', clientName);
      // Fallback to libphonenumber-js locally if credentials missing
      const parsed = parsePhoneNumber(normalizedPhone);
      return NextResponse.json({
        success: true,
        phoneInfo: {
          phoneNumber: formattedNumber,
          countryCode: parsed.country,
          nationalFormat: parsed.formatNational(),
          internationalFormat: formattedNumber,
        },
        parsedInfo: {
          country: parsed.country,
          countryCallingCode: parsed.countryCallingCode,
          formattedNumber: formattedNumber,
        },
        note: 'Using libphonenumber-js (Twilio credentials missing)',
      });
    }

    // Initialize Twilio client
    const client = twilio(credentials.accountSid, credentials.authToken);

    try {
      // Use Twilio Lookup API to get phone number information
      const phoneNumber = await client.lookups.v2
        .phoneNumbers(normalizedPhone)
        .fetch();

      return NextResponse.json({
        success: true,
        phoneInfo: {
          phoneNumber: phoneNumber.phoneNumber,
          countryCode: phoneNumber.countryCode,
          nationalFormat: phoneNumber.nationalFormat,
          internationalFormat: phoneNumber.phoneNumber,
          // Additional info if available
          carrier: phoneNumber.callerName?.caller_name || null,
          lineType: phoneNumber.lineTypeIntelligence?.type || null,
        },
        // Also include libphonenumber-js parsed info
        parsedInfo: {
          country: parsePhoneNumber(phone).country,
          countryCallingCode: parsePhoneNumber(phone).countryCallingCode,
          formattedNumber: formattedNumber,
        },
      });
    } catch (twilioError: any) {
      // If Twilio Lookup fails (e.g., not available on free tier), fall back to libphonenumber-js
      console.warn('Twilio Lookup API not available, using libphonenumber-js:', twilioError.message);

      const parsed = parsePhoneNumber(normalizedPhone);
      return NextResponse.json({
        success: true,
        phoneInfo: {
          phoneNumber: formattedNumber,
          countryCode: parsed.country,
          nationalFormat: parsed.formatNational(),
          internationalFormat: formattedNumber,
        },
        parsedInfo: {
          country: parsed.country,
          countryCallingCode: parsed.countryCallingCode,
          formattedNumber: formattedNumber,
        },
        note: 'Using libphonenumber-js (Twilio Lookup not available)',
      });
    }
  } catch (error: any) {
    console.error('Error in phone lookup:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to lookup phone number' },
      { status: 500 }
    );
  }
}

