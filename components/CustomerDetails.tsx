'use client';

import { useState, useEffect } from 'react';
import { parsePhoneNumber, isValidPhoneNumber, AsYouType, getCountries, getCountryCallingCode, CountryCode } from 'libphonenumber-js';
import { useRouter } from 'next/navigation';
import styles from './CustomerDetails.module.css';

interface PhoneInfo {
  country?: string;
  countryCallingCode?: string;
  nationalNumber?: string;
  formattedNumber?: string;
}

interface CustomerData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
}

export default function CustomerDetails() {
  const router = useRouter();
  const [formData, setFormData] = useState<CustomerData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    countryCode: 'IN',
  });
  const [isMounted, setIsMounted] = useState(false);

  const [phoneValidation, setPhoneValidation] = useState<{
    isValid: boolean;
    country?: string;
    formatted?: string;
    error?: string;
  }>({ isValid: false });

  const [phoneInfo, setPhoneInfo] = useState<PhoneInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Detect default country from browser (DISABLED per user request)
  /*
  */

  const [countries] = useState(() => getCountries());

  // Auto-detect country code from phone number
  useEffect(() => {
    if (!formData.phone) {
      setPhoneValidation({ isValid: false });
      setPhoneInfo(null);
      if (formData.countryCode) {
        setFormData(prev => ({ ...prev, countryCode: '' }));
      }
      return;
    }

    try {
      const formatter = new AsYouType();
      const formatted = formatter.input(formData.phone);

      // If phone starts with +, try to detect country
      if (formData.phone.startsWith('+')) {
        if (isValidPhoneNumber(formData.phone)) {
          const parsed = parsePhoneNumber(formData.phone);
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

          // Auto-update country code (DISABLED PER USER REQUEST)
          /*
          if (parsed.country) {
            setFormData(prev => ({ ...prev, countryCode: parsed.country! }));
          }
          */
          setError('');
          return;
        } else {
          // Try to detect country from partial number
          const detectedCountry = formatter.getCountry();
          if (detectedCountry) {
            // setFormData(prev => ({ ...prev, countryCode: detectedCountry })); // DISABLED PER USER REQUEST
            setPhoneValidation({
              isValid: false,
              country: detectedCountry,
              formatted: formatted,
              error: 'Complete the phone number',
            });
          } else {
            setPhoneValidation({
              isValid: false,
              formatted: formatted,
              error: 'Enter a valid phone number with country code',
            });
          }
          setPhoneInfo(null);
        }
      } else if (formData.countryCode) {
        // If country code is selected but phone doesn't start with +
        // Try to parse with country code
        try {
          const fullNumber = `+${getCountryCallingCode(formData.countryCode as CountryCode)}${formData.phone}`;
          if (isValidPhoneNumber(fullNumber)) {
            const parsed = parsePhoneNumber(fullNumber);
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
          } else {
            setPhoneValidation({
              isValid: false,
              error: ' for selected country',
            });
            setPhoneInfo(null);
          }
        } catch (e) {
          setPhoneValidation({
            isValid: false,
            error: ' format',
          });
          setPhoneInfo(null);
        }
        // Only auto-detect from raw digits if NO country is selected yet
        if (!formData.countryCode) {
          const rawPhone = formData.phone.replace(/\D/g, '');
          if (rawPhone.length >= 10) {
            try {
              const withPlus = '+' + rawPhone;
              if (isValidPhoneNumber(withPlus)) {
                const parsed = parsePhoneNumber(withPlus);
                if (parsed.country) {
                  // setFormData(prev => ({ ...prev, countryCode: parsed.country! })); // DISABLED PER USER REQUEST
                  return;
                }
              }
            } catch (e) {
              // Ignore
            }
          }
        }

        setPhoneValidation({
          isValid: false,
          error: '',
        });
        setPhoneInfo(null);
      }
    } catch (error) {
      setPhoneValidation({
        isValid: false,
        error: ' format',
      });
      setPhoneInfo(null);
    }
  }, [formData.phone, formData.countryCode]);

  // Load from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('customerData');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setFormData(data);
        } catch (e) {
          console.error('Error loading customer data:', e);
        }
      }
    }
  }, []);

  // Debounced Twilio Lookup for auto-detecting country
  useEffect(() => {
    // Only perform background lookup if we really need to confirm or if user starts with +
    const rawDigits = formData.phone.replace(/\D/g, '');
    if (rawDigits.length < 8 || (!formData.phone.startsWith('+') && formData.countryCode)) return;

    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/phone-verification/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: formData.phone,
            defaultCountry: formData.countryCode, // Only send if selected
            clientName: 'test'
          }),
        });

        const data = await response.json();
        if (data.success && data.phoneInfo.countryCode) {
          // Auto-update country and format number (DISABLED PER USER REQUEST)
          /*
          setFormData(prev => ({
            ...prev,
            countryCode: data.phoneInfo.countryCode,
            // phone: data.phoneInfo.internationalFormat // Optional: uncomment if you want to auto-format while typing
          }));
          */

          setPhoneInfo({
            country: data.phoneInfo.countryCode,
            countryCallingCode: data.parsedInfo?.countryCallingCode || '',
            nationalNumber: data.phoneInfo.nationalFormat || '',
            formattedNumber: data.phoneInfo.internationalFormat,
          });

          setPhoneValidation({
            isValid: true,
            country: data.phoneInfo.countryCode,
            formatted: data.phoneInfo.internationalFormat,
          });
          setError('');
        }
      } catch (err) {
        console.warn('Auto-lookup failed:', err);
      }
    }, 1500); // Increased debounce to 1.5s for better typing experience

    return () => clearTimeout(timer);
  }, [formData.phone]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only digits, +, spaces, and dashes
    if (/^[\d\s\+\-\(\)]*$/.test(value) || value === '') {
      setFormData(prev => ({ ...prev, phone: value }));
      setError('');
    }
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const countryCode = e.target.value;
    setFormData(prev => ({ ...prev, countryCode }));

    // If phone doesn't start with +, update it with country code
    if (formData.phone && !formData.phone.startsWith('+') && countryCode) {
      const callingCode = getCountryCallingCode(countryCode as CountryCode);
      // Don't auto-update if user is typing, just set the country
    }
  };

  const validateForm = (): boolean => {
    if (!formData.firstName.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.lastName.trim()) {
      setError('Last name is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!phoneValidation.isValid) {
      setError('Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Optional: Validate phone with Twilio Lookup API
      const formattedPhone = phoneInfo?.formattedNumber || formData.phone;

      // Save customer data to sessionStorage
      const customerData = {
        ...formData,
        phone: formattedPhone,
        phoneInfo: phoneInfo,
      };

      sessionStorage.setItem('customerData', JSON.stringify(customerData));
      sessionStorage.setItem('phoneNumber', formattedPhone);

      // Navigate to phone verification page
      router.push('/verify-phone');
    } catch (error) {
      console.error('Error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getCountryName = (countryCode: string) => {
    try {
      const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
      return regionNames.of(countryCode.toUpperCase()) || countryCode;
    } catch {
      return countryCode;
    }
  };
  return (
    <div className={styles.container}>
      <div className={styles.formBox}>
        <div className={styles.innerForm}>
          <h2 className={styles.heading}>Customer Information</h2>
          <p className={styles.subheading}>Please fill in your details to continue</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label htmlFor="firstName" className={styles.label}>
                  First Name <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="John"
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="lastName" className={styles.label}>
                  Last Name <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Doe"
                  className={styles.input}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>
                Email Address <span className={styles.required}>*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john.doe@example.com"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="phone" className={styles.label}>
                Phone Number <span className={styles.required}>*</span>
              </label>
              <div className={styles.phoneWrapper}>
                <select
                  id="countryCode"
                  name="countryCode"
                  value={formData.countryCode}
                  onChange={handleCountryChange}
                  className={styles.countrySelect}
                >
                  <option value="">Select</option>
                  {isMounted && countries.map((country) => (
                    <option key={country} value={country}>
                      {getCountryName(country)} (+{getCountryCallingCode(country)})
                    </option>
                  ))}
                </select>
                <div className={styles.phoneInputWrapper}>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    placeholder="Enter your phone number"
                    className={styles.phoneInput}
                    required
                  />
                </div>
              </div>
              {phoneValidation.formatted && (
                <p className={styles.phoneHint}>
                  💡 Format: {phoneValidation.formatted}
                </p>
              )}
              {/* phoneInfo logic removed to match the requested simple UI */}
              {phoneValidation.error && (
                <p className={styles.errorMessage}>{phoneValidation.error}</p>
              )}
            </div>


            {error && <p className={styles.errorMessage}>{error}</p>}

            <button
              type="submit"
              disabled={loading || !phoneValidation.isValid}
              className={styles.button}
            >
              <span className={styles.buttonContent}>
                {loading && <span className={styles.loadingSpinner}></span>}
                {loading ? 'Processing...' : 'Continue to Verification'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

