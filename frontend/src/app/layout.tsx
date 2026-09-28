import "./globals.css";
import Providers from "./providers";

export const metadata = { title: "OverVault" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
