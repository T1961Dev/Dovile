"use client";

import { useState, useTransition } from "react";
import { Users, Trophy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SocialFeaturesProps = {
  userId: string;
  xpSummary: {
    totalXp: number;
    currentLevel: number;
    streak: number;
  };
};

export function SocialFeatures({ userId, xpSummary }: SocialFeaturesProps) {
  const [friendEmail, setFriendEmail] = useState("");
  const [pending, startTransition] = useTransition();

  const handleAddFriend = () => {
    if (!friendEmail.trim()) return;
    startTransition(async () => {
      // TODO: Implement friend request
      console.log("Add friend:", friendEmail);
    });
  };

  const handleShareProgress = () => {
    // TODO: Implement share functionality
    navigator.clipboard.writeText(
      `Check out my LifeWheel progress! Level ${xpSummary.currentLevel}, ${xpSummary.totalXp} XP, ${xpSummary.streak} day streak! 🔥`,
    );
  };

  return (
    <Card className="rounded-3xl border border-slate-100 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Social & Competition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Friend's email"
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              className="flex-1 rounded-full"
            />
            <Button
              onClick={handleAddFriend}
              disabled={pending || !friendEmail.trim()}
              className="rounded-full"
            >
              Add Friend
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={handleShareProgress}
            className="w-full rounded-full"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Progress
          </Button>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 p-4 border border-yellow-200">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-5 w-5 text-yellow-600" />
            <h4 className="text-sm font-semibold text-yellow-900">Leaderboard</h4>
          </div>
          <p className="text-xs text-yellow-800">
            Compete with friends on daily XP, weekly streaks, and monthly task completion!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

