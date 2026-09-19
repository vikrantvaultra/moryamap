import type { Metadata } from 'next';
import Link from 'next/link';
import '@/app/globals.css';

// Admin is English-only, behind basic auth (middleware), always dynamic.
export const metadata: Metadata = {
  title: 'Morya Map — Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-100 font-sans text-stone-900 antialiased">
        <header className="border-b border-stone-300 bg-white">
          <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between px-4">
            <Link href="/admin" className="text-sm font-bold text-maroon">
              Morya Map · Admin
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/admin/restore"
                className="text-xs font-semibold text-maroon hover:text-stone-800"
              >
                Restore codes
              </Link>
              <Link href="/" className="text-xs font-medium text-stone-500 hover:text-stone-800">
                View site →
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
