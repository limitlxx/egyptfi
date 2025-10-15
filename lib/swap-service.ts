// lib/swap-service.ts
import {
  SwapperFactory,
  BitcoinNetwork,
  fromHumanReadableString,
} from "@atomiqlabs/sdk";
import {
  StarknetInitializer,
  StarknetInitializerType,
  StarknetSigner,
  StarknetKeypairWallet,
} from "@atomiqlabs/chain-starknet";
import {
  SqliteUnifiedStorage,
  SqliteStorageManager,
} from "@atomiqlabs/storage-sqlite";
import { AutoSwappr } from "autoswap-sdk";
import { AccountInterface, RpcProvider } from "starknet"; // For ABI if needed
import pool from "@/lib/db";

console.log("SwapService initialized");

const USDC_ADDRESS =
  process.env.USDC_CONTRACT_ADDRESS ||
  "0x053c91253bc9682c04929ca9761f693784f8f7f1f6a7e3c6a6f5c9e3c7e4a3b"; // Default USDC mainnet
const STRK_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"; // STRK mainnet
const rpcUrl =
  process.env.STARKNET_RPC_URL ||
  "https://starknet-mainnet.public.blastapi.io/rpc/v0_7";
const privateKey = process.env.WALLET_SECRET_KEY!;

console.log("RPC URL:", rpcUrl);
console.log(
  "Private key length:",
  privateKey ? privateKey.length : "undefined"
);

if (!rpcUrl) throw new Error("Missing STARKNET_RPC_URL in environment");
if (!privateKey || privateKey.length < 64)
  throw new Error(
    "Invalid WALLET_SECRET_KEY in environment (must be hex private key)"
  );

console.log(`USDC: ${USDC_ADDRESS}, STRK: ${STRK_ADDRESS}`);

export interface SwapRequest {
  tokenIn: string; // Symbol (BTC, BTCLN, STRK) or address (for StarkNet tokens)
  tokenOut: string; // Symbol or address
  amount: string; // Human-readable amount
  accountAddress: string; // User's StarkNet address (final destination)
  destAddress?: string; // Optional: BTC/BTC LN destination (address/invoice/LNURL)
}

export interface SwapResponse {
  success: boolean;
  paymentAddress?: string;
  invoice?: string;
  hyperlink?: string;
  swapId?: string;
  status?: string;
  txHash?: string;
  error?: string;
}

export class SwapService {
  public swapper: any;
  public starknetSigner: StarknetSigner;
  private backendAddress: string;

  constructor() {
    const provider = new RpcProvider({ nodeUrl: rpcUrl });
    const keypairWallet = new StarknetKeypairWallet(provider, privateKey);
    this.starknetSigner = new StarknetSigner(keypairWallet);
    this.backendAddress = this.starknetSigner.getAddress();

    console.log("Backend address:", this.backendAddress);

    const Factory = new SwapperFactory<[StarknetInitializerType]>([
      StarknetInitializer,
    ] as const);
    this.swapper = Factory.newSwapper({
      chains: { STARKNET: { rpcUrl } },
      bitcoinNetwork: BitcoinNetwork.MAINNET,
      swapStorage: (chainId: string) =>
        new SqliteUnifiedStorage(`CHAIN_${chainId}.sqlite3`),
      chainStorageCtor: (name: string) =>
        new SqliteStorageManager(`STORE_${name}.sqlite3`),
    });

    this.swapper.init().catch((err: any) => {
      console.error("Swapper init failed:", err);
    });
  }

