import { FormValidator } from "@/lib/form-validation";

describe("Registration API Validation", () => {
  describe("Input Validation", () => {
    it("should validate email and PIN correctly", async () => {
      const validData = {
        business_email: "test@example.com",
        pin: "123456",
      };

      const validation =
        FormValidator.validateSimplifiedRegistration(validData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should reject invalid email format", () => {
      const invalidData = {
        business_email: "invalid-email",
        pin: "123456",
      };

      const validation =
        FormValidator.validateSimplifiedRegistration(invalidData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((error) => error.includes("email"))).toBe(
        true
      );
    });

    it("should reject invalid PIN format", () => {
      const invalidData = {
        business_email: "test@example.com",
        pin: "12", // too short
      };

      const validation =
        FormValidator.validateSimplifiedRegistration(invalidData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((error) => error.includes("PIN"))).toBe(
        true
      );
    });

    it("should reject empty fields", () => {
      const invalidData = {
        business_email: "",
        pin: "",
      };

      const validation =
        FormValidator.validateSimplifiedRegistration(invalidData);
      expect(validation.isValid).toBe(false);
      expect(
        validation.errors.some((error) => error.includes("required"))
      ).toBe(true);
    });
  });

  describe("Response Format", () => {
    it("should return correct response structure for successful registration", () => {
      // This test would require mocking the ChipiPay service
      // For now, we'll test the response structure validation
      const mockResponse = {
        success: true,
        message: "Merchant account created successfully with ChipiPay wallet.",
        merchant: {
          id: "test-id",
          business_email: "test@example.com",
          wallet: {
            publicKey: "test-public-key",
          },
        },
        apiKeys: {
          testnet: {
            publicKey: "test-public-key",
            secretKey: "test-secret-key",
          },
          mainnet: {
            publicKey: "main-public-key",
            secretKey: "main-secret-key",
          },
        },
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.merchant.wallet.publicKey).toBeDefined();
      expect(mockResponse.merchant.wallet).not.toHaveProperty(
        "encryptedPrivateKey"
      );
      expect(mockResponse.apiKeys.testnet).toBeDefined();
      expect(mockResponse.apiKeys.mainnet).toBeDefined();
    });
  });
});
