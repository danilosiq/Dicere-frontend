import { HomeScreen } from "@/core/features/home";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeScreen />
    </Suspense>
  );
}
