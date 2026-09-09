// src/Store/useGroupStore.ts
import { create } from "zustand";
import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useUserStore } from "./useUserStore";

export type MessageStatus = "sending" | "sent" | "delivered" | "failed";

export interface ChatMessage {
  id: string;
  group_id: string;
  user_id: string;
  author: string;
  message: string;
  created_at: string;
  is_edited: boolean;
  status?: MessageStatus;
  reply_to?: ReplyPreview | null;
}

export interface ReplyPreview {
  id: string;
  author: string;
  message: string;
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  subject: string;
  icon: string;
  join_code: string;
  is_private: boolean;
  member_count: number;
  created_by: string;
  created_at: string;
  isActive: boolean;
  recentMembers: string[];
}

interface GroupMessageJoinRow {
  id: string;
  group_id: string;
  user_id: string;
  message: string;
  created_at: string;
  is_edited: boolean;
  reply_to_id?: string | null;
  profiles: { name: string } | null;
}





interface ReplyMessageRow {
  id: string;
  user_id: string;
  message: string;
}

interface GroupState {
  groups: StudyGroup[];
  myGroupIds: string[];
  messages: Record<string, ChatMessage[]>;
  loading: boolean;
  msgLoading: boolean;
  error: string | null;
  nameCache: Map<string, string>;

  loadGroups: () => Promise<void>;
  loadMyGroups: () => Promise<void>;
  createGroup: (data: {
    name: string;
    description: string;
    subject: string;
  }) => Promise<void>;
  joinGroup: (id: string) => Promise<void>;
  joinByCode: (code: string) => Promise<{ error: string | null }>;
  leaveGroup: (id: string) => Promise<void>;
  loadMessages: (groupId: string) => Promise<void>;
  sendMessage: (
    groupId: string,
    text: string,
    replyTo?: ReplyPreview | null,
  ) => Promise<void>;
  retryMessage: (groupId: string, tempId: string) => Promise<void>;
  subscribeToChat: (groupId: string) => () => void;
  getMessages: (groupId: string) => ChatMessage[];
  getName: (userId: string) => Promise<string>;
}

const SUBJECT_ICONS: Record<string, string> = {
  English: "📖",
  Mathematics: "🔢",
  Physics: "⚡",
  Chemistry: "⚗️",
  Biology: "🧬",
  Economics: "📊",
  Government: "🏛️",
  Literature: "📚",
  "CRS/IRS": "✝️",
  History: "📜",
  Mixed: "📑",
};

// Store failed messages for retry: tempId → { groupId, text, replyTo }
const failedMessages = new Map<
  string,
  { groupId: string; text: string; replyTo?: ReplyPreview | null }
>();

