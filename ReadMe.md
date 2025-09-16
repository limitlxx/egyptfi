# **EgyptFi – Crypto Payment Gateway on Starknet**

**EgyptFi** is a Starknet-based multi-chain payment gateway that enables businesses to accept crypto payments and receive settlements in stablecoins like **USDC**.
With support for **no-code** and **low-code tools**, **developer-friendly APIs**, **gasless transactions**, and **refund support**, Egyptfi makes crypto payments simple, scalable, and secure.

> Demo [Website](https://egyptfi.online)

> Foolow us [@egyptfi_](https://x.com/egyptfi_)
---

### Contract Address
#### MAINNET
> 0x04bb1a742ac72a9a72beebe1f608c508fce6dfa9250b869018b6e157dccb46e8

#### SEPOLIA
> 0x0654d1ab73d517086e44028ba82647e46157657f4c77616ffd3c6cba589240a2

## ⚙️ Technologies Used

> A quick overview of the key technologies powering Egyptfi:

* **CoinMarketCap** – Real-time fiat pricing
* **Chainlink Oracles** – Secure, on-chain token price feeds
* **Paymaster** – Enables gasless and gas-sponsored transactions
* **AutoSwapper SDK** – Converts tokens to stablecoins
* **PostgreSQL** – Relational database
* **Starknet Cairo** – Smart contracts on Starknet
* **Starknet Kit** – Wallet integration
* **Next.js (TypeScript)** – Frontend and backend framework

---

## 🚀 Features

* Wallet-based onboarding: Connect and create your account using Starknet wallets like Argent or Braavos

* Blockchain transparency: Verifiable, secure on-chain payments
* Payment link generation: Create and manage invoices easily
* Real-time conversion with settlement in stablecoins: We convert crypto payments into stablecoins instantly — matched precisely to your fiat price at the time of checkout.
* Gasless transactions: No gas fees for end users — covered via Egyptfi's Paymaster

* Refund support: Secure, trackable refunds for customer protection
* Developer APIs & SDKs: Build custom integrations or plug crypto payments into Web2 platforms
* On-chain yield: Earn passive yield by allocating unused balances to on-chain strategies which include flexible access to funds, clear on-chain visibility and withdrawal at any time
* Multi-chain support: Accept payments across multiple blockchain networks

---

## 📦 Installation & Setup

> Step-by-step instructions to run the project locally:

```bash
git clone https://github.com/limitlxx/egyptfi.git
cd egyptfi
setup .env file
npm install
npm run dev
```

> Make sure you have **Node.js**, **npm**, and a Starknet wallet ready.

---

## 🧠 Usage Instructions

### ▶️ **Create an Account**

1. Click **“Get Started”**
2. Connect your Starknet wallet
3. Fill out the onboarding form (business name, email, type, expected volume)
4. You’ll be redirected to your dashboard to customize your brand and manage payments

### 💳 **Create a Payment Link**

1. In your dashboard, go to the **Payments** tab
2. Click **“Create Payment Link”**
3. Enter the **amount**, **currency**, and **description**
4. Share the generated link with your customer

### ✅ **Make a Payment**

1. Choose your preferred blockchain network
2. Pay using QR code, wallet integration, or direct transfer
3. Click **“I have paid”**
4. Get an auto-generated receipt with all transaction details

---

## 🔌 Integration (No-code & API)

### ➕ Create Invoice (POST request)

```js
const response = await fetch('https://egyptfi.online/api/payment/initiate', {
  method: 'POST',
  headers: { 
    'X-API-Key': 'pk_test_key', 
    'X-Wallet-Address': '0x065982b15Bc87AbdAa2DA7DB5F2164792b6c2e497bd80f4b7ace9E799Be4Beb0', 
    'X-Environment': 'testnet', 
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ 
    payment_ref: `order-${Date.now()}`,
    local_amount: 11000,
    local_currency: "NGN",
    description: "TheBuidl Kitchen, Kaduna",
    chain: "starknet",
    secondary_endpoint: "http://localhost:3000/confirm",
    email: "name@xyz.com",
  })
});

const payment = await response.json();
console.log(payment.hosted_url);
```

#### Sample Response:

```json
{
  "reference": "pay_abc123",
  "authorised_url": "https://egyptfi.online/invoice/payment_ref",
  "qr_code": "data:image/png;base64,...",
  "expires_at": "2024-01-15T10:30:00Z"
}
```

---

### 🔍 Fetch Invoice Metadata (GET request)

```js
const response = await fetch('https://egyptfi.online/api/payment/pay_abc123', {
  headers: { 
    'X-API-Key': 'pk_test_key', 
    'X-Wallet-Address': '0x065982b15Bc87AbdAa2DA7DB5F2164792b6c2e497bd80f4b7ace9E799Be4Beb0', 
    'X-Environment': 'testnet', 
    'Content-Type': 'application/json',
  },
});

const invoice = await response.json();
console.log(invoice.crypto_amounts);
```

#### Sample Response:

```json
{
  "payment_ref": "pay_abc123",
  "amount": 5000,
  "currency": "NGN",
  "description": "Premium Coffee Blend x2",
  "status": "pending",
  "crypto_amounts": {
    "ethereum": { "usdc": "3.2", "eth": "0.0013", "dai": "3.18" },
    "starknet": { "usdc": "3.2", "eth": "0.0013" },
    "polygon": { "usdc": "3.2", "matic": "4.1", "dai": "3.18" }
  },
  "created_at": "2024-01-15T09:30:00Z",
  "expires_at": "2024-01-15T10:30:00Z"
}
```

---

## 📸 Screenshots / Demo

Include relevant screenshots or a link to a short demo video here. This helps users visualize the flow.

---

## 🧠 Challenges & Learnings

1. **AutoSwapper SDK Limitation**

   * Tokens were initially swapped in the sender’s wallet instead of the receiver’s
   * Solved by swapping first, then approving the amount to the contract

2. **Pricing Complexity**

   * No single pricing API worketo enable live conversions
   * Combined **CoinMarketCap** for fiat and **Chainlink** for token price feeds

3. **Paymaster Quota Exhaustion**

   * Gasless transactions failed once credit ran out
   * Implemented fallback to **gas-sponsored a** model

---

## 🔮 Future Enhancements

* AI-powered yield farming
* Cross-chain interoperability
* On-chain anti-fraud detection

---

## 👥 Team Members

* **Ojo Emmanuel Oluwafemi (Limitlxx)** – Team Lead
* **Daniel Gwaza Patrick (Gz)** – Developer
* **Abanonu Kosisochukwu Debora** – Developer

---