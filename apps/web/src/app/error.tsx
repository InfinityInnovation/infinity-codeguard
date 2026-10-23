'use client';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="status">
      <h1>Something went wrong</h1>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
