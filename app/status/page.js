import StatusCheck from "@/app/components/status/StatusCheck";

export const metadata = {
  title: "Ravi Fitness — My Status",
  robots: { index: false, follow: false },
};

export default function StatusPage() {
  return <StatusCheck />;
}
