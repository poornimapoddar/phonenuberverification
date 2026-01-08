'use client';

import { useState, useEffect, useRef } from 'react';
import { parsePhoneNumber, isValidPhoneNumber, AsYouType } from 'libphonenumber-js';
import styles from './PhoneVerification.module.css';

interface PhoneInfo {
  country?: string;
  countryCallingCode?: string;
  nationalNumber?: string;
  formattedNumber?: string;
}

export default function PhoneVerification() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [showOTPSection, setShowOTPSection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [phoneInfo, setPhoneInfo] = useState<PhoneInfo | null>(null);
  const [phoneValidation, setPhoneValidation] = useState<{
    isValid: boolean;
    country?: string;
    formatted?: string;
    error?: string;
  }>({ isValid: false });

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to send messages to parent window safely
  const sendMessage = (type: string, payload: any = {}) => {
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({ type, ...payload }, '*');
    }
  };

  // Report height changes to parent
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        sendMessage('WIDGET_RESIZE', { height: containerRef.current.offsetHeight + 40 }); // +40 for padding
      }
    });

    observer.observe(containerRef.current);
    // Initial size report
    sendMessage('WIDGET_RESIZE', { height: containerRef.current.offsetHeight + 40 });

    return () => observer.disconnect();
  }, [showOTPSection, error, otpError, phoneValidation]);

  // Real-time phone number validation and formatting
  useEffect(() => {
    if (!phone) {
      setPhoneValidation({ isValid: false });
      setPhoneInfo(null);
      return;
    }

    try {
      // Use AsYouType for real-time formatting
      const formatter = new AsYouType();
      const formatted = formatter.input(phone);

      // Strategy 1: Check if it's already a valid international number
      if (isValidPhoneNumber(phone)) {
        const parsed = parsePhoneNumber(phone);
        setPhoneValidation({
          isValid: true,
          country: parsed.country,
          formatted: parsed.formatInternational(),
        });
        setPhoneInfo({
          country: parsed.country,
          countryCallingCode: parsed.countryCallingCode,
          nationalNumber: parsed.nationalNumber,
          formattedNumber: parsed.formatInternational(),
        });
        setError('');
        return;
      }

      // Strategy 2: Check for Implicit International (missing +) - PRIMARY GLOBAL STRATEGY
      // This catches cases where user types '198...' (US) or '9198...' (IN) without +
      const withPlus = '+' + phone.replace(/\D/g, '');
      if (isValidPhoneNumber(withPlus)) {
        const parsed = parsePhoneNumber(withPlus);
        setPhoneValidation({
          isValid: true,
          country: parsed.country,
          formatted: parsed.formatInternational(),
        });
        setPhoneInfo({
          country: parsed.country,
          countryCallingCode: parsed.countryCallingCode,
          nationalNumber: parsed.nationalNumber,
          formattedNumber: parsed.formatInternational(),
        });
        setError('');
        return;
      }

      // Strategy 3: Prioritize UK (GB) - Local fallback
      // Check standard UK format or UK missing leading zero (common user input)
      if (isValidPhoneNumber(phone, 'GB') || isValidPhoneNumber('0' + phone, 'GB')) {
        // If it needs a leading zero to be valid, add it for parsing
        const phoneToParse = isValidPhoneNumber(phone, 'GB') ? phone : '0' + phone;
        const parsed = parsePhoneNumber(phoneToParse, 'GB');

        setPhoneValidation({
          isValid: true,
          country: parsed.country,
          formatted: parsed.formatInternational(),
        });
        setPhoneInfo({
          country: parsed.country,
          countryCallingCode: parsed.countryCallingCode,
          nationalNumber: parsed.nationalNumber,
          formattedNumber: parsed.formatInternational(),
        });
        setError('');
        return;
      }

      // Strategy 4: Check India (IN) - Local fallback
      if (isValidPhoneNumber(phone, 'IN')) {
        const parsed = parsePhoneNumber(phone, 'IN');
        setPhoneValidation({
          isValid: true,
          country: parsed.country,
          formatted: parsed.formatInternational(),
        });
        setPhoneInfo({
          country: parsed.country,
          countryCallingCode: parsed.countryCallingCode,
          nationalNumber: parsed.nationalNumber,
          formattedNumber: parsed.formatInternational(),
        });
        setError('');
        return;
      }

      // Invalid or incomplete
      if (phone.length > 0) {
        setPhoneValidation({
          isValid: false,
          formatted: formatted,
          error: phone.length < 8 ? 'Enter a valid phone number' : 'Invalid format',
        });
      }
      setPhoneInfo(null);
    } catch (error) {
      setPhoneValidation({
        isValid: false,
        error: 'Invalid format',
      });
      setPhoneInfo(null);
    }
  }, [phone]);

  // Lookup phone with Twilio when locally valid
  useEffect(() => {
    if (!phoneValidation.isValid || !phone) return;

    const timer = setTimeout(async () => {
      setLoading(true); // Soft loading state or specific lookup state
      try {
        const response = await fetch('/api/phone-verification/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phone,
            clientName: 'test' // Ensure we use correct creds
          }),
        });

        const data = await response.json();

        if (data.success && data.phoneInfo) {
          // Update with authoritative info from Twilio/Backend
          setPhoneInfo({
            country: data.phoneInfo.countryCode,
            // Map keys correctly based on your API response
            // The API returns phoneNumber, countryCode, nationalFormat, etc.
            countryCallingCode: data.parsedInfo?.countryCallingCode || '',
            nationalNumber: data.phoneInfo.nationalFormat,
            formattedNumber: data.phoneInfo.internationalFormat,
          });

          // Double check if backend detection differs from local or just to ensure consistency
          if (data.phoneInfo.countryCode) {
            setPhoneValidation(prev => ({
              ...prev,
              isValid: true,
              country: data.phoneInfo.countryCode,
              formatted: data.phoneInfo.internationalFormat
            }));
          }
        }
      } catch (err) {
        console.error('Lookup failed', err);
      } finally {
        setLoading(false);
      }
    }, 1500); // 1.5s debounce to avoid spamming API while typing

    return () => clearTimeout(timer);
  }, [phone, phoneValidation.isValid]);

  // Load phone from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPhone = sessionStorage.getItem('phoneNumber');
      if (storedPhone) {
        setPhone(storedPhone);
      }
    }
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only digits, +, spaces, and dashes
    if (/^[\d\s\+\-\(\)]*$/.test(value) || value === '') {
      setPhone(value);
      setError('');
    }
  };

  const sendOTP = async () => {
    setError('');
    setOtpError('');

    // Validate phone number before sending
    if (!phone) {
      setError('Please enter a phone number');
      return;
    }

    // Use our smart validation state instead of base isValidPhoneNumber
    if (!phoneValidation.isValid) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/phone-verification/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneInfo?.formattedNumber || phone, // Use formatted number to ensure correct country code
          clientName: 'test', // You can make this dynamic
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowOTPSection(true);
        setPhoneInfo(data.phoneInfo || null);
        // Focus first OTP input
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);
      } else {
        if (data.error?.includes('Too many OTP requests')) {
          setError('Too many OTP requests. Please try again after 24 hours.');
        } else {
          setError(data.error || 'Failed to send OTP. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setError('An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError('');

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').slice(0, 6).split('');
    const newOtp = [...otp];

    pasteData.forEach((char, index) => {
      if (index < 6 && /^\d$/.test(char)) {
        newOtp[index] = char;
      }
    });

    setOtp(newOtp);
    const nextIndex = Math.min(pasteData.length, 5);
    otpInputRefs.current[nextIndex]?.focus();
  };



  const verifyOTP = async () => {
    setOtpError('');
    const otpString = otp.join('');

    // Validate OTP format
    if (!/^\d{4,6}$/.test(otpString)) {
      setOtpError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/phone-verification/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneInfo?.formattedNumber || phone,
          otp: otpString,
          clientName: 'test', // You can make this dynamic
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Send success message to parent window
        sendMessage('PHONE_VERIFIED', {
          phone: phoneInfo?.formattedNumber || phone,
          country: phoneInfo?.country
        });

        // Send verified data to Zapier (if needed)
        sendVerifiedDataToZapier();
      } else {
        setOtpError(data.error || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      setOtpError('An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const sendVerifiedDataToZapier = () => {
    if (typeof window === 'undefined') return;

    const zapierURL = sessionStorage.getItem('zapierURL');
    const zapierPostData = sessionStorage.getItem('zapierPostData');
    const recordID = sessionStorage.getItem('recordID');
    const nextPageURL = sessionStorage.getItem('nextPageURL');

    if (!zapierURL || !zapierPostData) {
      console.warn('Zapier data not found in sessionStorage');
      if (nextPageURL) {
        window.location.href = nextPageURL;
      }
      return;
    }

    try {
      const postData = JSON.parse(zapierPostData);
      postData.refId = recordID;
      postData.phone = phone;
      postData.PhonNo = phone;
      postData.varifiedPhoneNumber = phone;
      postData.tag = 'verified quote';

      fetch(zapierURL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      })
        .then(() => {
          console.log('Session data sent to webhook successfully');
          if (nextPageURL) {
            window.location.href = nextPageURL;
          }
        })
        .catch((error) => {
          console.error('Error sending session data to webhook:', error);
          if (nextPageURL) {
            window.location.href = nextPageURL;
          }
        });
    } catch (error) {
      console.error('Error parsing Zapier data:', error);
      if (nextPageURL) {
        window.location.href = nextPageURL;
      }
    }
  };

  return (
    <div className={styles.otpBox} ref={containerRef}>
      <div className={styles.innerBox}>
        {!showOTPSection ? (
          <div className={styles.numberSection}>
            <h2 className={styles.heading}>Verify Your Phone</h2>
            <p className={styles.subheading}>We'll send you a verification code</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendOTP();
              }}
              className={styles.form}
            >
              <label htmlFor="phone" className={styles.formLabel}>Phone Number</label>
              <div className={styles.inputWrapper}>
                <span className={styles.phoneIcon}>📞</span>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="+1 234 567 8900"
                  className={styles.phoneInput}
                  required
                />
              </div>
              {phoneValidation.formatted && phoneValidation.formatted !== phone && (
                <p className={styles.phoneHint}>
                  Suggested format: {phoneValidation.formatted}
                </p>
              )}
              {phoneInfo && (
                <div className={styles.phoneInfo}>
                  <span className={styles.phoneInfoIcon}>🌍</span>
                  <div className={styles.phoneInfoContent}>
                    <p className={styles.phoneInfoText}>Country: {phoneInfo.country}</p>
                    <p className={styles.phoneInfoText}>Number: {phoneInfo.formattedNumber}</p>
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !phoneValidation.isValid}
                className={styles.button}
              >
                <span className={styles.buttonContent}>
                  {loading && <span className={styles.loadingSpinner}></span>}
                  {loading ? 'Sending Code...' : 'Send Verification Code'}
                </span>
              </button>
              {error && <p className={styles.errorMessage}>{error}</p>}
              {phone && !phoneValidation.isValid && phoneValidation.error && (
                <p className={styles.errorMessage}>{phoneValidation.error}</p>
              )}
            </form>
          </div>
        ) : (
          <div className={styles.otpSection}>
            <h2 className={styles.heading}>Enter Verification Code</h2>
            <p className={styles.subheading}>Check your messages for the code</p>
            <div className={styles.phoneDisplay}>
              {phoneInfo?.formattedNumber || phone}
            </div>
            {phoneInfo && (
              <div className={styles.successBadge}>
                ✓ Code sent successfully
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyOTP();
              }}
              className={styles.form}
            >
              <label htmlFor="otp" className={styles.formLabel}>
                Enter 6-digit code
              </label>
              <div className={styles.otpInputs}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOTPChange(index, e.target.value)}
                    onKeyDown={(e) => handleOTPKeyDown(index, e)}
                    onPaste={index === 0 ? handleOTPPaste : undefined}
                    ref={(el) => { otpInputRefs.current[index] = el; }}
                    className={styles.otpInput}
                    required
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className={styles.button}
              >
                <span className={styles.buttonContent}>
                  {loading && <span className={styles.loadingSpinner}></span>}
                  {loading ? 'Verifying...' : 'Verify Code'}
                </span>
              </button>
              {otpError && <p className={styles.errorMessage}>{otpError}</p>}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