  async executeSwap(req: SwapRequest): Promise<SwapResponse> {
    try {
      const { tokenIn, tokenOut, amount, accountAddress, destAddress } = req;
      const amountBn = fromHumanReadableString(
        amount,
        this.getTokenSymbolObj(tokenIn)
      );

      if (tokenIn === "BTC" || tokenIn === "BTCLN") {
        // BTC/BTC LN -> STRK (then to USDC or transfer STRK)
        const srcToken =
          tokenIn === "BTC"
            ? this.swapper.Tokens.BITCOIN.BTC
            : this.swapper.Tokens.BITCOIN.BTCLN;
        const swap = await this.swapper.swap(
          srcToken,
          this.swapper.Tokens.STARKNET.STRK,
          amountBn,
          true, // exactIn
          undefined,
          this.backendAddress
        );

        const swapId = swap.getId();
        const hyperlink = swap.getHyperlink();
        let paymentAddress, invoice;

        if (tokenIn === "BTC") {
          paymentAddress = swap.getAddress();
        } else {
          invoice = swap.getAddress();
        }

        // Log creation
        console.log(
          `[${new Date().toISOString()}] Swap created: ${swapId} for ${amount} ${tokenIn} to ${tokenOut} for user ${accountAddress}`
        );

        // Store association (now await the async method)
        await this.storeSwapAssociation(swapId, {
          userAddress: accountAddress,
          tokenOut,
        });

        return {
          success: true,
          paymentAddress,
          invoice,
          hyperlink,
          swapId,
          status: "waiting_payment",
        };
      } else if (
        tokenIn === STRK_ADDRESS &&
        (tokenOut === "BTC" || tokenOut === "BTCLN")
      ) {
        // STRK -> BTC/BTC LN (requires destAddress)
        if (!destAddress)
          throw new Error("destAddress required for BTC output");
        const dstToken =
          tokenOut === "BTC"
            ? this.swapper.Tokens.BITCOIN.BTC
            : this.swapper.Tokens.BITCOIN.BTCLN;
        const swap = await this.swapper
          .withChain("STARKNET")
          .withSigner(this.starknetSigner)
          .swap(
            this.swapper.Tokens.STARKNET.STRK,
            dstToken,
            amountBn,
            false, // exactOut? Adjust based on needs
            this.backendAddress,
            destAddress
          );
        await swap.commit(this.starknetSigner);
        const result = await swap.waitForPayment();
        if (!result) await swap.refund(this.starknetSigner);

        console.log(
          `[${new Date().toISOString()}] STRK to ${tokenOut} completed: ${
            swap.getBitcoinTxId() || swap.getSecret()
          }`
        );

        return {
          success: result,
          txHash: swap.getBitcoinTxId() || swap.getSecret(),
        };
      } else {
        // Assume StarkNet on-chain: STRK -> USDC via Autoswappr
        if (tokenOut !== USDC_ADDRESS)
          throw new Error("Unsupported StarkNet pair");
        const config = {
          contractAddress: process.env.AUTOSWAPPR_CONTRACT_ADDRESS!,
          rpcUrl:
            process.env.STARKNET_RPC_URL ||
            "https://starknet-mainnet.public.blastapi.io/rpc/v0_7",
          accountAddress: this.backendAddress,
          privateKey: process.env.WALLET_SECRET_KEY!,
        };
        const autoswappr = new AutoSwappr(config);
        const swapOptions = {
          amount: amountBn.toString(),
          isToken1: tokenIn > tokenOut, // Lexical sort for pair
          skipAhead: 0,
        };
        const swapResult = await autoswappr.executeSwap(
          tokenIn,
          tokenOut,
          swapOptions
        );

        // Transfer USDC to user
        await this.transferToken(
          USDC_ADDRESS,
          amountBn.toString(),
          accountAddress
        ); // Approx; use actual output in prod

        console.log(
          `[${new Date().toISOString()}] STRK to USDC completed: ${
            swapResult.result.transaction_hash || "unknown"
          }`
        );

        return {
          success: true,
          txHash: swapResult.result.transaction_hash || "unknown",
        };
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Swap error:`, error);
      return { success: false, error: error.message };
    }
  }

  async processPendingSwaps() {
    try {
      const claimableSwaps = await this.swapper.getClaimableSwaps(
        "STARKNET",
        this.backendAddress
      );
      for (const swap of claimableSwaps) {
        const swapId = swap.getId();
        const association = await this.getSwapAssociation(swapId); // Await the async method
        if (!association) continue;

        let retries = 0;
        const maxRetries = 3;
        let success = false;

        while (retries < maxRetries && !success) {
          try {
            if (swap.canCommit()) await swap.commit(this.starknetSigner);
            await swap.claim(this.starknetSigner);
            await swap.waitTillClaimedOrFronted(); // 30s timeout default
            success = true;

            console.log(
              `[${new Date().toISOString()}] Claimed swap ${swapId} for user ${
                association.user_address
              }`
            );

            // Get received STRK
            const strkBalance = await this.swapper.Utils.getSpendableBalance(
              this.starknetSigner,
              this.swapper.Tokens.STARKNET.STRK
            );
            if (strkBalance <= BigInt(0)) throw new Error("No STRK received");

            const { token_out } = association;
            if (token_out === USDC_ADDRESS) {
              // Swap STRK to USDC
              const config = {
                contractAddress: process.env.AUTOSWAPPR_CONTRACT_ADDRES!,
                rpcUrl:
                  process.env.STARKNET_RPC_URL ||
                  "https://starknet-mainnet.public.blastapi.io/rpc/v0_7",
                accountAddress: this.backendAddress,
                privateKey: process.env.WALLET_SECRET_KEY!,
              };
              const autoswappr = new AutoSwappr(config);
              const swapOptions = {
                amount: strkBalance.toString(),
                isToken1: false,
                skipAhead: 0,
              };
              const swapResult = await autoswappr.executeSwap(
                STRK_ADDRESS,
                USDC_ADDRESS,
                swapOptions
              );
              await this.transferToken(
                USDC_ADDRESS,
                strkBalance.toString(),
                association.user_address
              ); // Approx
              console.log(
                `[${new Date().toISOString()}] STRK->USDC & transfer completed for ${swapId}`
              );
            } else if (token_out === "STRK") {
              // Transfer STRK
              await this.transferToken(
                STRK_ADDRESS,
                strkBalance.toString(),
                association.user_address
              );
              console.log(
                `[${new Date().toISOString()}] STRK transfer completed for ${swapId}`
              );
            }

            // Call backend to trigger process_payment (uncomment if webhook route is ready)
            /*
            try {
              const webhookRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/payments/swap-webhook`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  swap_id: swapId,
                  status: "completed",
                  user_address: association.user_address,
                  usdc_amount: strkBalance.toString(),
                }),
              });
              if (!webhookRes.ok) throw new Error("Webhook failed");
              console.log(`Webhook sent for ${swapId}`);
            } catch (err) {
              console.error(`Webhook error for ${swapId}:`, err);
            }
            */

            // Clean up association
            await this.removeSwapAssociation(swapId);
          } catch (e: any) {
            retries++;
            console.error(
              `[${new Date().toISOString()}] Claim retry ${retries}/${maxRetries} for ${swapId}: ${
                e.message
              }`
            );
            if (retries < maxRetries) {
              await new Promise((resolve) =>
                setTimeout(resolve, 2 ** retries * 1000)
              ); // Expo backoff
            } else {
              console.error(
                `[${new Date().toISOString()}] Max retries exceeded for ${swapId}; consider refund`
              );
              await swap.refund(this.starknetSigner);
            }
          }
        }
      }
    } catch (error: any) {
      console.error(
        `[${new Date().toISOString()}] Process pending error:`,
        error
      );
    }
  }

  private async transferToken(
    tokenAddress: string,
    amountStr: string,
    toAddress: string
  ) {
    const amountBn = BigInt(amountStr);
    const lowMask = BigInt("0xffffffffffffffffffffffffffffffff");
    const shift = BigInt(128);

    const low = (amountBn & lowMask).toString();
    const high = (amountBn >> shift).toString();

    const { transaction_hash } = await this.starknetSigner.account.execute({
      contractAddress: tokenAddress,
      entrypoint: "transfer",
      calldata: [toAddress, low, high],
    });

    console.log(
      `[${new Date().toISOString()}] Transfer tx: ${transaction_hash} to ${toAddress}`
    );
    // Wait for confirmation in prod
  }

  private getTokenSymbolObj(symbol: string): any {
    // Map to Atomiq token obj for fromHumanReadableString
    switch (symbol) {
      case "BTC":
        return this.swapper.Tokens.BITCOIN.BTC;
      case "BTCLN":
        return this.swapper.Tokens.BITCOIN.BTCLN;
      case "STRK":
        return this.swapper.Tokens.STARKNET.STRK;
      default:
        throw new Error("Unsupported token");
    }
  }

  // DB methods (unchanged)
  async storeSwapAssociation(swapId: string, data: any) {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO swap_associations (swap_id, user_address, token_out, created_at) 
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (swap_id) DO UPDATE SET 
           user_address = EXCLUDED.user_address, 
           token_out = EXCLUDED.token_out, 
           updated_at = NOW()`,
        [swapId, data.userAddress, data.tokenOut]
      );
      console.log(`Stored association for ${swapId}:`, data);
    } catch (err: any) {
      console.error(`Failed to store association for ${swapId}:`, err);
    } finally {
      client.release();
    }
  }

  async getSwapAssociation(swapId: string): Promise<any> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT user_address, token_out FROM swap_associations WHERE swap_id = $1",
        [swapId]
      );
      if (result.rows.length > 0) {
        console.log(`Retrieved association for ${swapId}:`, result.rows[0]);
        return result.rows[0];
      }
      return null;
    } catch (err: any) {
      console.error(`Failed to retrieve association for ${swapId}:`, err);
      return null;
    } finally {
      client.release();
    }
  }

  async removeSwapAssociation(swapId: string) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "DELETE FROM swap_associations WHERE swap_id = $1 RETURNING *",
        [swapId]
      );
      if (result.rows.length > 0) {
        console.log(`Removed association for ${swapId}`);
      }
    } catch (err: any) {
      console.error(`Failed to remove association for ${swapId}:`, err);
    } finally {
      client.release();
    }
  }
}
