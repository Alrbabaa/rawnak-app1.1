"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AccountBadgePill } from "@/components/rawnak/account-badge-pill";
import { PublicProfileModal } from "@/components/rawnak/public-profile-modal";
import { useAppStore } from "@/lib/store";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MotionModal } from "@/components/ui/motion-modal";
import { Users, UserPlus, UserCheck, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { triggerSuccessHaptic, triggerSelectionHaptic } from "@/lib/haptics";
import type { AccountTier } from "@/lib/account-tiers";

interface DirectoryUser {
  id: string;
  name: string;
  avatar: string;
  accountTier: AccountTier;
  verified: boolean;
  bio?: string;
  levelTitle?: string | null;
  followedByMe?: boolean;
}

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "following" | "followers" | "explore";
  initialTab?: "following" | "followers" | "explore";
}

export function FollowersModal({ isOpen, onClose, defaultTab = "following", initialTab }: FollowersModalProps) {
  const { profile, updateProfile } = useAppStore();

  const [activeTab, setActiveTab] = useState<"following" | "followers" | "explore">(initialTab || defaultTab);
  const [followingList, setFollowingList] = useState<DirectoryUser[]>([]);
  const [followersList, setFollowersList] = useState<DirectoryUser[]>([]);
  const [searchResults, setSearchResults] = useState<DirectoryUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const [followingRes, followersRes] = await Promise.all([
        authedFetch("/api/social/following").then((r) => r.json()),
        authedFetch("/api/social/followers").then((r) => r.json()),
      ]);
      setFollowingList(followingRes?.users || []);
      setFollowersList(followersRes?.users || []);
    } catch {
      // Silent — empty-state UI covers this
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void Promise.resolve().then(loadLists);
  }, [isOpen, loadLists]);

  // Debounced name search — see /api/social/search.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    void Promise.resolve().then(() => {
      const q = search.trim();
      if (q.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const res = await authedFetch(`/api/social/search?q=${encodeURIComponent(q)}`).then((r) => r.json());
          setSearchResults(res?.users || []);
        } catch {
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      }, 400);
    });
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  const handleFollow = async (user: DirectoryUser, isCurrentlyFollowing: boolean) => {
    triggerSelectionHaptic();
    try {
      const res = await authedFetch(isCurrentlyFollowing ? "/api/social/unfollow" : "/api/social/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUid: user.id }),
      });
      if (!res.ok) throw new Error();

      updateProfile({
        followingCount: Math.max(0, (profile.followingCount ?? 0) + (isCurrentlyFollowing ? -1 : 1)),
      });

      if (isCurrentlyFollowing) {
        setFollowingList((prev) => prev.filter((u) => u.id !== user.id));
        toast("تم إلغاء المتابعة");
      } else {
        setFollowingList((prev) => (prev.some((u) => u.id === user.id) ? prev : [user, ...prev]));
        setSearchResults((prev) => prev.map((u) => (u.id === user.id ? { ...u, followedByMe: true } : u)));
        setFollowersList((prev) => prev.map((u) => (u.id === user.id ? { ...u, followedByMe: true } : u)));
        triggerSuccessHaptic();
        toast.success(`بدأتِ بمتابعة ${user.name} ✦`);
      }
    } catch {
      toast.error("حدث خطأ، حاولي مرة أخرى");
    }
  };

  const isFollowing = (userId: string) => followingList.some((u) => u.id === userId);

  const activeList =
    activeTab === "following" ? followingList : activeTab === "followers" ? followersList : searchResults;

  const showLoading = activeTab === "explore" ? searching && search.trim().length >= 2 : loading;

  return (
    <>
      <MotionModal isOpen={isOpen} onClose={onClose} title="مجتمع رَونق والتواصل 🌸">
        <div className="space-y-4 text-foreground pt-1">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-2xl border border-border/60">
            <button
              onClick={() => {
                triggerSelectionHaptic();
                setActiveTab("following");
              }}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5",
                activeTab === "following"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <UserCheck className="w-3.5 h-3.5 text-primary" />
              <span>تُتابعين ({profile.followingCount ?? followingList.length})</span>
            </button>

            <button
              onClick={() => {
                triggerSelectionHaptic();
                setActiveTab("followers");
              }}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5",
                activeTab === "followers"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="w-3.5 h-3.5 text-amber-500" />
              <span>المتابِعات ({profile.followersCount ?? followersList.length})</span>
            </button>

            <button
              onClick={() => {
                triggerSelectionHaptic();
                setActiveTab("explore");
              }}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5",
                activeTab === "explore"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-500" />
              <span>استكشاف</span>
            </button>
          </div>

          {/* Search Field — only drives real results in the "استكشاف" tab */}
          {activeTab === "explore" && (
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحثي بالاسم..."
                className="pr-9 h-10 rounded-2xl text-xs bg-muted/40 border-border/80"
              />
            </div>
          )}

          {/* User Lists */}
          {showLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p>جاري التحميل...</p>
            </div>
          ) : activeTab === "explore" && search.trim().length < 2 ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
              <Search className="w-8 h-8 mx-auto text-muted-foreground/50 mb-1" />
              <p>اكتبي اسمًا (حرفين على الأقل) لاستكشاف العضوات</p>
            </div>
          ) : activeList.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
              <Users className="w-8 h-8 mx-auto text-muted-foreground/50 mb-1" />
              <p>
                {activeTab === "following"
                  ? "لسه ما تُتابعين أحد"
                  : activeTab === "followers"
                    ? "لا يوجد متابِعات بعد"
                    : "لا يوجد نتائج بهذا الاسم"}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 pretty-scroll">
              {activeList.map((u) => {
                const following = activeTab === "following" ? true : isFollowing(u.id);
                return (
                  <Card
                    key={u.id}
                    className="p-3 rounded-2xl border border-border/70 bg-card hover:bg-muted/30 transition-all flex items-center justify-between gap-3"
                  >
                    <button
                      className="flex items-center gap-3 min-w-0 text-right flex-1"
                      onClick={() => setViewingUserId(u.id)}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-muted grid place-items-center text-2xl shrink-0 border border-border/60">
                        {u.avatar}
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-foreground truncate">{u.name}</span>
                          <AccountBadgePill tier={u.accountTier} size="sm" />
                        </div>
                        {u.bio && <p className="text-[10px] text-muted-foreground truncate">{u.bio}</p>}
                      </div>
                    </button>

                    <Button
                      onClick={() => handleFollow(u, following)}
                      size="sm"
                      variant={following ? "outline" : "default"}
                      className={cn(
                        "rounded-xl text-[11px] font-black h-8 px-3 shrink-0 gap-1 border transition-all",
                        following
                          ? "border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                          : "rawnak-gradient text-primary-foreground border-none shadow-2xs"
                      )}
                    >
                      {following ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          تُتابعين
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          متابعة
                        </>
                      )}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </MotionModal>

      <PublicProfileModal
        userId={viewingUserId}
        onClose={() => setViewingUserId(null)}
        onFollowChange={(userId, nowFollowing) => {
          if (nowFollowing) {
            const fromSearch = searchResults.find((u) => u.id === userId);
            const fromFollowers = followersList.find((u) => u.id === userId);
            const user = fromSearch || fromFollowers;
            if (user) setFollowingList((prev) => (prev.some((u) => u.id === userId) ? prev : [user, ...prev]));
          } else {
            setFollowingList((prev) => prev.filter((u) => u.id !== userId));
          }
        }}
        onBlock={(userId) => {
          setFollowingList((prev) => prev.filter((u) => u.id !== userId));
          setFollowersList((prev) => prev.filter((u) => u.id !== userId));
          setSearchResults((prev) => prev.filter((u) => u.id !== userId));
        }}
      />
    </>
  );
}
