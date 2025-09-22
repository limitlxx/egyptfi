// Debug script to test ChipiPay token validation
const jwt = require('jsonwebtoken');

// Your Clerk token from the logs
const clerkToken = "eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18zMnh6T3UwUzNZckU3djc0cDNYQmxuYlFUb0oiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NTg1MzkyMTMsImZ2YSI6WzAsLTFdLCJpYXQiOjE3NTg1MzkxNTMsImlzcyI6Imh0dHBzOi8vdmFsdWVkLXBvbnktNDkuY2xlcmsuYWNjb3VudHMuZGV2IiwibmJmIjoxNzU4NTM5MTQzLCJzaWQiOiJzZXNzXzMzM0k2Q2dwaVpZTXN0eDB3RWdWUDBCRzUyRiIsInN0cyI6ImFjdGl2ZSIsInN1YiI6InVzZXJfMzMzSTZIb1Rud2FrZW5lU2Vpa2RQbWxyc3RTIiwidiI6Mn0.tnbC_aV1dX6GsjJX4ZsdecOP34SHQ7zdjWcpEIwUDXHbn9aBtZuscMzK5YgaYefM5hA1PMIG6EDtYmnjWsQQcoFGnQyybH-EyXNRZR0i8in83b_ADCyuIWaD1Jt1_dlOG0dCWJFp0qggzT46gl-IGSdXqxCwa4BI2rgw2dAKfboYJtl_jDXs--vqlsn_cWId88yAI7FmkA6cQriqTjABo_9vLhNwUzL77H35MATrzji9nzYpUhhFxhtR8yiqkXDlmEUMbaP_HowLMflkRPcCjWyT9POzpZk1-mCBHyBorf0JBCLVESBD6UE3NKbIOL4TGr8yvyxjEJuEG-agq4mlvQ";

console.log("=== Clerk Token Analysis ===");

// Decode without verification to see the payload
const decoded = jwt.decode(clerkToken, { complete: true });
console.log("Header:", JSON.stringify(decoded.header, null, 2));
console.log("Payload:", JSON.stringify(decoded.payload, null, 2));

console.log("\n=== Key Information ===");
console.log("Issuer:", decoded.payload.iss);
console.log("Subject (User ID):", decoded.payload.sub);
console.log("Audience:", decoded.payload.azp);
console.log("Key ID:", decoded.header.kid);

console.log("\n=== JWKS Endpoint ===");
console.log("Expected JWKS URL:", decoded.payload.iss + "/.well-known/jwks.json");

console.log("\n=== ChipiPay Configuration Needed ===");
console.log("ChipiPay should be configured to:");
console.log("1. Accept JWT tokens from issuer:", decoded.payload.iss);
console.log("2. Fetch public keys from:", decoded.payload.iss + "/.well-known/jwks.json");
console.log("3. Validate tokens with key ID:", decoded.header.kid);