import "@fontsource/manrope/400";
import "@fontsource/manrope/500";
import "@fontsource/manrope/600";
import "@fontsource/manrope/700";
import "@fontsource/manrope/800";
import "@fontsource/big-shoulders-display/700";
import "@fontsource/big-shoulders-display/800";
import "@fontsource/big-shoulders-display/900";
import "./globals.css";

export const metadata = {
  title: "Ravi Fitness — Enrollment",
  description: "Enroll with Ravi or submit your next payment.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
