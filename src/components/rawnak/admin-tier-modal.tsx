"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ACCOUNT_TIERS,
  type AccountTier,
  getAccountTierMeta,
} from "@/lib/account-tiers";
import {
  getCommunityUsers,
  saveAdminTierOverride,
  type CommunityUser,
} from "@/lib/firebase/social-service";
import { AccountBadgePill } from "@/components/rawnak/account-badge-pill";
import { useAppStore } from "@/lib/store";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MotionModal } from "@/components/ui/motion-modal";
import {
  ShieldCheck,
  Crown,
  Search,
  CheckCircle2,
  Sparkles,
  Zap,
  Building2,
  Star,
  Users,
  Award,
  ChevronLeft,
  X,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { triggerSuccessHaptic } from "@/lib/haptics";

interface AdminTierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminTierModal({ isOpen, onClose }: AdminTierModalProps) {
  const { profile, updateProfile, authUid } = useAppStore();

  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<CommunityUser | null>(null);
  const [selectedTier, setSelectedTier] = useState<AccountTier>("standard");
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const commUsers = await getCommunityUsers();

    // Insert current user at the top if not present
    const currentUserInList: CommunityUser = {
      id: "current_admin_user",
      name: `${profile.name || "أنتِ"} (حسابكِ الحالي)`,
      avatar: profile.avatar || "👑",
      profileImage: profile.profileImage || null,
      accountTier: profile.accountTier || "standard",
      bio: "حساب الإدارة والتحكم الرئيسي ✦",
      followersCount: profile.followersCount ?? 0,
      followingCount: profile.followingCount ?? 0,
      isFollowing: false,
      xp: 1250,
      levelTitle: "أيقونة رَونق المعتمدة",
      countryFlag: "👑",
      verified: true,
    };

    setUsers([currentUserInList, ...commUsers]);
    setSelectedUser(currentUserInList);
    setSelectedTier(currentUserInList.accountTier);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        loadUsers();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, loadUsers]);

  const handleSelectUser = (u: CommunityUser) => {
    setSelectedUser(u);
    setSelectedTier(u.accountTier);
  };

  const handleSaveTier = async () => {
    if (!selectedUser) return;

    triggerSuccessHaptic();

    if (selectedUser.id === "current_admin_user") {
      // Real account, real backend: persisted via the admin-only tier
      // endpoint (Firestore users/{uid}.accountTier), not just local state
      // — otherwise the badge would look changed on this device but reset
      // on next sign-in/reinstall, or on any other device.
      updateProfile({ accountTier: selectedTier });
      if (authUid) {
        try {
          const res = await authedFetch(`/api/admin/users/${authUid}/tier`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountTier: selectedTier }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || "تم التحديث محليًا فقط — فشل الحفظ على الخادم");
          }
        } catch {
          toast.error("تم التحديث محليًا فقط — فشل الحفظ على الخادم");
        }
      }
    } else {
      // Demo/community accounts are not real registered users — this
      // override stays local-only (cosmetic), same as before.
      saveAdminTierOverride(selectedUser.id, selectedTier);
    }

    // Update local state list
    setUsers((prev) =>
      prev.map((u) => (u.id === selectedUser.id ? { ...u, accountTier: selectedTier } : u))
    );

    setSelectedUser((prev) => (prev ? { ...prev, accountTier: selectedTier } : null));

    const tierMeta = getAccountTierMeta(selectedTier);
    toast.success(`تم تحديث فئة حساب [${selectedUser.name}] إلى ${tierMeta.label} (${tierMeta.badgeIcon}) ✦`);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.bio.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MotionModal isOpen={isOpen} onClose={onClose} title="لوحة مراجعة وإدارة شارات الحسابات (Admin)">
      <div className="space-y-4 text-foreground pt-1">
        {/* Header Intro Banner */}
        <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <h4 className="font-black text-foreground">نظام توثيق ورتب الحسابات</h4>
            <p className="text-muted-foreground leading-relaxed mt-0.5">
              بصفتكِ إدمن معتمدة، يمكنكِ مراجعة حسابات العضوات وتعيين الفئة المميزة (عادي، نشط، مميز، VIP، مؤثر/مشهور، أو نشاط تجاري).
            </p>
          </div>
        </div>

        {/* User Search & Selection */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحثي عن عضوة بالاسم أو الوصف..."
              className="pr-9 h-10 rounded-2xl text-xs bg-muted/40 border-border/80"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 pretty-scroll">
            {filteredUsers.map((u) => {
              const isSelected = selectedUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={cn(
                    "p-2 rounded-2xl border text-right transition-all shrink-0 min-w-[130px] flex items-center gap-2",
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-border/60 bg-card hover:bg-muted/40"
                  )}
                >
                  <div className="w-8 h-8 rounded-xl bg-muted grid place-items-center text-sm shrink-0">
                    {u.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-[11px] text-foreground truncate">
                      {u.name}
                    </p>
                    <AccountBadgePill tier={u.accountTier} size="sm" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* User Detail & Tier Selector Card */}
        {selectedUser && (
          <Card className="p-4 rounded-2xl border-border/80 bg-card space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-muted/80 grid place-items-center text-2xl shrink-0">
                  {selectedUser.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-extrabold text-sm text-foreground">
                      {selectedUser.name}
                    </h4>
                    <AccountBadgePill tier={selectedUser.accountTier} size="sm" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {selectedUser.bio}
                  </p>
                </div>
              </div>

              <div className="text-left shrink-0">
                <Badge variant="outline" className="text-[10px] font-bold rounded-full">
                  {selectedUser.xp} XP
                </Badge>
              </div>
            </div>

            {/* Select Tier Tier Selector */}
            <div className="space-y-2">
              <label className="text-xs font-black text-foreground block">
                تحديد الفئة والرتبة الرسمية للحساب:
              </label>

              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ACCOUNT_TIERS) as AccountTier[]).map((tierKey) => {
                  const tMeta = ACCOUNT_TIERS[tierKey];
                  const isSelectedTier = selectedTier === tierKey;

                  return (
                    <button
                      key={tierKey}
                      onClick={() => setSelectedTier(tierKey)}
                      className={cn(
                        "p-2.5 rounded-2xl border text-right transition-all space-y-1 relative",
                        isSelectedTier
                          ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                          : "border-border/60 bg-muted/20 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-foreground flex items-center gap-1">
                          <span>{tMeta.badgeIcon}</span>
                          <span>{tMeta.label}</span>
                        </span>

                        {isSelectedTier && (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </div>

                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {tMeta.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSaveTier}
              className="w-full h-11 rounded-2xl font-black text-xs rawnak-gradient text-primary-foreground gap-1.5 shadow-sm"
            >
              <UserCheck className="w-4 h-4" />
              اعتماد الفئة والشارة الجديدة للحساب
            </Button>
          </Card>
        )}
      </div>
    </MotionModal>
  );
}
