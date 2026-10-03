import type { Metadata, Viewport } from "next";
import { Anuphan, Kanit } from "next/font/google";
import "./globals.css";

const body = Anuphan({ variable: "--font-body", subsets: ["thai", "latin"], weight: ["300", "400", "500", "600", "700"] });
const display = Kanit({ variable: "--font-display", subsets: ["thai", "latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "อูเล้งคาเฟ่ แก้วอินทร์",
  description: "จองโต๊ะ สั่งอาหาร ส้มตำ เซลอง ขนมภูเก็ต ผ่าน LINE",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#d9261c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
