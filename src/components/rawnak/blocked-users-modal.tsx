"use client";

import { useEffect, useState } from "react";
import { UserX, Ban } from "lucide-react";
import { toast } from "sonner";
import { MotionModal } from "@/components/ui/motion-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authedFetch } from "@/lib/firebase/authed-fetch";

interface BlockedUser {
  id: string;
  name: string;
  avatar: string;
}

interface BlockedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Entry point required alongside the block feature itself — App Store
 * reviewers specifically check that a blocked list is reachable and
 * reversible, not just that a block button exists somewhere. Reachable
 * from profile-screen.tsx's "الحساب" tab.
 */
export function BlockedUsersModal({ isOpen, onClose }: BlockedUsersModalProps) {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    void Promise.resolve().then(() => {
      setLoading(true);
      authedFetch("/api/social/blocked")
        .then((r) => r.json())
        .then((json) => setUsers(json?.users || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [isOpen]);

  const handleUnblock = async (user: BlockedUser) => {
    setUnblockingId(user.id);
    try {
      const res = await authedFetch("/api/social/unblock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUid: user.id }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(`تم إلغاء حظر ${user.name}`);
    } catch {
      toast.error("تعذّر إلغاء الحظر، حاولي مرة أخرى");
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <MotionModal isOpen={isOpen} onClose={onClose} title="المستخدمات المحظورات">
      <div className="pt-1">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p>جاري التحميل...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
            <Ban className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p>لم تقومي بحظر أي حساب حتى الآن</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {users.map((user) => (
              <Card key={user.id} className="flex items-center gap-3 p-3 rounded-2xl">
                <div className="w-10 h-10 rounded-2xl bg-muted grid place-items-center text-xl shrink-0">
                  {user.avatar}
                </div>
                <p className="flex-1 text-right text-xs font-bold text-foreground truncate">{user.name}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-[11px] h-8 shrink-0"
                  disabled={unblockingId === user.id}
                  onClick={() => handleUnblock(user)}
                >
                  <UserX className="w-3.5 h-3.5" />
                  إلغاء الحظر
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MotionModal>
  );
}
