"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { getUserSettings, updateUserSettings } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Settings"}
    </Button>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    customInstructions: "",
    useLocation: true,
    referenceChatHistory: true,
    referenceMemories: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getUserSettings()
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customInstructions = formData.get("customInstructions") as string;
    const useLocation = formData.get("useLocation") === "on";
    const referenceChatHistory = formData.get("referenceChatHistory") === "on";
    const referenceMemories = formData.get("referenceMemories") === "on";

    try {
      await updateUserSettings(formData);
      setSettings({
        customInstructions,
        useLocation,
        referenceChatHistory,
        referenceMemories,
      });
      toast("Settings saved successfully!");
    } catch (err) {
      toast("Failed to save settings. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="container max-w-3xl py-10 space-y-8 px-4 md:px-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-3xl py-10 space-y-8 px-4 md:px-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            AI personality and privacy settings
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>⚠️ Database Sync in Progress</CardTitle>
            <CardDescription>
              Your settings are being synchronized. This usually takes 1-2 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              The database is still updating with the new settings columns. 
              Please wait a moment and refresh this page.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <a href="/settings">Refresh Page</a>
              </Button>
              <Button asChild variant="outline">
                <a href="/">Back to Chat</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-10 space-y-8 px-4 md:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your AI preferences and privacy settings.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                value={settings.customInstructions}
                onChange={(e) => setSettings({ ...settings, customInstructions: e.target.value })}
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
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
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
                checked={settings.useLocation}
                onChange={(e) => setSettings({ ...settings, useLocation: e.target.checked })}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="referenceChatHistory">Référencer l'historique du chat</Label>
                <p className="text-sm text-muted-foreground">
                  Autoriser l'IA à s'appuyer sur les messages précédents de cette conversation pour répondre.
                </p>
              </div>
              <input
                type="checkbox"
                id="referenceChatHistory"
                name="referenceChatHistory"
                checked={settings.referenceChatHistory}
                onChange={(e) => setSettings({ ...settings, referenceChatHistory: e.target.checked })}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="referenceMemories">Référencer les éléments mémorisés</Label>
                <p className="text-sm text-muted-foreground">
                  Permettre l'usage d'éléments mémorisés/sauvegardés. Désactivez pour des réponses sans souvenirs.
                </p>
              </div>
              <input
                type="checkbox"
                id="referenceMemories"
                name="referenceMemories"
                checked={settings.referenceMemories}
                onChange={(e) => setSettings({ ...settings, referenceMemories: e.target.checked })}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Save Settings</Button>
        </div>
      </form>
    </div>
  );
}
