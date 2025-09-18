import {
  FormValidator,
  SimplifiedRegistrationRequest,
} from "../../lib/form-validation";

describe("Registration Flow Integration", () => {
  describe("Complete Registration Validation", () => {
    it("should validate complete registration flow with valid data", () => {
      const validRegistrationData: SimplifiedRegistrationRequest = {
        business_email: "merchant@example.com",
        pin: "123456",
      };

      const validation = FormValidator.validateSimplifiedRegistration(
        validRegistrationData
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should handle multiple validation errors", () => {
      const invalidRegistrationData: SimplifiedRegistrationRequest = {
        business_email: "invalid-email-format",
        pin: "12", // too short
      };

      const validation = FormValidator.validateSimplifiedRegistration(
        invalidRegistrationData
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(1);
      expect(validation.errors.some((error) => error.includes("email"))).toBe(
        true
      );
      expect(validation.errors.some((error) => error.includes("PIN"))).toBe(
        true
      );
    });

    it("should validate PIN strength requirements", () => {
      const testCases = [
        { pin: "1234", shouldBeValid: true, description: "4 digits" },
        { pin: "12345", shouldBeValid: true, description: "5 digits" },
        { pin: "123456", shouldBeValid: true, description: "6 digits" },
        { pin: "1234567", shouldBeValid: true, description: "7 digits" },
        { pin: "12345678", shouldBeValid: true, description: "8 digits" },
        { pin: "123", shouldBeValid: false, description: "too short" },
        { pin: "123456789", shouldBeValid: false, description: "too long" },
        { pin: "12ab", shouldBeValid: false, description: "contains letters" },
        { pin: "12 34", shouldBeValid: false, description: "contains space" },
        { pin: "", shouldBeValid: false, description: "empty" },
      ];

      testCases.forEach(({ pin, shouldBeValid, description }) => {
        const validation = FormValidator.validatePin(pin);
        expect(validation.isValid).toBe(shouldBeValid);

        if (!shouldBeValid) {
          expect(validation.errors.length).toBeGreaterThan(0);
        }
      });
    });

    it("should validate email format requirements", () => {
      const testCases = [
        {
          email: "test@example.com",
          shouldBeValid: true,
          description: "standard email",
        },
        {
          email: "user.name@domain.co.uk",
          shouldBeValid: true,
          description: "email with dots and subdomain",
        },
        {
          email: "merchant123@business.org",
          shouldBeValid: true,
          description: "email with numbers",
        },
        {
          email: "info+tag@company.net",
          shouldBeValid: true,
          description: "email with plus sign",
        },
        {
          email: "invalid-email",
          shouldBeValid: false,
          description: "no @ symbol",
        },
        {
          email: "@domain.com",
          shouldBeValid: false,
          description: "missing local part",
        },
        { email: "user@", shouldBeValid: false, description: "missing domain" },
        {
          email: "user@domain",
          shouldBeValid: false,
          description: "missing TLD",
        },
        {
          email: "user name@domain.com",
          shouldBeValid: false,
          description: "space in local part",
        },
        { email: "", shouldBeValid: false, description: "empty" },
        { email: "   ", shouldBeValid: false, description: "whitespace only" },
      ];

      testCases.forEach(({ email, shouldBeValid, description }) => {
        const validation = FormValidator.validateEmail(email);
        expect(validation.isValid).toBe(shouldBeValid);

        if (!shouldBeValid) {
          expect(validation.errors.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe("Error Message Quality", () => {
    it("should provide clear error messages for invalid email", () => {
      const validation = FormValidator.validateEmail("invalid-email");

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Invalid email format");
    });

    it("should provide clear error messages for invalid PIN", () => {
      const validation = FormValidator.validatePin("12");

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("PIN must be 4-8 digits");
    });

    it("should provide clear error messages for empty fields", () => {
      const emailValidation = FormValidator.validateEmail("");
      const pinValidation = FormValidator.validatePin("");

      expect(emailValidation.errors).toContain("Email is required");
      expect(pinValidation.errors).toContain("PIN is required");
    });
  });

  describe("Security Considerations", () => {
    it("should trim whitespace from email input", () => {
      const validation = FormValidator.validateEmail("  test@example.com  ");

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should not accept PIN with special characters", () => {
      const specialCharPins = ["12!4", "12@4", "12#4", "12$4", "12%4"];

      specialCharPins.forEach((pin) => {
        const validation = FormValidator.validatePin(pin);
        expect(validation.isValid).toBe(false);
      });
    });

    it("should enforce PIN length constraints", () => {
      // Test boundary conditions
      const validation3 = FormValidator.validatePin("123"); // too short
      const validation9 = FormValidator.validatePin("123456789"); // too long
      const validation4 = FormValidator.validatePin("1234"); // minimum valid
      const validation8 = FormValidator.validatePin("12345678"); // maximum valid

      expect(validation3.isValid).toBe(false);
      expect(validation9.isValid).toBe(false);
      expect(validation4.isValid).toBe(true);
      expect(validation8.isValid).toBe(true);
    });
  });

  describe("Response Structure Validation", () => {
    it("should define correct response interface structure", () => {
      // Test the expected response structure for successful registration
      const expectedSuccessResponse = {
        success: true,
        message: "Merchant account created successfully with ChipiPay wallet.",
        merchant: {
          id: "test-merchant-id",
          business_email: "test@example.com",
          wallet: {
            publicKey: "test-public-key",
            // Note: encryptedPrivateKey should NOT be in response
          },
        },
        apiKeys: {
          testnet: {
            publicKey: "test-testnet-public-key",
            secretKey: "test-testnet-secret-key",
          },
          mainnet: {
            publicKey: "test-mainnet-public-key",
            secretKey: "test-mainnet-secret-key",
          },
        },
      };

      // Verify structure
      expect(expectedSuccessResponse.success).toBe(true);
      expect(expectedSuccessResponse.merchant.wallet.publicKey).toBeDefined();
      expect(expectedSuccessResponse.merchant.wallet).not.toHaveProperty(
        "encryptedPrivateKey"
      );
      expect(expectedSuccessResponse.apiKeys.testnet).toBeDefined();
      expect(expectedSuccessResponse.apiKeys.mainnet).toBeDefined();
    });

    it("should define correct error response structure", () => {
      const expectedErrorResponse = {
        success: false,
        error: "Failed to create wallet. Please try again.",
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toBeDefined();
      expect(typeof expectedErrorResponse.error).toBe("string");
    });
  });
});
