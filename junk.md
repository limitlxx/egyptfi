import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Copy, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Settings
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import toast from "react-hot-toast";
import { AuthManager } from "@/lib/auth-utils";

interface ApiKeyInfo {
  publicKey: string;
  environment: 'testnet' | 'mainnet';
  createdAt: string;
}

export const ApiKeysDisplay: React.FC = () => {
  const [environment, setEnvironment] = useState<'testnet' | 'mainnet'>('testnet');
  const [keys, setKeys] = useState<{
    testnet?: { publicKey: string; secretKey?: string; jwt: string };
    mainnet?: { publicKey: string; secretKey?: string; jwt: string };
  }>({});
  const [showSecretKeys, setShowSecretKeys] = useState<{
    testnet: boolean;
    mainnet: boolean;
  }>({ testnet: false, mainnet: false });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [apiKeysList, setApiKeysList] = useState<ApiKeyInfo[]>([]);

  useEffect(() => {
    loadApiKeys();
    fetchApiKeysList();
    setEnvironment(AuthManager.getCurrentEnvironment());
  }, []);

  const loadApiKeys = () => {
    const testnetKeys = AuthManager.getApiKeys('testnet');
    const mainnetKeys = AuthManager.getApiKeys('mainnet');
    
    setKeys({
      testnet: testnetKeys || undefined,
      mainnet: mainnetKeys || undefined,
    });
  };

  const fetchApiKeysList = async () => {
    try {
      const response = await AuthManager.makeAuthenticatedRequest('/api/merchants/api-keys');
      if (response.ok) {
        const data = await response.json();
        setApiKeysList(data.apiKeys);
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard`);
  };

  const toggleSecretKeyVisibility = (env: 'testnet' | 'mainnet') => {
    setShowSecretKeys(prev => ({
      ...prev,
      [env]: !prev[env]
    }));
  };

  const regenerateApiKeys = async (env: 'testnet' | 'mainnet') => {
    setIsRegenerating(true);
    try {
      const response = await AuthManager.makeAuthenticatedRequest('/api/merchants/api-keys', {
        method: 'POST',
        body: JSON.stringify({ environment: env }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update stored keys
        AuthManager.setApiKeys(env, {
          publicKey: data.apiKeys.publicKey,
          jwt: data.apiKeys.jwt,
        });

        // Update local state
        setKeys(prev => ({
          ...prev,
          [env]: {
            publicKey: data.apiKeys.publicKey,
            secretKey: data.apiKeys.secretKey,
            jwt: data.apiKeys.jwt,
          }
        }));

        toast.success(`${env} API keys regenerated successfully`);
        fetchApiKeysList();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to regenerate API keys');
      }
    } catch (error) {
      console.error('Error regenerating API keys:', error);
      toast.error('Failed to regenerate API keys');
    } finally {
      setIsRegenerating(false);
    }
  };

  const switchEnvironment = (env: 'testnet' | 'mainnet') => {
    setEnvironment(env);
    AuthManager.setCurrentEnvironment(env);
    toast.success(`Switched to ${env} environment`);
  };

  const maskSecretKey = (key: string) => {
    if (!key) return '';
    return key.substring(0, 8) + '•'.repeat(24) + key.substring(key.length - 4);
  };

  return (
    <div className="space-y-6">
      {/* Environment Switcher */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">API Keys</h2>
        <div className="flex items-center space-x-2">
          <Label htmlFor="environment">Environment:</Label>
          <div className="flex space-x-1">
            <Button
              variant={environment === 'testnet' ? 'default' : 'outline'}
              size="sm"
              onClick={() => switchEnvironment('testnet')}
            >
              Testnet
            </Button>
            <Button
              variant={environment === 'mainnet' ? 'default' : 'outline'}
              size="sm"
              onClick={() => switchEnvironment('mainnet')}
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
              <span>{environment.charAt(0).toUpperCase() + environment.slice(1)} API Keys</span>
              <Badge variant={environment === 'testnet' ? 'secondary' : 'default'}>
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
                    This will revoke your current {environment} API keys and generate new ones. 
                    Any applications using the old keys will stop working immediately.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warning:</strong> This action cannot be undone. Make sure to update 
                      all your applications with the new keys.
                    </AlertDescription>
                  </Alert>
                  <div className="flex space-x-2">
                    <Button
                      variant="destructive"
                      onClick={() => regenerateApiKeys(environment)}
                      disabled={isRegenerating}
                    >
                      {isRegenerating ? 'Regenerating...' : 'Yes, Regenerate Keys'}
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
                    value={keys[environment]?.publicKey || ''}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(keys[environment]?.publicKey || '', 'Public key')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Use this key to identify your application in API requests.
                </p>
              </div>

              {/* Secret Key */}
              {keys[environment]?.secretKey && (
                <div>
                  <Label className="flex items-center space-x-2">
                    <span>Secret Key</span>
                    <Badge variant="destructive" className="text-xs">
                      Store Securely
                    </Badge>
                  </Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      type={showSecretKeys[environment] ? 'text' : 'password'}
                      value={
                        showSecretKeys[environment] 
                          ? keys[environment]?.secretKey || ''
                          : maskSecretKey(keys[environment]?.secretKey || '')
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
                      onClick={() => copyToClipboard(keys[environment]?.secretKey || '', 'Secret key')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <Alert className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Keep your secret key secure and never share it publicly. It's used to authenticate 
                      API requests from your server.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* JWT Token */}
              <div>
                <Label>JWT Authorization Token</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    value={keys[environment]?.jwt || ''}
                    readOnly
                    className="font-mono text-sm"
                    type="password"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(keys[environment]?.jwt || '', 'JWT token')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Include this token in the Authorization header: <code>Bearer {'{'}token{'}'}</code>
                </p>
              </div>

              {/* Contract Address */}
              <div>
                <Label>EgyptFi Contract Address</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    value={
                      environment === 'testnet'
                        ? process.env.NEXT_PUBLIC_TESTNET_CONTRACT_ADDRESS || 'Not configured'
                        : process.env.NEXT_PUBLIC_MAINNET_CONTRACT_ADDRESS || 'Not configured'
                    }
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(
                      environment === 'testnet'
                        ? process.env.NEXT_PUBLIC_TESTNET_CONTRACT_ADDRESS || ''
                        : process.env.NEXT_PUBLIC_MAINNET_CONTRACT_ADDRESS || '',
                      'Contract address'
                    )}
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

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span>Integration Guide</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Authentication</h4>
            <div className="bg-muted p-3 rounded-lg font-mono text-sm">
              <div>curl -X POST https://yourapi.com/api/payments \\</div>
              <div className="ml-2">-H "Authorization: Bearer {'{'}your_jwt_token{'}'}" \\</div>
              <div className="ml-2">-H "Content-Type: application/json" \\</div>
              <div className="ml-2">-d '{"{"}...{"}"}'</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Environment URLs</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li><strong>Testnet:</strong> Use for development and testing</li>
              <li><strong>Mainnet:</strong> Use for production transactions</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Security Best Practices</h4>
            <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
              <li>Never expose secret keys or JWT tokens in client-side code</li>
              <li>Store keys securely using environment variables</li>
              <li>Regenerate keys if you suspect they've been compromised</li>
              <li>Use HTTPS for all API requests</li>
              <li>Implement proper error handling for expired tokens</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};