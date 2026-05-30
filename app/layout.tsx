import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PetaKonsep AI",
  description: "Cognitive diagnostic engine untuk memetakan akar miskonsepsi siswa.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
