import { AuthManager } from "@/lib/auth-utils";

export interface Invoice {
  tokenPaid: string;
  amount: any;
  id: string;
  payment_ref: string;
  local_amount: number;
  local_currency: string;
  description: string;
  token_amount?: number;
  chain?: string;
  status: string;
  tx_hash: string;
  created_at: string;
  secondary_endpoint: string;
}

/**
 * Service class for invoice operations
 */
export class InvoiceService {
  static async getInvoices(): Promise<Invoice[]> {
    const response = await AuthManager.makeAuthenticatedRequest("/api/merchants/invoices");

    if (!response.ok) {
      throw new Error(`Failed to fetch invoices: ${response.statusText}`);
    }

    return response.json();
  }

  static async createInvoice(invoiceData: Partial<Invoice>): Promise<Invoice> {
    const response = await AuthManager.makeAuthenticatedRequest("/api/merchants/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoiceData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create invoice: ${response.statusText}`);
    }

    const { invoice } = await response.json();
    return invoice;
  }

  static async updateInvoice(invoiceId: string, updates: Partial<Invoice>): Promise<Invoice> {
    const response = await AuthManager.makeAuthenticatedRequest("/api/merchants/invoices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: invoiceId, ...updates }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update invoice: ${response.statusText}`);
    }

    const { invoice } = await response.json();
    return invoice;
  }
}
