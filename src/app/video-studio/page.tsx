import VideoStudioPage from "@/components/video-studio-page";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function VideoStudio() {
  const session = await auth();
  const { user } = session || {};
  if (!user) {
    return redirect("/login");
  }

  return <VideoStudioPage />;
}
