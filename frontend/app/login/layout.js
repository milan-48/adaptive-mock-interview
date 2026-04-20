import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function LoginLayout({ children }) {
  return (
    <div className={`${inter.className} min-h-full antialiased`}>{children}</div>
  );
}
