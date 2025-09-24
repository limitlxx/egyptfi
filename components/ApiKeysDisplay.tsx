import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Settings,
  Code,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import toast from "react-hot-toast";
import { AuthManager } from "@/lib/auth-utils";
// import { useToast } from '@/hooks/use-toast';
import { useRouter } from "next/navigation";

interface ApiKeyInfo {
  publicKey: string;
  secretKey: string;
  environment: "testnet" | "mainnet";
  createdAt: string;
}

export const ApiKeysDisplay: React.FC = () => {
  const [environment, setEnvironment] = useState<"testnet" | "mainnet">(
    "testnet"
  );
  const [keys, setKeys] = useState<{
    testnet?: { publicKey: string; secretKey?: string };
    mainnet?: { publicKey: string; secretKey?: string };
  }>({});
  const [showSecretKeys, setShowSecretKeys] = useState<{
    testnet: boolean;
    mainnet: boolean;
  }>({ testnet: false, mainnet: false });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [apiKeysList, setApiKeysList] = useState<ApiKeyInfo[]>([]);
  const router = useRouter();
  // const { toast } = useToast();

  const activeKeys = apiKeysList.find((k) => k.environment === environment);

  useEffect(() => {
    loadApiKeys();
    fetchApiKeysList();
    setEnvironment(AuthManager.getCurrentEnvironment());
  }, []);

  const loadApiKeys = () => {
    const testnetKeys = AuthManager.getApiKeys("testnet");
    const mainnetKeys = AuthManager.getApiKeys("mainnet");

    setKeys({
      testnet: testnetKeys || undefined,
      mainnet: mainnetKeys || undefined,
    });
  };

  const fetchApiKeysList = async () => {
    try {
      const response = await AuthManager.makeAuthenticatedRequest(
        "/api/merchants/api-keys"
      );
      if (response.status === 401) {
        console.warn("API Keys request returned 401 - JWT may be expired");
        toast.error("Session expired. Please log in again to continue.");
        // Don't immediately clear auth - let the user decide
        // AuthManager.clearAuth();
        // router.push('/login');
        return;
      }
      if (response.ok) {
        const data = await response.json();
        console.log("Keys", data);

        setApiKeysList(data.apiKeys);
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to fetch API keys" }));
        throw new Error(errorData.error || "Failed to fetch API keys");
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch API keys"
      );
    }
  };

  useEffect(() => {
    fetchApiKeysList();
  }, []);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    // You can implement toast notifications here
    console.log(`${type} copied to clipboard`);
  };

  const toggleSecretKeyVisibility = (env: "testnet" | "mainnet") => {
    setShowSecretKeys((prev) => ({
      ...prev,
      [env]: !prev[env],
    }));
  };

  const regenerateApiKeys = async (env: "testnet" | "mainnet") => {
    setIsRegenerating(true);
    try {
      if (typeof AuthManager !== "undefined") {
        const response = await AuthManager.makeAuthenticatedRequest(
          "/api/merchants/api-keys",
          {
            method: "POST",
            body: JSON.stringify({ environment: env }),
          }
        );

        if (response.ok) {
          const data = await response.json();

          AuthManager.setApiKeys(env, {
            publicKey: data.apiKeys.publicKey,
            secretKey: data.apiKeys.secretKey,
          });

          setKeys((prev) => ({
            ...prev,
            [env]: {
              publicKey: data.apiKeys.publicKey,
              secretKey: data.apiKeys.secretKey,
            },
          }));

          toast.success(`${env} API keys regenerated successfully`);
          fetchApiKeysList();
        } else {
          const error = await response.json();
          toast.error(error.error || "Failed to regenerate API keys");
        }
      }
    } catch (error) {
      console.error("Error regenerating API keys:", error);
      toast.error("Failed to regenerate API keys");
    } finally {
      setIsRegenerating(false);
    }
  };

  const switchEnvironment = (env: "testnet" | "mainnet") => {
    setEnvironment(env);
    if (typeof AuthManager !== "undefined") {
      AuthManager.setCurrentEnvironment(env);
    }
    toast.success(`Switched to ${env} environment`);
  };

  const maskSecretKey = (key: string) => {
    if (!key) return "";
    return key.substring(0, 8) + "•".repeat(24) + key.substring(key.length - 4);
  };

  return (
    <div className="space-y-6">
      {/* Environment Switcher */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">API Keys Management</h3>
        <div className="flex items-center space-x-2">
          <Label htmlFor="environment">Environment:</Label>
          <div className="flex space-x-1">
            <Button
              variant={environment === "testnet" ? "default" : "outline"}
              size="sm"
              onClick={() => switchEnvironment("testnet")}
            >
              Testnet
            </Button>
            <Button
              variant={environment === "mainnet" ? "default" : "outline"}
              size="sm"
              onClick={() => switchEnvironment("mainnet")}
            >
              Mainnet
            </Button>
          </div>
        </div>
      </div>

      {/* Current Environment Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <span>
                {environment.charAt(0).toUpperCase() + environment.slice(1)} API
                Keys
              </span>
              <Badge
                variant={environment === "testnet" ? "secondary" : "default"}
              >
                {environment}
              </Badge>
            </CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isRegenerating}>
                  {isRegenerating ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Regenerate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Regenerate API Keys</DialogTitle>
                  <DialogDescription>
                    This will revoke your current {environment} API keys and
                    generate new ones. Any applications using the old keys will
                    stop working immediately.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warning:</strong> This action cannot be undone.
                      Make sure to update all your applications with the new
                      keys.
                    </AlertDescription>
                  </Alert>
                  <div className="flex space-x-2">
                    <Button
                      variant="destructive"
                      onClick={() => regenerateApiKeys(environment)}
                      disabled={isRegenerating}
                    >
                      {isRegenerating
                        ? "Regenerating..."
                        : "Yes, Regenerate Keys"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {keys[environment] ? (
            <>
              {/* Public Key */}
              <div>
                <Label>Public Key</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    value={activeKeys?.publicKey || ""}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(activeKeys?.publicKey || "", "Public key")
                    }
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Use this key to identify your application in API requests.
                </p>
              </div>

              {/* Secret Key */}
              {activeKeys?.secretKey && (
                <div>
                  <Label className="flex items-center space-x-2">
                    <span>Secret Key</span>
                    <Badge variant="destructive" className="text-xs">
                      Store Securely
                    </Badge>
                  </Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      type={showSecretKeys[environment] ? "text" : "password"}
                      value={
                        showSecretKeys[environment]
                          ? activeKeys?.secretKey || ""
                          : maskSecretKey(activeKeys?.secretKey || "")
                      }
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleSecretKeyVisibility(environment)}
                    >
                      {showSecretKeys[environment] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          activeKeys?.secretKey || "",
                          "Secret key"
                        )
                      }
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <Alert className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Keep your secret key secure and never share it publicly.
                      It's used to authenticate API requests from your server.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* JWT Token */}
              {/* <div>
                <Label className='mb-2'>JWT Authorization Token</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    value={activeKeys?.jwt || ''}
                    readOnly
                    className="font-mono text-sm"
                    type="password"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(activeKeys?.jwt || '', 'JWT token')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Include this token in the Authorization header: <code>Bearer {'{'}token{'}'}</code>
                </p>
              </div> */}

              {/* Contract Address */}
              <div>
                <Label className="mb-2">EgyptFi Contract Address</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    value={
                      environment === "testnet"
                        ? process.env
                            .NEXT_PUBLIC_EGYPT_SEPOLIA_CONTRACT_ADDRESS ||
                          "Not configured"
                        : process.env
                            .NEXT_PUBLIC_EGYPT_MAINNET_CONTRACT_ADDRESS ||
                          "Not configured"
                    }
                    disabled
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        environment === "testnet"
                          ? process.env
                              .NEXT_PUBLIC_EGYPT_SEPOLIA_CONTRACT_ADDRESS || ""
                          : process.env
                              .NEXT_PUBLIC_EGYPT_MAINNET_CONTRACT_ADDRESS || "",
                        "Contract address"
                      )
                    }
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No API keys found for {environment} environment</p>
              <Button
                className="mt-4"
                onClick={() => regenerateApiKeys(environment)}
                disabled={isRegenerating}
              >
                Generate API Keys
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

