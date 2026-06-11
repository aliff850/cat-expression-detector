"use client";

import dynamic from "next/dynamic";

// Force Next.js to strictly load this component only on the client side
const DynamicMatcher = dynamic(
  () => import("./components/ExpressionMatcher"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400">
        <p className="animate-pulse text-xl">Initializing camera interface...</p>
      </div>
    )
  }
);

export default function Home() {
  return <DynamicMatcher />;
}