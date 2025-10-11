
### 🧠 Prompt: *The Buidl Community Membership Page (with EgyptFi Payment Integration)*

> **Instruction:**
> Create a modern, minimal **Membership Registration Page** for **The Buidl Community** that allows users to register as either:
>
> * **Internship Member** (₦15,000 — requires payment)
> * **Developer Member** (Free)
> * **Working Space Member** (Free)

Integrate **EgyptFi** as the payment processor using the provided payment initiation function and endpoint.

---

### 🧩 Functional Requirements

* **Form Fields:**

  * Full name
  * Email address
  * Membership type (Dropdown: Internship / Developer / Working Space)
  * Wallet address
  * Optional: Short description (e.g., “Why you want to join The Buidl Community”)

* **Logic:**

  * When the user selects **Internship**, display:
    “Internship membership costs ₦15,000. You’ll be redirected to complete your payment via EgyptFi.”
  * On form submission:

    * If membership = *Internship* → call the `initiate_payment()` function (below).
    * If membership = *Developer* or *Working Space* → store the form details (console.log or mock submission) and show a success message.
  * Redirect users to `authorization_url` returned from EgyptFi if payment is required.

---

### ⚙️ Payment Integration

Include this **EgyptFi payment initiation function** in the code:

```ts
export async function initiate_payment({
  payment_ref,
  local_amount,
  local_currency,
  description,
  chain = "starknet",
  secondary_endpoint,
  email,
  api_key,
  wallet_address,
  environment = "testnet",
}: {
  payment_ref: string;
  local_amount: number;
  local_currency: string;
  description?: string;
  chain?: string;
  secondary_endpoint?: string;
  email: string;
  api_key: string;
  wallet_address: string;
  environment?: string;
}): Promise<{
  reference: string;
  authorization_url: string;
  qr_code: string;
  expires_at: string;
}> {
  const response = await fetch("/api/payments/initiate", {
    method: "POST",
    headers: {
      "x-api-key": api_key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payment_ref,
      local_amount,
      local_currency,
      description,
      chain,
      secondary_endpoint,
      email,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to initiate payment");
  }

  return await response.json();
}
```

Then, in your form submission handler, trigger it like this:

```ts
const result = await initiate_payment({
  payment_ref: `BUIDL-${Date.now()}`,
  local_amount: 15000,
  local_currency: "NGN",
  description: "The Buidl Community Internship Membership",
  chain: "starknet",
  secondary_endpoint: "https://egyptfi.online/confirm",
  email,
  api_key: keys.publicKey,
  wallet_address,
});
window.location.href = result.authorization_url;
```

---

### 🖼️ Design Requirements

* **Minimal, clean UI** using **TailwindCSS**
* **The Buidl Community** logo centered at the top
* Section title: “Join The Buidl Community”
* Short tagline: “Choose your membership and become part of Africa’s growing builder ecosystem.”
* **Form card** with shadow and rounded edges
* **EgyptFi-branded payment note** for Internship selection
* Responsive for mobile and desktop
* Success/error feedback with toasts or alert boxes

---

### 🎨 Theme

* **Colors:**dark
* **Typography:** Sans-serif, bold headings
* **Buttons:** Rounded, animated hover effects
 