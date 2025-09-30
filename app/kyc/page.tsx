"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Check, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { AuthManager } from "@/lib/auth-utils";
import { useAccount } from "@starknet-react/core";
import { useSearchParams } from "next/navigation";

export default function KycPage() {
  const { address, isConnected } = useAccount();
  const searchParams = useSearchParams();
  const kycType = searchParams.get("type") || "individual"; // default to individual

  const [uploadedFiles, setUploadedFiles] = useState<{
    governmentId: File | null;
    businessLicense: File | null;
    proofOfAddress: File | null;
  }>({
    governmentId: null,
    businessLicense: null,
    proofOfAddress: null,
  });

  const [dragStates, setDragStates] = useState<{
    governmentId: boolean;
    businessLicense: boolean;
    proofOfAddress: boolean;
  }>({
    governmentId: false,
    businessLicense: false,
    proofOfAddress: false,
  });

  const fileInputs = {
    governmentId: useRef<HTMLInputElement>(null),
    businessLicense: useRef<HTMLInputElement>(null),
    proofOfAddress: useRef<HTMLInputElement>(null),
  };

  const businessName =
    AuthManager.getMerchantInfo()?.businessName || "Business";
  const businessLogo = AuthManager.getMerchantInfo()?.businessLogo || "☕";

  const handleFileSelect = (
    type: keyof typeof uploadedFiles,
    files: FileList | null
  ) => {
    if (files && files[0]) {
      const file = files[0];
      // Basic validation
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }
      if (!file.type.startsWith("image/") && !file.type.includes("pdf")) {
        alert("Please upload an image or PDF file");
        return;
      }
      setUploadedFiles((prev) => ({ ...prev, [type]: file }));
    }
  };

  const handleDragOver = (
    e: React.DragEvent,
    type: keyof typeof dragStates
  ) => {
    e.preventDefault();
    setDragStates((prev) => ({ ...prev, [type]: true }));
  };

  const handleDragLeave = (type: keyof typeof dragStates) => {
    setDragStates((prev) => ({ ...prev, [type]: false }));
  };

  const handleDrop = (e: React.DragEvent, type: keyof typeof uploadedFiles) => {
    e.preventDefault();
    setDragStates((prev) => ({ ...prev, [type]: false }));
    handleFileSelect(type, e.dataTransfer.files);
  };

  const removeFile = (type: keyof typeof uploadedFiles) => {
    setUploadedFiles((prev) => ({ ...prev, [type]: null }));
    if (fileInputs[type].current) {
      fileInputs[type].current.value = "";
    }
  };

  const allFilesUploaded =
    kycType === "individual"
      ? uploadedFiles.governmentId && uploadedFiles.proofOfAddress
      : uploadedFiles.businessLicense && uploadedFiles.proofOfAddress;

  const handleGenerateProofs = async () => {
    try {
      const filesToSubmit =
        kycType === "individual"
          ? [uploadedFiles.governmentId, uploadedFiles.proofOfAddress]
          : [uploadedFiles.businessLicense, uploadedFiles.proofOfAddress];

      const documentTypes =
        kycType === "individual"
          ? ["id_card", "utility_bill"]
          : ["drivers_license", "utility_bill"];

      for (let i = 0; i < filesToSubmit.length; i++) {
        const file = filesToSubmit[i];
        if (!file) continue;

        // Convert file to base64 (simulating encryption)
        const base64Data = await fileToBase64(file);

        // Create a simple hash (in production, use proper cryptographic hash)
        const hash = await createFileHash(file);

        // Submit to API
        const response = await fetch("/api/merchants/kyc/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentType: documentTypes[i],
            encryptedDocument: base64Data,
            documentHash: hash,
          }),
        });

        console.log(response);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to submit document");
        }

        const result = await response.json();
        console.log("Document submitted:", result);

        // Verify the document
        const verifyResponse = await fetch("/api/merchants/kyc/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kycId: result.kycId,
          }),
        });

        if (!verifyResponse.ok) {
          const error = await verifyResponse.json();
          throw new Error(error.error || "Failed to verify document");
        }

        const verifyResult = await verifyResponse.json();
        console.log("Document verified:", verifyResult);
      }

      alert("KYC verification completed successfully!");
      // Redirect to dashboard or show success message
      window.location.href = "/dashboard";
    } catch (error) {
      console.error("KYC submission failed:", error);
      alert(
        `KYC submission failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Helper function to create file hash
  const createFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Same as Dashboard */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center">
              <Image
                src="/egyptfi_logo-03.png"
                alt="EGYPTFI"
                width={840}
                height={280}
                className="h-56 w-auto dark:hidden"
              />
              <Image
                src="/egyptfi_white-03.png"
                alt="EGYPTFI"
                width={840}
                height={280}
                className="h-56 w-auto hidden dark:block"
              />
            </Link>
            <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
              <span>/</span>
              <span>KYC Verification</span>
            </div>
          </div>
          {/* LOGO */}
          {/* <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-sm">
              {typeof businessLogo === "string" &&
              businessLogo.startsWith("/") ? (
                <img
                  src={businessLogo}
                  alt="Business logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                businessLogo
              )}
            </div>
            <span className="font-medium text-foreground">{businessName}</span>
            {isConnected && (
              <Button variant="outline" size="sm" className="text-xs">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </Button>
            )}
          </div> */}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* First Section */}
        <div className="text-left mb-12">
          <div
            className="inline-block p-8 rounded-lg border-2"
            style={{ borderColor: "#d4af37" }}
          >
            <div className="mb-6">
              <h2
                className="text-2xl font-bold mb-2"
                style={{ color: "#d4af37" }}
              >
                Privacy-Preserving KYC
              </h2>
              <h5 className="text-lg">
                Upload your documents for zero-knowledge Technology
              </h5>
              <h5>
                {/* <h5 className="text-muted-foreground"> */}
                Your data remains private while proving compliance
              </h5>
            </div>
            <div>
              <h2
                className="text-2xl font-bold mb-2"
                style={{ color: "#d4af37" }}
              >
                Zero-Knowledge Technology
              </h2>
              <h4 className="text-lg mb-4">
                Your documents are processed locally and only cryptographic
                proofs are submitted
              </h4>
            </div>
          </div>
        </div>

        {/* Government ID Section - Only for Individual */}
        {kycType === "individual" && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <h2
                  className="text-3xl font-bold mb-2"
                  style={{ color: "#d4af37" }}
                >
                  Government ID
                </h2>
                <h4 className="text-lg text-muted-foreground">
                  Passport, Driver's license or National ID
                </h4>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragStates.governmentId
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25"
                }`}
                onDragOver={(e) => handleDragOver(e, "governmentId")}
                onDragLeave={() => handleDragLeave("governmentId")}
                onDrop={(e) => handleDrop(e, "governmentId")}
              >
                {uploadedFiles.governmentId ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center space-x-2">
                      <Check className="w-6 h-6 text-green-600" />
                      <span className="font-medium">
                        {uploadedFiles.governmentId.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile("governmentId")}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
                    <div>
                      <p className="text-lg font-medium mb-2">
                        Drag and drop your file or click to browse
                      </p>
                      <input
                        ref={fileInputs.governmentId}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) =>
                          handleFileSelect("governmentId", e.target.files)
                        }
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputs.governmentId.current?.click()}
                      >
                        Choose File
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Business License Section - Only for Business */}
        {kycType === "business" && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <h2
                  className="text-3xl font-bold mb-2"
                  style={{ color: "#d4af37" }}
                >
                  Business License
                </h2>
                <h4 className="text-lg text-muted-foreground">
                  Business registration certificate
                </h4>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragStates.businessLicense
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25"
                }`}
                onDragOver={(e) => handleDragOver(e, "businessLicense")}
                onDragLeave={() => handleDragLeave("businessLicense")}
                onDrop={(e) => handleDrop(e, "businessLicense")}
              >
                {uploadedFiles.businessLicense ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center space-x-2">
                      <Check className="w-6 h-6 text-green-600" />
                      <span className="font-medium">
                        {uploadedFiles.businessLicense.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile("businessLicense")}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
                    <div>
                      <p className="text-lg font-medium mb-2">
                        Drag and drop your file or click to browse
                      </p>
                      <input
                        ref={fileInputs.businessLicense}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) =>
                          handleFileSelect("businessLicense", e.target.files)
                        }
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() =>
                          fileInputs.businessLicense.current?.click()
                        }
                      >
                        Choose File
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Proof of Address Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <h2
                className="text-3xl font-bold mb-2"
                style={{ color: "#d4af37" }}
              >
                Proof of Address
              </h2>
              <h4 className="text-lg text-muted-foreground">
                Utility bill or bank statement
              </h4>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragStates.proofOfAddress
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => handleDragOver(e, "proofOfAddress")}
              onDragLeave={() => handleDragLeave("proofOfAddress")}
              onDrop={(e) => handleDrop(e, "proofOfAddress")}
            >
              {uploadedFiles.proofOfAddress ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-2">
                    <Check className="w-6 h-6 text-green-600" />
                    <span className="font-medium">
                      {uploadedFiles.proofOfAddress.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile("proofOfAddress")}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-lg font-medium mb-2">
                      Drag and drop your file or click to browse
                    </p>
                    <input
                      ref={fileInputs.proofOfAddress}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) =>
                        handleFileSelect("proofOfAddress", e.target.files)
                      }
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputs.proofOfAddress.current?.click()}
                    >
                      Choose File
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ready to Submit Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Ready to Submit</h2>
              <h4 className="text-lg text-muted-foreground mb-6">
                Passport, Driver's license or National ID
              </h4>
              <Button
                onClick={handleGenerateProofs}
                disabled={!allFilesUploaded}
                className="px-8 py-3 text-lg"
                style={{
                  backgroundColor: allFilesUploaded ? "#d4af37" : undefined,
                  color: allFilesUploaded ? "white" : undefined,
                }}
              >
                <Shield className="w-5 h-5 mr-2" />
                Generate Proofs
              </Button>
              {!allFilesUploaded && (
                <p className="text-sm text-muted-foreground mt-2">
                  Please upload all required documents to continue
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
