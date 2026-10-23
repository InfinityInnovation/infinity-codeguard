import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="status">
      <h1>Page not found</h1>
      <Link href="/">Return home</Link>
    </main>
  );
}
