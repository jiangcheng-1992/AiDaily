import { Suspense } from "react";

import { SubmitClient } from "@/components/submit-client";

export default function SubmitPage() {
  return (
    <Suspense fallback={null}>
      <SubmitClient />
    </Suspense>
  );
}
