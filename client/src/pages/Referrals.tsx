import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Gift,
  Copy,
  Check,
  ArrowLeft,
  Users,
  DollarSign,
  Share2,
  Sparkles,
  Loader2,
  UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import type { Referral } from "@shared/schema";

interface ReferralData {
  referralCode: string;
  referrals: Referral[];
  totalRewards: number;
}

export default function Referrals() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: referralData, isLoading } = useQuery<ReferralData>({
    queryKey: ["/api/referrals"],
  });

  const copyReferralLink = () => {
    const link = `${window.location.origin}/join?ref=${referralData?.referralCode || ""}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Referral link copied!" });
  };

  const shareReferralLink = async () => {
    const link = `${window.location.origin}/join?ref=${referralData?.referralCode || ""}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join GigAid",
          text: "Use my referral link to sign up for GigAid and we both get rewards!",
          url: link,
        });
      } catch (e) {
        copyReferralLink();
      }
    } else {
      copyReferralLink();
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative overflow-hidden bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 text-white px-4 pt-6 pb-8">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/more")}
              className="mb-4 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Referrals</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const totalReferred = referralData?.referrals?.length || 0;
  const totalRewards = referralData?.totalRewards || 0;

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="page-referrals">
      <div className="relative overflow-hidden bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 text-white px-4 pt-6 pb-16">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-rose-400/20 rounded-full blur-2xl" />
          <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-pink-300/10 rounded-full blur-2xl" />
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/more")}
            className="mb-4 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Referrals</h1>
              <p className="text-rose-100/80">Invite friends, earn rewards</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-4">
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/10 dark:to-pink-900/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-rose-500" />
                  <span className="font-medium">Your Referral Code</span>
                </div>
                <Badge variant="secondary" className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                  Active
                </Badge>
              </div>
              <div className="bg-white dark:bg-background rounded-xl p-4 flex items-center justify-between shadow-sm">
                <code className="text-2xl font-mono font-bold tracking-wider">
                  {referralData?.referralCode || "Loading..."}
                </code>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={copyReferralLink}
                  data-testid="button-copy-referral"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <Copy className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="p-4 flex gap-2">
              <Button 
                className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                onClick={shareReferralLink}
                data-testid="button-share-referral"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Link
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={copyReferralLink}
                data-testid="button-copy-link"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className="h-12 w-12 mx-auto mb-2 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-3xl font-bold">{totalReferred}</p>
              <p className="text-sm text-muted-foreground">People Referred</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className="h-12 w-12 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-3xl font-bold text-green-600">${(totalRewards / 100).toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Total Rewards</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Gift className="h-4 w-4 text-rose-500" />
              How It Works
            </h3>
            <div className="space-y-4">
              {[
                { step: 1, title: "Share Your Link", desc: "Send your unique referral link to friends" },
                { step: 2, title: "They Sign Up", desc: "When they join using your link" },
                { step: 3, title: "You Both Earn", desc: "Get rewards when they complete their first job" },
              ].map((item) => (
                <div key={item.step} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {referralData?.referrals && referralData.referrals.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-rose-500" />
                Your Referrals
              </h3>
              <div className="space-y-3">
                {referralData.referrals.map((referral, index) => (
                  <div 
                    key={referral.id || index}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-rose-400 to-pink-500 text-white text-sm">
                        {getInitials(referral.referredEmail?.split("@")[0] || "User")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{referral.referredEmail?.split("@")[0] || "Referred User"}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {referral.createdAt ? format(new Date(referral.createdAt), "MMM d, yyyy") : "recently"}
                      </p>
                    </div>
                    {referral.rewardAmount && referral.rewardAmount > 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        +${(referral.rewardAmount / 100).toFixed(2)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(!referralData?.referrals || referralData.referrals.length === 0) && (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                <UserPlus className="h-8 w-8 text-rose-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No referrals yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
                Share your link with friends and start earning rewards together
              </p>
              <Button 
                onClick={shareReferralLink}
                className="bg-gradient-to-r from-rose-500 to-pink-500"
                data-testid="button-share-empty"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Your Link
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
