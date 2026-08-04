import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md flex flex-col items-center space-y-4 text-center max-w-md">
        <h1 className="text-4xl font-bold text-[var(--brand-600)]">404</h1>
        <p className="text-gray-600 font-medium">
          We couldn&apos;t find the page you&apos;re looking for.
        </p>
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
