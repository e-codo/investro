import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import { Toaster } from "@/components/toast";
import { WaitProvider } from "@/components/wait";
import "./globals.css";

const googleSans = Google_Sans({
  variable: "--font-google-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Моя стройка фундамента",
  description: "Личный трекер долгосрочного портфеля",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#E9E5DD" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={googleSans.variable}>
      <body>
        <WaitProvider>
          <Toaster>{children}</Toaster>
        </WaitProvider>
      </body>
    </html>
  );
}
