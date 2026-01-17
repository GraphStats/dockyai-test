import { auth } from "@/app/(auth)/auth";
import { redirect } from "next/navigation";
import { getUserSettings, updateUserSettings } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const settings = await getUserSettings();

  return (
    <div className="container max-w-2xl py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your AI preferences and privacy settings.
        </p>
      </div>

      <form action={updateUserSettings} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>AI Personality</CardTitle>
            <CardDescription>
              Tell the AI how you want it to behave and what to call it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customInstructions">Custom Instructions</Label>
              <Textarea
                id="customInstructions"
                name="customInstructions"
                placeholder="Ex: Call me 'Commander'. Be very professional and formal."
                defaultValue={settings.customInstructions}
                className="min-h-[150px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
            <CardDescription>
              Control what information is shared with the AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="useLocation">Share Location</Label>
              <p className="text-sm text-muted-foreground">
                Allow the AI to see your city and country to give local information.
              </p>
            </div>
            <input
              type="checkbox"
              id="useLocation"
              name="useLocation"
              defaultChecked={settings.useLocation}
              className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Save Settings</Button>
        </div>
      </form>
    </div>
  );
}
