import { appAuth } from "@/lib/auth/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { chatModels } from "@/lib/ai/models";
import { getDailyCreditsStateByUserId, getOrCreateUser } from "@/lib/db/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GUEST_ID_COOKIE_NAME = "guest_user_id";

export default async function StatsPage() {
  const { userId: clerkUserId } = await appAuth();
  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_ID_COOKIE_NAME)?.value;

  const currentUserId = clerkUserId ?? guestId;
  if (!currentUserId) {
    redirect("/login");
  }

  const userType = clerkUserId ? "regular" : "guest";

  await getOrCreateUser(currentUserId, undefined, { userType });
  const credits = await getDailyCreditsStateByUserId({
    id: currentUserId,
    userType,
  });
  const now = new Date();
  const nextResetUtc = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0
    )
  );
  const remainingMs = Math.max(0, nextResetUtc.getTime() - now.getTime());
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMinutes = Math.floor(
    (remainingMs % (1000 * 60 * 60)) / (1000 * 60)
  );

  return (
    <div className="container max-w-4xl space-y-6 px-4 py-10 md:px-8">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">Stats credits</h1>
        <p className="text-muted-foreground text-sm">
          Suivi des credits et couts par modele.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credits du jour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Restants: <span className="font-semibold">{credits.remainingCredits}</span> / {credits.dailyCredits}
          </p>
          <p>
            Type de compte: <span className="font-semibold">{userType}</span>
          </p>
          <p>
            Dernier reset: <span className="font-semibold">{credits.resetAt.toISOString().slice(0, 10)}</span>
          </p>
          <p>
            Prochain reset dans:{" "}
            <span className="font-semibold">
              {remainingHours}h {remainingMinutes}m (UTC)
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cout par modele</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Modele</th>
                  <th className="px-2 py-2 text-left font-medium">Provider</th>
                  <th className="px-2 py-2 text-right font-medium">Coins / message</th>
                </tr>
              </thead>
              <tbody>
                {chatModels.map((model) => (
                  <tr className="border-b" key={model.id}>
                    <td className="px-2 py-2">{model.name}</td>
                    <td className="px-2 py-2 text-muted-foreground">{model.provider}</td>
                    <td className="px-2 py-2 text-right">
                      {model.id === "auto" ? "Variable" : model.creditCost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

