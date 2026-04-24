import Link from "next/link";

interface ErrorStateProps {
  title?: string;
  message?: string;
  backHref?: string;
  backLabel?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We could not load this page. Please try again or contact support.",
  backHref = "/dashboard",
  backLabel = "Go to Dashboard",
}: ErrorStateProps) {
  return (
    <div className="py-stack-lg max-w-2xl">
      <div className="bg-surface-container rounded-xl p-8 mb-6 text-center">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">error_outline</span>
        <h1 className="font-display text-headline-lg text-on-surface mb-3">{title}</h1>
        <p className="text-on-surface-variant text-body-md">{message}</p>
      </div>
      <Link href={backHref} className="block text-center text-secondary underline text-body-md">
        {backLabel}
      </Link>
    </div>
  );
}
