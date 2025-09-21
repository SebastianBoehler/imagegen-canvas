import CanvasPage from "@/components/canvas-page";
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function Canvas() {
  const session = await auth();
  const { user } = session || {};
  if (!user) {
    return redirect("/login");
  }
  console.log(user);

  return <CanvasPage />;
}
