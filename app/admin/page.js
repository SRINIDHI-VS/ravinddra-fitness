import AdminDashboard from "@/app/components/admin/AdminDashboard";

export const metadata = {
  title: "Ravi Fitness — Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
