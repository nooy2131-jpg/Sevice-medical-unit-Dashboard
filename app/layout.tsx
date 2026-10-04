import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ระบบรายงานหน่วยบริการ · รพ.องครักษ์',
  description: 'ระบบรายงานสถิติหน่วยบริการชั่วคราว โรงพยาบาลองครักษ์',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
