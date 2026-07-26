import { redirect } from "next/navigation";

/** Upload now lives in the landing hero — keep /create as a stable entry URL. */
export default function CreatePage() {
  redirect("/");
}
