import { Suspense } from "react";
import ConfirmPage from "@/components/ConfirmPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading payment confirmation...</div>}>
      <ConfirmPage />
    </Suspense>
  );
}
