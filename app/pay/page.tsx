import { Suspense } from "react";
import PayPage from "@/components/PayPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading payment page...</div>}>
      <PayPage />
    </Suspense>
  );
}
