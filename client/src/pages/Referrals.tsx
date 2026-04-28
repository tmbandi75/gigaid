import { useState } from "react";
import { safePriceCentsExact } from "@/lib/safePrice";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { copyTextToClipboard } from "@/lib/clipboard";
import { shareContent } from "@/lib/share";
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
  Wallet,
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
  const isMobile = useIsMobile();

  const { data: referralData, isLoading } = useQuery<ReferralData>({
    queryKey: QUERY_KEYS.referrals(),
  });

  // Calculate redeemable rewards (rewarded but not yet redeemed)
  const redeemableReferrals = referralData?.referrals?.filter(
    (r) => r.status === "rewarded" && !r.redeemedAt
  ) || [];
  const redeemableAmount = redeemableReferrals.reduce(
    (sum, r) => sum + (r.rewardAmount || 0),
    0
  );

  const redeemMutation = useApiMutation(
    () => apiFetch<{ message: string }>("/api/referrals/redeem", { method: "POST" }),
    [QUERY_KEYS.referrals()],
    {
      onSuccess: (data) => {
        toast({
          title: "Rewards redeemed!",
          description: data.message,
        });
      },
      onError: () => {
        toast({
          title: "Failed to redeem",
          description: "Please try again later",
          variant: "destructive",
        });
      },
    }
  );

  const copyReferralLink = async (options?: { silentSuccess?: boolean }) => {
    const link = `${window.location.origin}/join?ref=${referralData?.referralCode || ""}`;
    const copiedSuccessfully = await copyTextToClipboard(link);
    if (!copiedSuccessfully) {
      toast({
        title: "Could not copy link",
        description: "Try sharing the link instead.",
        variant: "destructive",
      });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (!options?.silentSuccess) {
      toast({ title: "Referral link copied!" });
    }
  };

  const shareReferralLink = async () => {
    const link = `${window.location.origin}/join?ref=${referralData?.referralCode || ""}`;
    const { shared } = await shareContent({
      title: "Join GigAid",
      text: "Use my referral link to sign up for GigAid and we both get rewards!",
      url: link,
      dialogTitle: "Share referral link",
    });
    if (!shared) {
      await copyReferralLink({ silentSuccess: true });
      toast({
        title: "Share unavailable",
        description: "We copied your referral link instead.",
      });
    }
  };

  const handleShareLink = () => {
    void shareReferralLink();
  };

  const handleCopyLink = () => {
    void copyReferralLink();
  };
  
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  
  const renderMobileHeader = () => (
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
  );

  const renderDesktopHeader = () => (
    <div className="border-b bg-background sticky top-0 z-[999]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 flex items-center justify-center">
              <Gift className="h-6 w-6 text-pink-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Referrals</h1>
              <p className="text-sm text-muted-foreground">Invite friends, earn rewards</p>
            </div>
          </div>
          <div className="flex items-center gap-8 pr-6 border-r">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground" data-testid="text-total-referred">{referralData?.referrals?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Referred</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground" data-testid="text-total-rewards">{safePriceCentsExact(referralData?.totalRewards)}</p>
              <p className="text-xs text-muted-foreground">Rewards</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {isMobile ? renderMobileHeader() : renderDesktopHeader()}
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const totalReferred = referralData?.referrals?.length || 0;
  const totalRewards = referralData?.totalRewards || 0;

  return (
    <div className="min-h-screen bg-background" data-testid="page-referrals">
      {isMobile ? renderMobileHeader() : renderDesktopHeader()}

      <div className={`${isMobile ? "px-4 -mt-10 pb-24" : "max-w-7xl mx-auto px-6 lg:px-8 py-6 pb-12"} relative z-10 space-y-4`}>
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
                  onClick={handleCopyLink}
                  aria-label="Copy referral link"
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
                onClick={handleShareLink}
                data-testid="button-share-referral"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Link
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleCopyLink}
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
              <p className="text-3xl font-bold text-green-600">{safePriceCentsExact(totalRewards)}</p>
              <p className="text-sm text-muted-foreground">Total Rewards</p>
            </CardContent>
          </Card>
        </div>

        {redeemableAmount > 0 && (
          <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">
                      {safePriceCentsExact(redeemableAmount)} Available
                    </p>
                    <p className="text-sm text-muted-foreground">
                      From {redeemableReferrals.length} referral{redeemableReferrals.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => redeemMutation.mutate()}
                  disabled={redeemMutation.isPending}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  data-testid="button-redeem-rewards"
                >
                  {redeemMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Gift className="h-4 w-4 mr-2" />
                  )}
                  Redeem
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Credit will be applied to your next subscription invoice
              </p>
            </CardContent>
          </Card>
        )}

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
                    {referral.status === "redeemed" ? (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        Redeemed
                      </Badge>
                    ) : referral.status === "rewarded" && referral.rewardAmount && referral.rewardAmount > 0 ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        +{safePriceCentsExact(referral.rewardAmount)}
                      </Badge>
                    ) : referral.status === "signed_up" ? (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Signed Up
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Pending
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
                onClick={handleShareLink}
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
