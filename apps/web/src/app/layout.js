import "./globals.css";

export const metadata = {
  title: "CodeRank – Rank Up Your Coding",
  description:
    "CodeRank is a secure, real-time coding platform for academic institutions — featuring dynamic practicals, live code execution, faculty dashboards, and student progress tracking.",
  keywords: "coding platform, practicals, lab exam, code execution, faculty dashboard, academic",
  openGraph: {
    title: "CodeRank – Rank Up Your Coding",
    description: "A secure, real-time academic coding platform with live execution and dashboards.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
