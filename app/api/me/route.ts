import { getCurrentUser } from "../../auth";
import { jsonResponse, routeError } from "../../../lib/api-security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return jsonResponse({
      user: user
        ? { id: user.userId, name: user.email, email: user.email }
        : null,
    });
  } catch (error) {
    return routeError(error);
  }
}