export const useGroupStore = create<GroupState>()((set, get) => ({
  groups: [],
  myGroupIds: [],
  messages: {},
  loading: true,
  msgLoading: false,
  error: null,
  nameCache: new Map<string, string>(),

  getName: async (userId: string) => {
    const { nameCache } = get();
    if (nameCache.has(userId)) return nameCache.get(userId)!;

    try {
      const { data } = (await supabase
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .maybeSingle()) as { data: any; error: any };

      const name = data?.name || "JAMB Champion";
      set((s) => {
        const newCache = new Map(s.nameCache);
        newCache.set(userId, name);
        return { nameCache: newCache };
      });
      return name;
    } catch (err) {
      console.error("Error fetching name:", err);
      return "JAMB Champion";
    }
  },

  // ── loadGroups ──────────────────────────────────────────
  loadGroups: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("study_groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((g) => ({
        ...g,
        icon: SUBJECT_ICONS[g.subject] || "📚",
        recentMembers: [],
        isActive: false,
      }));

      set({ groups: mapped as StudyGroup[], loading: false });
    } catch (err: any) {
      console.error("loadGroups error:", err);
      set({ error: "We couldn't load study groups right now. Please try again.", loading: false });
    }
  },

  // ── loadMyGroups ────────────────────────────────────────
  loadMyGroups: async () => {
    const userId = useUserStore.getState().id;
    if (!userId) {
      set({ myGroupIds: [] });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId);

      if (error) throw error;
      set({ myGroupIds: data?.map((r) => r.group_id) || [] });
    } catch (err) {
      console.error("loadMyGroups error:", err);
      set({ myGroupIds: [] });
    }
  },

  // ── createGroup ─────────────────────────────────────────
  createGroup: async (data) => {
    const userId = useUserStore.getState().id;
    if (!userId) return;

    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from("study_groups")
        .insert({
          name: data.name,
          description: data.description,
          subject: data.subject,
          created_by: userId,
        });

      if (error) throw error;
      await Promise.all([get().loadGroups(), get().loadMyGroups()]);
    } catch (err) {
      console.error("createGroup error:", err);
      set({ error: "We couldn't create the group right now. Please try again." });
    } finally {
      set({ loading: false });
    }
  },

  // ── joinGroup ───────────────────────────────────────────
  joinGroup: async (groupId) => {
    const userId = useUserStore.getState().id;
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("group_members")
        .insert({ group_id: groupId, user_id: userId, role: "member" });

      if (error) throw error;
      set((s) => ({ myGroupIds: [...new Set([...s.myGroupIds, groupId])] }));
      await get().loadGroups();
    } catch (err) {
      console.error("joinGroup error:", err);
    }
  },

  // ── joinByCode ──────────────────────────────────────────
  joinByCode: async (code) => {
    const userId = useUserStore.getState().id;
    if (!userId) return { error: "Please sign in to join groups" };

    try {
      const { data: group, error: groupError } = await supabase
        .from("study_groups")
        .select("id")
        .eq("join_code", code.toUpperCase().trim())
        .single();

      if (groupError || !group)
        return { error: "Invalid join code. Please check and try again." };

      const { error: insertError } = await supabase
        .from("group_members")
        .insert({ group_id: group.id, user_id: userId, role: "member" });

      if (insertError) {
        if (insertError.code === "23505")
          return { error: "You are already a member of this group." };
        return { error: "Failed to join group. Please try again." };
      }

      set((s) => ({ myGroupIds: [...new Set([...s.myGroupIds, group.id])] }));
      await get().loadGroups();
      return { error: null };
    } catch {
      return { error: "Something went wrong. Please try again." };
    }
  },

  // ── leaveGroup ──────────────────────────────────────────
  leaveGroup: async (groupId) => {
    const userId = useUserStore.getState().id;
    if (!userId) return;

    try {
      await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId);

      set((s) => ({ myGroupIds: s.myGroupIds.filter((id) => id !== groupId) }));
      await get().loadGroups();
    } catch (err) {
      console.error("leaveGroup error:", err);
    }
  },

  // ── loadMessages ────────────────────────────────────────
  loadMessages: async (groupId) => {
    set({ msgLoading: true });
    try {
      const { data: msgs, error: msgErr } = (await supabase
        .from("group_messages")
        .select(
          `
          *,
          profiles:user_id (name)
        `,
        )
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(100)) as { data: GroupMessageJoinRow[] | null; error: PostgrestError | null };

      if (msgErr) throw msgErr;
      if (!msgs || msgs.length === 0) {
        set((s) => ({
          messages: { ...s.messages, [groupId]: [] },
          msgLoading: false,
        }));
        return;
      }

      // Update name cache from joined data
      set((s) => {
        const newCache = new Map(s.nameCache);
        msgs.forEach((m: any) => {
          if (m.profiles?.name) {
            newCache.set(m.user_id, m.profiles.name);
          }
        });
        return { nameCache: newCache };
      });

      // Build reply preview map from reply_to_id references
      const replyIds = msgs
        .filter((m) => m.reply_to_id)
        .map((m) => m.reply_to_id);
      const replyMap = new Map<string, { author: string; message: string }>();

      if (replyIds.length > 0) {
        const { data: replyMsgs } = await supabase
          .from("group_messages")
          .select(
            `
            id, 
            user_id, 
            message, 
            profiles:user_id (name)
          `,
          )
          .in("id", replyIds);

        (replyMsgs || []).forEach((r: any) => {
          const authorName = r.profiles?.name || "JAMB Champion";
          replyMap.set(r.id, {
            author: authorName,
            message: r.message,
          });
          // Also update cache for reply authors
          if (r.profiles?.name) {
            get().nameCache.set(r.user_id, r.profiles.name);
          }
        });
      }

      const messages: ChatMessage[] = msgs.map((row: any) => {
        const authorName = row.profiles?.name || "JAMB Champion";

        return {
          id: row.id,
          group_id: row.group_id,
          user_id: row.user_id,
          author: authorName,
          message: row.message,
          created_at: row.created_at,
          is_edited: row.is_edited,
          status: "delivered" as MessageStatus,
          reply_to: row.reply_to_id
            ? { id: row.reply_to_id, ...replyMap.get(row.reply_to_id)! }
            : null,
        };
      });

      set((s) => ({
        messages: { ...s.messages, [groupId]: messages },
        msgLoading: false,
      }));
    } catch (err) {
      console.error("loadMessages error:", err);
      set({ msgLoading: false });
    }
  },

  // ── sendMessage ─────────────────────────────────────────
  sendMessage: async (groupId, text, replyTo = null) => {
    const userId = useUserStore.getState().id;
    if (!userId || !text.trim()) return;

    // Get the most up-to-date name for the current user
    const currentName = await get().getName(userId);

    const tempId = `temp-${Date.now()}-${Math.random()}`;

    // Optimistic: status = 'sending'
    const tempMsg: ChatMessage = {
      id: tempId,
      group_id: groupId,
      user_id: userId,
      author: currentName || "You",
      message: text.trim(),
      created_at: new Date().toISOString(),
      is_edited: false,
      status: "sending",
      reply_to: replyTo,
    };

    set((s) => ({
      messages: {
        ...s.messages,
        [groupId]: [...(s.messages[groupId] || []), tempMsg],
      },
    }));

    // Store for potential retry
    failedMessages.set(tempId, { groupId, text: text.trim(), replyTo });

    try {
      const insertPayload: any = {
        group_id: groupId,
        user_id: userId,
        message: text.trim(),
      };
      if (replyTo?.id) insertPayload.reply_to_id = replyTo.id;

      const { error } = await supabase
        .from("group_messages")
        .insert(insertPayload);

      if (error) throw error;

      // Mark as 'sent' — realtime will update to 'delivered' when confirmed
      set((s) => ({
        messages: {
          ...s.messages,
          [groupId]: (s.messages[groupId] || []).map((m) =>
            m.id === tempId ? { ...m, status: "sent" as MessageStatus } : m,
          ),
        },
      }));

      // Remove from retry queue on success
      failedMessages.delete(tempId);
    } catch (err) {
      console.error("sendMessage error:", err);
      // Mark as 'failed'
      set((s) => ({
        messages: {
          ...s.messages,
          [groupId]: (s.messages[groupId] || []).map((m) =>
            m.id === tempId ? { ...m, status: "failed" as MessageStatus } : m,
          ),
        },
      }));
    }
  },

  // ── retryMessage ────────────────────────────────────────
  retryMessage: async (groupId, tempId) => {
    const failed = failedMessages.get(tempId);
    if (!failed) return;

    // Remove the failed message from UI
    set((s) => ({
      messages: {
        ...s.messages,
        [groupId]: (s.messages[groupId] || []).filter((m) => m.id !== tempId),
      },
    }));
    failedMessages.delete(tempId);

    // Resend
    await get().sendMessage(failed.groupId, failed.text, failed.replyTo);
  },

  // ── subscribeToChat ─────────────────────────────────────
  subscribeToChat: (groupId) => {
    const seenIds = new Set<string>();

    // Pre-populate seen IDs from already loaded messages
    (get().messages[groupId] || []).forEach((m) => seenIds.add(m.id));

    const channel = supabase
      .channel(`group-chat-${groupId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          const row = payload.new as any;

          // Already rendered this exact confirmed message
          if (seenIds.has(row.id)) return;
          seenIds.add(row.id);

          const myId = useUserStore.getState().id;

          if (row.user_id === myId) {
            // Our own message confirmed — swap temp → real, mark 'delivered'
            set((s) => {
              const list = s.messages[groupId] || [];
              // Find a 'sent' or 'sending' temp message with matching text to replace
              const tempIdx = list.findIndex(
                (m) =>
                  m.id.startsWith("temp-") &&
                  m.message === row.message &&
                  m.status !== "failed",
              );
              if (tempIdx === -1) return s; // nothing to swap
              const updated = [...list];
              updated[tempIdx] = {
                ...updated[tempIdx],
                id: row.id,
                created_at: row.created_at,
                status: "delivered",
              };
              return { messages: { ...s.messages, [groupId]: updated } };
            });
            return;
          }

          // Someone else's message
          const authorName = await get().getName(row.user_id);

          // Resolve reply preview if present
          let reply_to: ReplyPreview | null = null;
          if (row.reply_to_id) {
            const { data: replyMsg } = (await supabase
              .from("group_messages")
              .select("id, user_id, message")
              .eq("id", row.reply_to_id)
              .single()) as { data: ReplyMessageRow | null; error: PostgrestError | null };

            if (replyMsg) {
              const replyAuthor = await get().getName(replyMsg.user_id);
              reply_to = {
                id: replyMsg.id,
                author: replyAuthor,
                message: replyMsg.message,
              };
            }
          }

          const newMsg: ChatMessage = {
            id: row.id,
            group_id: row.group_id,
            user_id: row.user_id,
            author: authorName,
            message: row.message,
            created_at: row.created_at,
            is_edited: row.is_edited,
            status: "delivered",
            reply_to,
          };

          set((s) => ({
            messages: {
              ...s.messages,
              [groupId]: [...(s.messages[groupId] || []), newMsg],
            },
          }));
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },

  getMessages: (groupId) => get().messages[groupId] || [],
}));

// Export retry helper so GroupChat can call it when network is restored
