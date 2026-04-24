import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface p-8">
      <div className="max-w-md w-full text-center">
        <div className="bg-surface-container rounded-2xl p-10 mb-6">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4 block">
            find_in_page
          </span>
          <h1 className="font-display text-headline-lg text-on-surface mb-3">Page Not Found</h1>
          <p className="text-on-surface-variant text-body-md">
            The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-block bg-primary text-on-primary rounded-lg py-3 px-8 font-semibold text-body-md hover:opacity-90"
        >
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}