type DeveloperTabProps = {
  webhook: string;
};

// Main Developer Tab Component
export default function DeveloperTab({ webhook }: DeveloperTabProps) {
  const [webhookUrl, setWebhookUrl] = useState(webhook);
  const [copiedItem, setCopiedItem] = useState(null);

  const copyToClipboard = (text: string, type: any) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(type);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const updateWebhookUrl = async () => {
    try {
      const response = await AuthManager.makeAuthenticatedRequest(
        "/api/merchants/webhook",
        {
          method: "POST",
          body: JSON.stringify({ webhookUrl }),
        }
      );

      if (response.ok) {
        toast.success("Webhook URL updated successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update webhook URL");
      }
    } catch (error) {
      console.error("Error updating webhook URL:", error);
      toast.error("Failed to update webhook URL");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {/* API Keys Management - Full Width */}
        <div className="lg:col-span-2">
          <ApiKeysDisplay />
        </div>

        {/* Webhook Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 ">
            <div>
              <Label className="mb-2" htmlFor="webhook-url">
                Webhook URL
              </Label>
              <Input
                id="webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://yoursite.com/webhook"
              />
            </div>
            <div
              className="bg-background text-foreground border-2 rounded-lg p-4"
              style={{ borderColor: "#d4af37" }}
            >
              <h4 className="font-semibold mb-2">Webhook Events</h4>
              <ul className="text-sm space-y-1">
                <li>• payment.confirmed - Payment verified on blockchain</li>
                <li>• payment.settled - USDC settled to your wallet</li>
                <li>• payment.failed - Payment failed or expired</li>
              </ul>
            </div>
            <Button
              className="w-full bg-background text-foreground border-2"
              style={{ borderColor: '#d4af37' }}
              onClick={updateWebhookUrl}
              disabled={!webhookUrl}
            >
              Update Webhook URL
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Code className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              API Documentation
            </h3>
            <p className="text-sm text-gray-600">
              Complete API reference with examples
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">API Playground</h3>
            <p className="text-sm text-gray-600">
              Test API endpoints interactively
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Sandbox Environment
            </h3>
            <p className="text-sm text-gray-600">Test with fake transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Code Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span>Integration Guide</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl" className="w-full">
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl" className="mt-4">
              <div className="bg-gray-900 rounded-lg p-4 relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  onClick={() =>
                    copyToClipboard(
                      `curl -X POST https://api.yourservice.com/api/payment/initiate \\
-H "Authorization: Bearer YOUR_JWT_TOKEN" \\
-H "Content-Type: application/json" \\
-d '{
  "amount": 5000,
  "currency": "NGN",
  "description": "Premium Coffee Blend x2"
}'`,
                      "curl-example"
                    )
                  }
                >
                  {copiedItem === "curl-example" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <pre className="text-green-400 text-sm overflow-x-auto">
                  {`curl -X POST https://api.yourservice.com/api/payment/initiate \\
-H "Authorization: Bearer YOUR_JWT_TOKEN" \\
-H "Content-Type: application/json" \\
-d '{
  "amount": 5000,
  "currency": "NGN",
  "description": "Premium Coffee Blend x2"
}'`}
                </pre>
              </div>
            </TabsContent>
            <TabsContent value="javascript" className="mt-4">
              <div className="bg-gray-900 rounded-lg p-4 relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  onClick={() =>
                    copyToClipboard(
                      `const response = await fetch('https://api.yourservice.com/api/payment/initiate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 5000,
    currency: 'NGN',
    description: 'Premium Coffee Blend x2'
  })
});

const payment = await response.json();
console.log(payment.hosted_url);`,
                      "js-example"
                    )
                  }
                >
                  {copiedItem === "js-example" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <pre className="text-green-400 text-sm overflow-x-auto">
                  {`const response = await fetch('https://api.yourservice.com/api/payment/initiate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 5000,
    currency: 'NGN',
    description: 'Premium Coffee Blend x2'
  })
});

const payment = await response.json();
console.log(payment.hosted_url);`}
                </pre>
              </div>
            </TabsContent>
            <TabsContent value="python" className="mt-4">
              <div className="bg-gray-900 rounded-lg p-4 relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  onClick={() =>
                    copyToClipboard(
                      `import requests

response = requests.post(
    'https://api.yourservice.com/api/payment/initiate',
    headers={
        'Authorization': 'Bearer YOUR_JWT_TOKEN',
        'Content-Type': 'application/json',
    },
    json={
        'amount': 5000,
        'currency': 'NGN',
        'description': 'Premium Coffee Blend x2'
    }
)

payment = response.json()
print(payment['hosted_url'])`,
                      "python-example"
                    )
                  }
                >
                  {copiedItem === "python-example" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <pre className="text-green-400 text-sm overflow-x-auto">
                  {`import requests

response = requests.post(
    'https://api.yourservice.com/api/payment/initiate',
    headers={
        'Authorization': 'Bearer YOUR_JWT_TOKEN',
        'Content-Type': 'application/json',
    },
    json={
        'amount': 5000,
        'currency': 'NGN',
        'description': 'Premium Coffee Blend x2'
    }
)

payment = response.json()
print(payment['hosted_url'])`}
                </pre>
              </div>
            </TabsContent>
          </Tabs>

          {/* Security Best Practices */}
          <div className="mt-6 space-y-4">
            <h4 className="font-semibold mb-2">Authentication</h4>
            <div className="bg-muted p-3 rounded-lg font-mono text-sm">
              <div>curl -X POST https://yourapi.com/api/payments \\</div>
              <div className="ml-2">
                -H "Authorization: Bearer {"{"}your_jwt_token{"}"}" \\
              </div>
              <div className="ml-2">-H "Content-Type: application/json" \\</div>
              <div className="ml-2">
                -d '{"{"}...{"}"}'
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Environment URLs</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>
                  <strong>Testnet:</strong> Use for development and testing
                </li>
                <li>
                  <strong>Mainnet:</strong> Use for production transactions
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Security Best Practices</h4>
              <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                <li>
                  Never expose secret keys or JWT tokens in client-side code
                </li>
                <li>Store keys securely using environment variables</li>
                <li>Regenerate keys if you suspect they've been compromised</li>
                <li>Use HTTPS for all API requests</li>
                <li>Implement proper error handling for expired tokens</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
