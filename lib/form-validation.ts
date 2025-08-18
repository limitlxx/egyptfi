// lib/form-validation.ts

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class FormValidator {
  // Validate business name
  static validateBusinessName(name: string): ValidationResult {
    const errors: string[] = [];
    const trimmedName = name.trim();

    if (!trimmedName) {
      errors.push('Business name is required');
    } else if (trimmedName.length < 2) {
      errors.push('Business name must be at least 2 characters long');
    } else if (trimmedName.length > 100) {
      errors.push('Business name cannot exceed 100 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate phone number
  static validatePhone(phone: string): ValidationResult {
    const errors: string[] = [];
    
    if (!phone.trim()) {
      // Phone is optional, so empty is valid
      return { isValid: true, errors: [] };
    }

    const cleanPhone = phone.replace(/\s/g, '');
    const phoneRegex = /^[\+]?[1-9][\d]{7,15}$/;

    if (!phoneRegex.test(cleanPhone)) {
      errors.push('Please enter a valid phone number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate currency code
  static validateCurrency(currency: string): ValidationResult {
    const errors: string[] = [];
    const supportedCurrencies = ['NGN', 'USD', 'EUR', 'GBP', 'GHS', 'KES'];

    if (!currency) {
      errors.push('Currency is required');
    } else if (!supportedCurrencies.includes(currency)) {
      errors.push('Unsupported currency selected');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate image file
  static validateImageFile(file: File): ValidationResult {
    const errors: string[] = [];
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      errors.push('File must be an image (PNG, JPG, GIF, etc.)');
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      errors.push('Image size must be less than 5MB');
    }

    // Check image dimensions (optional - you might want to add this)
    // This would require reading the image, which is more complex in the browser

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate webhook URL
  static validateWebhookUrl(url: string): ValidationResult {
    const errors: string[] = [];
    
    if (!url.trim()) {
      // Webhook URL is optional
      return { isValid: true, errors: [] };
    }

    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        errors.push('Webhook URL must use HTTP or HTTPS protocol');
      }
    } catch {
      errors.push('Please enter a valid webhook URL');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate all branding data
  static validateBrandingData(data: {
    businessName: string;
    currency: string;
    logoFile?: File;
  }): ValidationResult {
    const allErrors: string[] = [];

    const nameValidation = this.validateBusinessName(data.businessName);
    const currencyValidation = this.validateCurrency(data.currency);

    allErrors.push(...nameValidation.errors);
    allErrors.push(...currencyValidation.errors);

    if (data.logoFile) {
      const logoValidation = this.validateImageFile(data.logoFile);
      allErrors.push(...logoValidation.errors);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }

  // Validate all settings data
  static validateSettingsData(data: {
    phone: string;
    webhookUrl?: string;
  }): ValidationResult {
    const allErrors: string[] = [];

    const phoneValidation = this.validatePhone(data.phone);
    allErrors.push(...phoneValidation.errors);

    if (data.webhookUrl) {
      const webhookValidation = this.validateWebhookUrl(data.webhookUrl);
      allErrors.push(...webhookValidation.errors);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }
}

// Helper function to format phone numbers
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters except + at the beginning
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it starts with +, keep it, otherwise remove any + that isn't at the start
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\+/g, '');
  }
  
  return cleaned.replace(/\+/g, '');
}

// Helper function to format currency display
export function formatCurrency(amount: number, currency: string): string {
  const symbols = {
    NGN: '₦',
    USD: '$',
    EUR: '€',
    GBP: '£',
    GHS: 'GH₵',
    KES: 'KSh'
  };

  const symbol = symbols[currency as keyof typeof symbols] || currency;
  return `${symbol}${amount.toLocaleString()}`;
}

// File size formatter
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}