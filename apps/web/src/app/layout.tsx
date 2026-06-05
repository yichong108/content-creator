import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "微信",
  description: "高仿微信聊天页面",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
